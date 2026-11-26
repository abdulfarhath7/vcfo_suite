import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * THE SUITE ↔ LIVE BROWSER CONTRACT (docs/specs/live-portal-browser/PLAN.md, DECISIONS.md B1 to B4).
 *
 * This one file is imported by VCFO Suite (`src/lib/live-browser/*`) and by the broker service
 * (`services/live-browser`, through a relative import), so both sides sign and check the same
 * bytes. It is pure: no database, no `server-only`, only `node:crypto`.
 *
 * Two kinds of signature, both HMAC-SHA256 with `LIVE_BROWSER_SHARED_SECRET`:
 *
 *  1. Request bodies between Suite and the broker (session start, stop, warm, every callback).
 *     The header `x-live-browser-signature: t=<unix seconds>,v1=<hex>` covers `${t}.${body}`.
 *     A signature older than five minutes, or from the future by more than that, is refused.
 *  2. Viewer tokens, which Suite gives the browser of a staff member and the broker checks when
 *     the stream's WebSocket opens. A token is bound to one session and one user and lives for
 *     two minutes (it only has to open the socket). `watch` receives frames only and any input it
 *     sends is dropped by the broker; `act` may also send mouse, wheel, keyboard and text input.
 *
 * Nothing in this contract ever carries a portal password, a captcha, an OTP, a cookie or a
 * screenshot (SAFETY.md G1 to G3, G8; proposed G19, G22). Keystrokes from the act view go only to
 * the remote browser; neither side logs or stores them.
 */

export const SIGNATURE_HEADER = 'x-live-browser-signature';
export const MAX_SKEW_SECONDS = 300;
export const TOKEN_TTL_SECONDS = 120;

export type ViewerRole = 'watch' | 'act';

export interface ViewerClaims {
  v: 1;
  /** The live browser session id (`live_browser_sessions.id`). */
  sid: string;
  /** The Suite user the token was issued to. */
  uid: string;
  role: ViewerRole;
  /** Expiry, unix seconds. */
  exp: number;
}

const b64url = (buf: Buffer): string => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string): Buffer => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function mac(secret: string, data: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

function sameBytes(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The signature header for one request body. */
export function signBody(secret: string, body: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  if (!secret) throw new Error('LIVE_BROWSER_SHARED_SECRET is not set');
  return `t=${nowSeconds},v1=${mac(secret, `${nowSeconds}.${body}`).toString('hex')}`;
}

/** True when `header` signs exactly `body` with `secret` and is fresh. */
export function verifyBody(secret: string, header: string | null | undefined, body: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  ) as { t?: string; v1?: string };
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1 || !/^[0-9a-f]{64}$/.test(parts.v1)) return false;
  if (Math.abs(nowSeconds - t) > MAX_SKEW_SECONDS) return false;
  return sameBytes(Buffer.from(parts.v1, 'hex'), mac(secret, `${t}.${body}`));
}

/** A viewer token for one session and one user. */
export function signViewerToken(secret: string, claims: Omit<ViewerClaims, 'v' | 'exp'> & { exp?: number }, nowSeconds = Math.floor(Date.now() / 1000)): string {
  if (!secret) throw new Error('LIVE_BROWSER_SHARED_SECRET is not set');
  const full: ViewerClaims = { v: 1, sid: claims.sid, uid: claims.uid, role: claims.role, exp: claims.exp ?? nowSeconds + TOKEN_TTL_SECONDS };
  const payload = b64url(Buffer.from(JSON.stringify(full)));
  return `${payload}.${b64url(mac(secret, `viewer.${payload}`))}`;
}

/** The token's claims when it is genuine, unexpired and for `sessionId`; otherwise null. */
export function verifyViewerToken(secret: string, token: string | null | undefined, sessionId: string, nowSeconds = Math.floor(Date.now() / 1000)): ViewerClaims | null {
  if (!secret || !token || token.length > 1000) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  if (!sameBytes(fromB64url(sig), mac(secret, `viewer.${payload}`))) return null;
  let claims: ViewerClaims;
  try {
    claims = JSON.parse(fromB64url(payload).toString('utf8')) as ViewerClaims;
  } catch {
    return null;
  }
  if (claims?.v !== 1 || claims.sid !== sessionId || typeof claims.uid !== 'string' || !claims.uid) return null;
  if (claims.role !== 'watch' && claims.role !== 'act') return null;
  if (typeof claims.exp !== 'number' || claims.exp < nowSeconds) return null;
  return claims;
}

// ---------- session start (Suite → broker) ----------

/** What the user approved on "Before I fill" (G13): field keys, each with the SHA-256 of its value. */
export interface ApprovedField {
  key: string;
  valueSha256: string;
}

export interface SessionLimits {
  /** End the session after this many minutes without activity. */
  idleMinutes: number;
  /** End the session after this many minutes in all. */
  maxMinutes: number;
}

/**
 * POST {LIVE_BROWSER_URL}/sessions. Suite has already checked the kill switch, the route switch,
 * the engagement scope, the portal host (G11), one session per login (G21) and the hours cap.
 * The recipe is signed by Suite (G15) and the engine checks it again before it touches a page.
 */
export interface SessionStartBody {
  sessionId: string;
  /** True when the session belongs to a demo login: Suite then answers callbacks in the demo database. */
  demo: boolean;
  userId: string;
  engagementId: string;
  engagementName: string;
  agentId: string;
  taskId: string;
  recipeId: string;
  /** The portal page the browser opens first (the mock page until the pack is live). */
  startUrl: string;
  /** G14: the portal login the person said they use (a label, never a password). */
  portalLoginLabel: string;
  /** Suite's catalog body, as `GET /api/assist/catalog` answers it (kill switch, live hosts, firm contacts). */
  catalog: unknown;
  /** `{ recipe, sig, alg, keyId }`, as `GET /api/assist/recipes/[id]` answers it. */
  signedRecipe: unknown;
  /** `{ schemaVersion, companyName, profile, missing, notes }`, as the assist-profile route answers it. */
  profile: unknown;
  /**
   * G13: the fields the user approved with "Fill now". Undefined means every field Suite holds a
   * value for, as "Before I fill" showed them; the broker computes the hashes from the same profile.
   */
  approvedKeys?: string[];
  /** Fields the user will type on the portal: the agent leaves them and marks them (G16). */
  typeOnPortal?: string[];
  limits: SessionLimits;
}

export interface SessionStartReply {
  ok: boolean;
  node?: string;
  egressIp?: string | null;
  error?: string;
}

// ---------- callbacks (broker → Suite) ----------

/** Session status, as `live_browser_sessions.status` holds it. */
export type LiveSessionStatus = 'starting' | 'ready' | 'your_turn' | 'running' | 'paused' | 'done' | 'cancelled' | 'failed' | 'expired';
export const LIVE_SESSION_OPEN: ReadonlySet<LiveSessionStatus> = new Set(['starting', 'ready', 'your_turn', 'running', 'paused']);
export type LiveSessionEndReason = 'done' | 'cancelled' | 'idle' | 'max_time' | 'kill_switch' | 'error';

/** The human gate the agent waits at. The first seven are recipe gates; the rest are the engine's own waits. */
export type LiveGate = 'LOGIN' | 'CAPTCHA' | 'OTP' | 'DSC' | 'SUBMIT' | 'PAY' | 'EVC' | 'CONFIRM' | 'CERTIFIER' | 'TEACH' | 'STEP' | 'PAGE' | 'CHECK';

/** What a viewer of the session is, as the broker saw them (G23). Never a keystroke. */
export interface ViewerSeen {
  userId: string;
  role: ViewerRole;
  ip: string | null;
  userAgent: string | null;
}

export interface SessionEvent {
  status?: LiveSessionStatus;
  gate?: LiveGate | null;
  progressText?: string | null;
  fieldsTotal?: number;
  fieldsDone?: number;
  /** The engine's state, for example `FILL`. */
  runState?: string;
  node?: string;
  egressIp?: string | null;
  viewer?: ViewerSeen;
  /** Set once, when the session ends. */
  ended?: LiveSessionEndReason;
  error?: string | null;
}

/**
 * POST {Suite}/api/live-browser/callback. Every op names its session; Suite answers it as the
 * person who started the session, inside that session's engagement and run only.
 * `seen` is the act viewer the broker saw last, for the run's evidence log (G14).
 */
export type CallbackOp =
  | { op: 'event'; sessionId: string; demo: boolean; event: SessionEvent }
  | { op: 'createRun'; sessionId: string; demo: boolean; body: Record<string, unknown>; seen?: ViewerSeen | null }
  | { op: 'updateRun'; sessionId: string; demo: boolean; runId: string; body: Record<string, unknown>; seen?: ViewerSeen | null }
  | { op: 'attestation'; sessionId: string; demo: boolean; runId: string }
  | { op: 'resolve'; sessionId: string; demo: boolean; body: Record<string, unknown> }
  | { op: 'proposePatch'; sessionId: string; demo: boolean; body: Record<string, unknown> };

// ---------- the viewer's WebSocket ----------

/** Broker → viewer. */
export type StreamServerMessage =
  | { t: 'hello'; role: ViewerRole; viewport: { w: number; h: number } }
  | { t: 'frame'; data: string; w: number; h: number }
  | { t: 'state'; state: LiveViewState }
  | { t: 'end'; reason: string };

export interface LiveFieldView {
  key: string;
  label: string;
  /** planned | filled | missing | user | refused | placeholder | failed */
  status: string;
  note?: string;
  /** Only while the field is planned and the user is asked to confirm it (G13 table). */
  value?: string;
}

/** What the rail shows. Labels and statuses; a value only in the confirm table. */
export interface LiveViewState {
  status: LiveSessionStatus;
  gate: LiveGate | null;
  /** One line for the "Your turn" banner or the rail, for example "Type the captcha on the portal tab". */
  line: string;
  runState: string | null;
  page: number;
  pageCount: number;
  pageTitle: string | null;
  fields: LiveFieldView[];
  fieldsTotal: number;
  fieldsDone: number;
  /** The field being typed now, if any. */
  typing: string | null;
  paused: boolean;
  /** Paused because nobody is watching (proposed G20). */
  unattended: boolean;
  srn: string | null;
  /** Labels only, newest last. */
  log: Array<{ t: number; kind: string; text: string }>;
  viewers: number;
  /** The portal's PDF to sign is held for the act viewer to download once. */
  pdfReady?: boolean;
  /** At the DSC step: who may have signed (G14), as the engine offers them. */
  signers?: Array<{ ref: string; label: string }>;
}

/** Viewer → broker. Input is honoured for `act` only; `watch` may pause, resume and confirm. */
export type StreamClientMessage =
  | { t: 'mouse'; type: 'mousePressed' | 'mouseReleased' | 'mouseMoved'; x: number; y: number; button?: 'left' | 'middle' | 'right' | 'none'; clickCount?: number; modifiers?: number }
  | { t: 'wheel'; x: number; y: number; dx: number; dy: number }
  | { t: 'key'; type: 'keyDown' | 'keyUp' | 'rawKeyDown' | 'char'; key: string; code?: string; text?: string; keyCode?: number; modifiers?: number }
  | { t: 'text'; text: string }
  | { t: 'pause' }
  | { t: 'resume' }
  | { t: 'event'; event: 'CONFIRM_FILL' | 'RETRY' | 'REFILL' | 'SKIP_TEACH' };

/** Plain words for each gate, for the "Your turn" banner. */
export const GATE_LINE: Record<LiveGate, string> = {
  LOGIN: 'Log in on the portal tab: your user ID, password, captcha and OTP.',
  CAPTCHA: 'Type the captcha on the portal tab.',
  OTP: 'Type the OTP on the portal tab.',
  DSC: 'Sign the form with your DSC.',
  SUBMIT: 'Check the form, then click Submit on the portal tab yourself.',
  PAY: 'Pay the fee on the portal tab yourself.',
  EVC: 'Verify with EVC on the portal tab.',
  CONFIRM: 'Check the values the agent will write, then click Fill page.',
  CERTIFIER: "The certifier's checks are needed in VCFO Suite before Submit.",
  TEACH: 'Click the field the agent could not find, on the portal tab.',
  STEP: 'Open the next part of the form on the portal tab.',
  PAGE: 'Open the form page on the portal tab.',
  CHECK: 'The portal reported errors. Fix them on the portal tab, then try again.',
};
