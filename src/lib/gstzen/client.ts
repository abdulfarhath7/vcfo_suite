import 'server-only';

import { gstzenBaseUrl, gstzenConfigured } from '@/lib/card-agents/config';
import { unwrapEnvelope } from './mappers';
import type { GstForm } from './types';

/**
 * GSTZEN CLIENT — the only code that talks to the GSP (https://my.gstzen.in/docs/api/). Server-only.
 *
 * - Login: JWT from `/accounts/api/login/token/` with GSTZEN_USERNAME and GSTZEN_PASSWORD (the
 *   firm's GSTZen account, not a GST portal login). The access token lives in this process's memory
 *   until ten minutes before it expires (24 hours), and is fetched again after a 401.
 * - Calls: JSON POSTs with `Authorization: Bearer <access>`. The GSTIN validator uses its own
 *   `Token` header with GSTZEN_API_TOKEN when that is set, and the JWT validator otherwise.
 * - Every call has a timeout and answers the portal's own message (`message`) or throws a
 *   `GstzenError` with one plain sentence.
 * - Nothing here logs: no OTP, token, GSTIN figure or response body is ever written to a log.
 *
 * Callers check the route first (`gstzenGate` in `gate.ts`): configured, kill switch off, the admin
 * switch on for the user. `createGstzenClient` takes `env` and `fetch` so tests run on a mock.
 */

export type GstzenErrorKind = 'not_configured' | 'login' | 'portal' | 'timeout' | 'network' | 'http' | 'bad_response';

export class GstzenError extends Error {
  constructor(
    readonly kind: GstzenErrorKind,
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'GstzenError';
  }
}

type Env = Record<string, string | undefined>;
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface GstzenClientOptions {
  env?: Env;
  fetch?: FetchLike;
  now?: () => number;
  /** Per-call timeout; the slow GSTR-9 and RETSUM calls can take tens of seconds. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const LOGIN_TIMEOUT_MS = 20_000;
/** Refresh the access token this long before it expires. */
const TOKEN_MARGIN_MS = 10 * 60_000;
const TOKEN_LIFE_MS = 24 * 60 * 60_000;

/** The `exp` claim of a JWT, in milliseconds; null when it cannot be read. */
export function jwtExpiryMs(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const json = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) as { exp?: unknown };
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function createGstzenClient(opts: GstzenClientOptions = {}) {
  const env = opts.env ?? process.env;
  const doFetch: FetchLike = opts.fetch ?? ((input, init) => fetch(input, init));
  const now = opts.now ?? (() => Date.now());
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let token: { access: string; until: number } | null = null;

  const base = () => gstzenBaseUrl(env);

  async function send(path: string, init: RequestInit, ms: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await doFetch(`${base()}${path}`, { ...init, signal: ctrl.signal, cache: 'no-store' });
    } catch {
      if (ctrl.signal.aborted) throw new GstzenError('timeout', 'GSTZen did not answer in time. Try again in a few minutes.');
      throw new GstzenError('network', 'Suite could not reach GSTZen. Try again in a few minutes.');
    } finally {
      clearTimeout(timer);
    }
  }

  async function readJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new GstzenError('bad_response', 'GSTZen sent an answer Suite could not read.', res.status);
    }
  }

  async function accessToken(force = false): Promise<string> {
    if (!gstzenConfigured(env)) throw new GstzenError('not_configured', 'GSTZen is not set up for this deployment.');
    if (!force && token && token.until > now()) return token.access;
    const form = new URLSearchParams({ username: String(env.GSTZEN_USERNAME ?? '').trim(), password: String(env.GSTZEN_PASSWORD ?? '') });
    const res = await send('/accounts/api/login/token/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: form.toString() }, Math.min(LOGIN_TIMEOUT_MS, timeoutMs));
    const body = (await readJson(res)) as { access?: unknown };
    if (!res.ok || typeof body.access !== 'string' || !body.access) {
      token = null;
      throw new GstzenError('login', 'Suite could not sign in to GSTZen. Check the GSTZen login in the deployment settings.', res.status);
    }
    const exp = jwtExpiryMs(body.access) ?? now() + TOKEN_LIFE_MS;
    token = { access: body.access, until: exp - TOKEN_MARGIN_MS };
    return body.access;
  }

  /** One JSON call. Answers the portal's `message`; throws a plain `GstzenError` on refusal. */
  async function call(path: string, payload: Record<string, unknown>, auth: 'bearer' | 'token' = 'bearer', retried = false): Promise<unknown> {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    if (auth === 'token') headers.Token = String(env.GSTZEN_API_TOKEN ?? '').trim();
    else headers.authorization = `Bearer ${await accessToken()}`;
    const res = await send(path, { method: 'POST', headers, body: JSON.stringify(payload) }, timeoutMs);
    if (res.status === 401 && auth === 'bearer' && !retried) {
      token = null;
      return call(path, payload, auth, true);
    }
    const body = await readJson(res);
    const env1 = unwrapEnvelope(body);
    if (env1.ok === false) throw new GstzenError('portal', env1.error, res.status);
    if (!res.ok) throw new GstzenError('http', `GSTZen answered with an error (${res.status}). Try again later.`, res.status);
    return env1.message;
  }

  const rp = (gstin: string, period: string) => ({ gstin, ret_period: period });

  return {
    /** For tests: forget the cached token. */
    resetToken: () => {
      token = null;
    },

    /* GSTN session: the taxpayer's consent */
    generateOtp: (gstin: string, username: string) => call('/api/gstn-generate-otp/', { gstin, username }),
    establishSession: (gstin: string, otp: string) => call('/api/gstn-establish-session/', { gstin, otp }),
    refreshSession: (gstin: string) => call('/api/gstn-refresh-session/', { gstin }),
    checkSession: (gstin: string) => call('/api/gstn-check-session/', { gstin }),
    createGstin: (gstin: string, name: string, taxpayerType = 'REGULAR') => call('/api/create-gstin/', { gstin, name, taxpayer_type: taxpayerType }),

    /* GSTR-3B */
    gstr3bAutoLiability: (gstin: string, period: string) => call('/api/gstr3b/autoliab/', rp(gstin, period)),
    gstr3bSave: (gstin: string, period: string, data: Record<string, unknown>) => call('/api/gstr3b/retsave/', { ...rp(gstin, period), ...data }),
    gstr3bOffset: (gstin: string, period: string, jsonData: Record<string, unknown>) => call('/api/gstr3b/retoffset/', { ...rp(gstin, period), json_data: jsonData }),
    gstr3bSummary: (gstin: string, period: string) => call('/api/gstr3b/retsum/', rp(gstin, period)),
    gstr3bCashItcBalance: (gstin: string, period: string) => call('/api/gstr3b/cashitcbalance/', rp(gstin, period)),

    /* GSTR-1 */
    gstr1Download: (gstin: string, period: string, apiName: string) => call('/api/gstr1/download/', { ...rp(gstin, period), api_name: apiName }),
    gstr1ProceedToFile: (gstin: string, period: string) => call('/api/gstr1/gstrptf/', rp(gstin, period)),

    /* GSTR-9 and GSTR-9C */
    gstr9AutoCalculated: (gstin: string, period: string) => call('/api/gstr9/calcrecords/', rp(gstin, period)),
    gstr9Records: (gstin: string, period: string) => call('/api/gstr9/records/', rp(gstin, period)),
    gstr9Save: (gstin: string, period: string, jsonData: Record<string, unknown>) => call('/api/gstr9/retsave/', { ...rp(gstin, period), json_data: jsonData }),
    gstr9ProceedToFile: (gstin: string, period: string) => call('/api/gstr9/proceedfile/', rp(gstin, period)),
    gstr9cRecords: (gstin: string, period: string) => call('/api/gstr9c/records/', rp(gstin, period)),
    gstr9cSummary: (gstin: string, period: string) => call('/api/gstr9c/retsum/', rp(gstin, period)),
    gstr9cProceedToFile: (gstin: string, period: string) => call('/api/gstr9c/proceedfile/', rp(gstin, period)),

    /** RETSTATUS for a save or proceed reference. GSTR-9 and 9C have their own endpoints. */
    returnStatus: (form: GstForm, gstin: string, period: string, referenceId: string) =>
      call(form === 'gstr9' ? '/api/gstr9/retstatus/' : form === 'gstr9c' ? '/api/gstr9c/retstatus/' : '/api/retstatus/', { ...rp(gstin, period), reference_id: referenceId }),

    /** EVC OTP to the authorised signatory. GSTR-9 and 9C tie the OTP to the form and use their own endpoints. */
    generateEvcOtp: (form: GstForm, gstin: string, period: string, signatoryPan: string) => {
      const path = form === 'gstr9' ? '/api/gstr9/generate-evc-otp/' : form === 'gstr9c' ? '/api/gstr9c/generate-evc-otp/' : '/api/gstn-generate-evc-otp/';
      // The GSTR-3B page shows the period as `fp`, the GSTR-1 page as `ret_period`; both are sent.
      return call(path, { ...rp(gstin, period), fp: period, authorized_signatory_pan: signatoryPan });
    },

    /**
     * RETFILE with EVC. GSTR-1 forwards RETSUM's `data_json_string` unchanged; GSTR-3B, 9 and 9C
     * send `json_data` as their pages show.
     */
    fileWithEvc: (form: GstForm, gstin: string, period: string, input: { otp: string; signatoryPan: string; dataJsonString?: string | null; jsonData?: Record<string, unknown> | null }) => {
      const path = { gstr1: '/api/gstr1/retfile-evc/', gstr3b: '/api/gstr3b/retfile-evc/', gstr9: '/api/gstr9/retfile-evc/', gstr9c: '/api/gstr9c/retfile-evc/' }[form];
      const body: Record<string, unknown> = { ...rp(gstin, period), otp: input.otp, authorized_signatory_pan: input.signatoryPan };
      if (form === 'gstr1') body.data_json_string = input.dataJsonString ?? '';
      else body.json_data = input.jsonData ?? {};
      return call(path, body);
    },

    /* GSTR-2B */
    gstr2b: (gstin: string, period: string) => call('/api/gstr2/2b/', rp(gstin, period)),

    /* Notices (read only) */
    noticeList: (gstin: string, date?: string) => call('/api/notices/get-list/', date ? { gstin, date } : { gstin }),
    noticeDetail: (gstin: string, refId: string) => call('/api/notices/get-detail/', { gstin, ref_id: refId }),

    /** GSTIN validator: the `Token` endpoint with GSTZEN_API_TOKEN, else the JWT endpoint. Answers the whole body. */
    validateGstin: async (gstin: string): Promise<unknown> => {
      const useToken = Boolean(env.GSTZEN_API_TOKEN?.trim());
      if (!useToken && !gstzenConfigured(env)) throw new GstzenError('not_configured', 'GSTZen is not set up for this deployment.');
      const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
      if (useToken) headers.Token = String(env.GSTZEN_API_TOKEN).trim();
      else headers.authorization = `Bearer ${await accessToken()}`;
      const res = await send(useToken ? '/api/gstin-validator/' : '/api/j/gstin-validator/', { method: 'POST', headers, body: JSON.stringify({ gstin }) }, Math.min(LOGIN_TIMEOUT_MS, timeoutMs));
      const body = await readJson(res);
      const e = unwrapEnvelope(body);
      if (e.ok === false) throw new GstzenError('portal', e.error, res.status);
      if (!res.ok) throw new GstzenError('http', `GSTZen answered with an error (${res.status}). Try again later.`, res.status);
      return body;
    },
  };
}

export type GstzenClient = ReturnType<typeof createGstzenClient>;

let shared: GstzenClient | null = null;

/** The process-wide client (one cached GSTZen token per server process). */
export function gstzen(): GstzenClient {
  shared ??= createGstzenClient();
  return shared;
}

/** For tests: swap the shared client. */
export function setGstzenClientForTests(client: GstzenClient | null): void {
  shared = client;
}
