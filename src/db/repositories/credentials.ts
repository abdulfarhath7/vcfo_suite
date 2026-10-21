import 'server-only';

import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull, like, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  auditEvents,
  credentialAccessGrants,
  credentialOtps,
  engagementCredentials,
  identifierRevealAttempts,
  profiles,
} from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import {
  assertEngagementAccess,
  checklistStateForViewer,
  checklistStateFromRow,
  getMyEngagement,
  type EngagementDbRow,
} from '@/db/repositories/engagements';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { getActiveCatalogItems } from '@/data/checklist';
import { CLIENT_RESPONSE_FIELDS, extractItemResponses } from '@/lib/checklist/checklist-responses';
import { isRepeatField, repeatEntries } from '@/lib/checklist/checklist-repeat';
import { identifiersFromState } from '@/lib/client/client-overview';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { decryptSecrets, encryptSecrets, hashOtp, newOtpCode, otpMatches } from '@/lib/credentials-crypto';
import { sendEmail } from '@/lib/email/send-email';
import {
  ADDRESS_ROWS,
  KYC_NAME_FIELD,
  KYC_ROWS,
  LABEL_COL,
  LOGIN_ROWS,
  REG_ROWS,
  REG_SHORT,
  SHEET_COLS,
  cellLabel,
  isValidScope,
  maskEmail,
  maskId,
  parseCellKey,
  scopeLabel,
  scopesCovering,
  tabLabel,
  type CredMode,
  type CredSheet,
  type CredSource,
  type CredentialsLogEntry,
  type CredentialsPayload,
  type WireCell,
  type WireCol,
  type WireIdTile,
  type WireRow,
  type WireSheet,
} from '@/lib/client-portal/credentials';

/**
 * CREDENTIALS REPOSITORY — the client's government-portal logins, registrations,
 * addresses and directors' KYC (prototype v7p_credentials) + the PAN / TAN
 * password reveal (v7p_ids_password).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   client  — only the engagement `getMyEngagement(ctx)` resolves to (own /
 *             engagement_clients member), re-checked with
 *             `assertEngagementAccess`. A client NEVER receives a secret value
 *             unless it holds a live grant (manager-approved OTP, 10 minutes)
 *             on a scope covering that cell, and may only write inside a live
 *             Edit grant. OTPs / grants are keyed by `ctx.userId`; another
 *             person's grant never unlocks anything.
 *   manager / intern (lead) — engagements `assertEngagementAccess` allows
 *             (owned / engagement_managers / engagement_leads); they read and
 *             write without an OTP (they are the approvers).
 *   admin / super_admin — firm-wide, same as staff.
 * Every OTP request, grant, reveal, edit, undo, row change and lock writes an
 * audit event (`credentials.*`, `identifiers.reveal`) — the Access log drawer
 * and the Audit page both read audit_events.
 */

export class CredentialsError extends Error {
  constructor(
    public code: string,
    public status: number,
    public extra: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

const SESSION_MS = 10 * 60_000;
const OTP_TTL_MS = 10 * 60_000;
const RESEND_MS = 30_000;
const LOCK_MS = 60_000;
const MAX_TRIES = 3;
/** New OTP codes one person may ask for per engagement per hour (security review H2). */
const OTP_REQUESTS_PER_HOUR = 6;
const SHEETS: CredSheet[] = ['address', 'login', 'reg', 'kyc', 'other'];

type Access = { dbId: string; row: EngagementDbRow; staff: boolean };

async function resolveAccess(ctx: AuthContext, engagementId?: string | null): Promise<Access> {
  if (ctx.role === 'client') {
    const mine = await getMyEngagement(ctx);
    if (!mine) throw new CredentialsError('not_found', 404);
    if (engagementId && engagementId !== mine.id && engagementId !== appEngagementId(mine.id)) {
      // A client may only ever address its own engagement.
      const other = await assertEngagementAccess(ctx, engagementId);
      if (!other.ok) throw new CredentialsError('forbidden', 403);
      return { dbId: other.dbId, row: other.row, staff: false };
    }
    const a = await assertEngagementAccess(ctx, mine.id);
    if (!a.ok) throw new CredentialsError('forbidden', 403);
    return { dbId: a.dbId, row: a.row, staff: false };
  }
  if (!engagementId) throw new CredentialsError('engagement_required', 400);
  const a = await assertEngagementAccess(ctx, engagementId);
  if (!a.ok) throw new CredentialsError('notFound' in a ? 'not_found' : 'forbidden', 'notFound' in a ? 404 : 403);
  return { dbId: a.dbId, row: a.row, staff: true };
}

/* ------------------------------------------------------------------ */
/* auto-fill from checklist responses                                  */
/* ------------------------------------------------------------------ */

type AutoCell = { v: string; src: CredSource; doc?: string };
type AutoMap = Map<string, AutoCell>; // `${sheet}|${row}|${col}`

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(v: string | undefined): string | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]} ${MON[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}
function fileName(path: string): string {
  const seg = path.split('/').pop() ?? path;
  const dash = seg.indexOf('-');
  return dash > 0 && /^\d+$/.test(seg.slice(0, dash)) ? seg.slice(dash + 1) : seg;
}

interface Derived {
  auto: AutoMap;
  ids: { cin?: string; pan?: string; tan?: string; gstin?: string };
  registeredAddress: string | null;
  directors: Array<{ key: string; name: string }>;
}

function derive(ctx: AuthContext, row: EngagementDbRow): Derived {
  const state = checklistStateForViewer(ctx, checklistStateFromRow(row)) as Record<string, unknown>;
  const items = getActiveCatalogItems();
  const resp = (id: string): Record<string, string> => {
    const item = items.find((i) => i.id === id);
    if (!item) return {};
    return extractItemResponses(item, (state[id] ?? null) as never);
  };
  const pick = (r: Record<string, string>, k: string) => r[k]?.trim() || undefined;
  const auto: AutoMap = new Map();
  const set = (sheet: CredSheet, rowKey: string, col: string, v: string | undefined, src: CredSource, doc?: string) => {
    if (v) auto.set(`${sheet}|${rowKey}|${col}`, { v, src, ...(doc ? { doc } : {}) });
  };

  const idf = identifiersFromState(state as never);
  const pre1 = resp('pre-1');
  const pre14 = resp('pre-14');
  const r1 = resp('reg-1');
  const r2 = resp('reg-2');
  const r3 = resp('reg-3');
  const r4 = resp('reg-4');
  const r5 = resp('reg-5');
  const r6 = resp('reg-6');
  const r7 = resp('reg-7');
  const r8 = resp('reg-8');
  const r13 = resp('reg-13');
  const r14 = resp('reg-14');
  const r15 = resp('reg-15');

  const cin = idf.cin;
  const pan = idf.pan ?? pick(r2, 'panNumber');
  const tan = idf.tan ?? pick(r2, 'tanNumber');
  const gstin = pick(r4, 'gstinNumber');
  const mail = pick(pre1, 'companyMailId');
  const mobNum = pick(pre1, 'companyMobileNumber');
  const mobile = mobNum ? [pick(pre1, 'companyMobileCountryCode'), mobNum].filter(Boolean).join(' ') : undefined;
  const regAddr = pick(pre14, 'registeredOfficeCompleteAddress') ?? (row.subsidiaryRegisteredAddress?.trim() || undefined);

  /* Login Credentials */
  const companySrc = (k: string, v: string | undefined) => set('login', k, 'id', v, idf[k === 'cin' ? 'cin' : k === 'pan' ? 'pan' : 'tan'] ? 'company record' : 'registration steps');
  companySrc('cin', cin);
  companySrc('pan', pan);
  companySrc('tan-traces', tan);
  companySrc('tan-it', tan);
  companySrc('traces', tan);
  set('login', 'esi', 'id', pick(r3, 'esiRegistrationNumber') ?? idf.esiCode, 'registration steps');
  set('login', 'pf', 'id', pick(r1, 'pfRegistrationNumber') ?? idf.pfCode, 'registration steps');
  set('login', 'gst', 'id', gstin, 'registration steps');
  set('login', 'gst-einvoice', 'id', gstin, 'registration steps');
  set('login', 'lut', 'id', pick(r4, 'lutArn') ?? pick(r5, 'lutArn'), 'registration steps');
  set('login', 'pt', 'id', pick(r7, 'ptRegistrationNumberCompany'), 'registration steps');
  set('login', 'iec', 'id', pick(r8, 'iecCode'), 'registration steps');
  set('login', 'mail', 'id', mail, 'client profile');
  set('login', 'address', 'id', regAddr, 'registered office');
  for (const r of LOGIN_ROWS) {
    if (!r) continue;
    set('login', r[0], 'mail', mail, 'client profile');
    set('login', r[0], 'mobile', mobile, 'client profile');
  }

  /* Registrations */
  const reg = (k: string, num?: string, date?: string, cert?: string) => {
    set('reg', k, 'number', num, 'registration steps');
    set('reg', k, 'date', fmtDate(date), 'registration steps');
    if (cert && !/^https?:/i.test(cert)) set('reg', k, 'cert', fileName(cert), 'registration steps', cert);
  };
  reg('gst', gstin, pick(r4, 'gstRegistrationDate'), pick(r4, 'gstCertificateUrl'));
  reg('pf', pick(r1, 'pfRegistrationNumber'), pick(r1, 'pfRegistrationDate'));
  reg('esi', pick(r3, 'esiRegistrationNumber'), pick(r3, 'esiRegistrationDate'));
  reg('pt', pick(r7, 'ptRegistrationNumberCompany'), pick(r7, 'ptRegistrationDate'));
  reg('lei', pick(r6, 'leiNumber'), pick(r6, 'leiRegistrationDate'));
  reg('msme', pick(r15, 'msmeUdyamNumber'), pick(r15, 'msmeRegistrationDate'));
  reg('iec', pick(r8, 'iecCode'), pick(r8, 'iecRegistrationDate'), pick(r8, 'iecCertificateUrl'));
  reg('lut', pick(r4, 'lutArn') ?? pick(r5, 'lutArn'), pick(r4, 'lutFilingDate') ?? pick(r5, 'lutFilingDate'));
  reg('clra', pick(r13, 'clraRegistrationNumber'));
  reg('posh', pick(r14, 'poshSheBoxId'));

  /* Address: the registered office is one free-text line in step 7, so only
     State, PIN and Country can be filled without guessing (QUESTIONS.md). */
  const pinMatch = regAddr?.match(/\b\d{6}\b/)?.[0] ?? (regAddr?.match(/\b\d{3}\s\d{3}\b/)?.[0]?.replace(/\s/, ''));
  for (const k of ['registered', 'communication']) {
    set('address', k, 'state', pick(pre14, 'registeredOfficeState'), 'registered office');
    set('address', k, 'pin', pinMatch, 'registered office');
    set('address', k, 'country', regAddr ? 'India' : undefined, 'registered office');
    set('address', k, 'phone', mobile, 'client profile');
  }
  const noc = pick(pre14, 'registeredOfficeNocUrl');
  if (noc && !/^https?:/i.test(noc)) set('address', 'registered', 'noc', fileName(noc), 'registered office', noc);
  const ub = pick(pre14, 'registeredOfficeUtilityBillCopyUrl');
  if (ub && !/^https?:/i.test(ub)) set('address', 'registered', 'utility', fileName(ub), 'registered office', ub);

  /* Directors KYC (step pre-15 · Proposed directors) */
  const directors: Derived['directors'] = [];
  const pre15 = resp('pre-15');
  const group = (CLIENT_RESPONSE_FIELDS['pre-15'] ?? []).find((f) => f.id === 'directors');
  if (group && isRepeatField(group)) {
    for (const e of repeatEntries(pre15, group)) {
      const v = (k: string) => e.values[k]?.trim() || undefined;
      const key = `director:pre15:${e.id}`;
      const full = [v('firstName'), v('middleName'), v('lastName')].filter(Boolean).join(' ');
      directors.push({ key, name: full || `Director ${e.index}` });
      const s = (p: string, val: string | undefined) => set('kyc', p, key, val, 'incorporation steps');
      s('din', v('din'));
      s('full', full || undefined);
      s('first', v('firstName'));
      s('middle', v('middleName'));
      s('last', v('lastName'));
      s('dob', fmtDate(v('dob')));
      s('father', v('fatherName'));
      s('address', v('utilityBillAddress'));
      s('mobile', v('mobileNumber'));
      s('mail', v('personalMailId') ?? v('officialMailId'));
      s('passport', v('passportNumber'));
      s('aadhaar', v('aadhaarNumber'));
      s('dl', v('drivingLicenceNumber'));
      s('pan', v('panNumber'));
      s('edu', v('highestEducationalQualification'));
      const res = v('indiaResident');
      s('category', res === 'yes' ? 'Resident Indian' : res === 'no' ? 'Foreign national' : undefined);
    }
  }

  return { auto, ids: { cin, pan, tan, gstin }, registeredAddress: regAddr ?? null, directors };
}

/* ------------------------------------------------------------------ */
/* stored rows                                                         */
/* ------------------------------------------------------------------ */

type StoredRow = typeof engagementCredentials.$inferSelect;
const aadOf = (dbId: string, sheet: string, rowKey: string) => `${dbId}|${sheet}|${rowKey}`;

async function loadStored(dbId: string): Promise<StoredRow[]> {
  return db.select().from(engagementCredentials).where(eq(engagementCredentials.engagementId, dbId));
}

function isSecretCell(sheet: CredSheet, rowKey: string, colKey: string): boolean {
  if (sheet === 'kyc') return Boolean(KYC_ROWS.find((p) => p.key === rowKey)?.s);
  return Boolean(SHEET_COLS[sheet].find((c) => c.key === colKey)?.s);
}

interface Live {
  scope: string;
  mode: CredMode;
  expiresAt: Date;
  id: string;
}

async function liveGrants(ctx: AuthContext, dbId: string): Promise<Live[]> {
  const rows = await db
    .select()
    .from(credentialAccessGrants)
    .where(
      and(
        eq(credentialAccessGrants.engagementId, dbId),
        eq(credentialAccessGrants.profileId, ctx.userId),
        gt(credentialAccessGrants.expiresAt, new Date()),
        isNull(credentialAccessGrants.revokedAt),
      ),
    );
  return rows.map((r) => ({ id: r.id, scope: r.scope, mode: r.mode as CredMode, expiresAt: r.expiresAt }));
}

function canSee(grants: Live[], key: string): boolean {
  const s = scopesCovering(key);
  return grants.some((g) => s.includes(g.scope));
}
function canEdit(grants: Live[], key: string): boolean {
  const s = scopesCovering(key).filter((x) => !x.startsWith('cell:'));
  return grants.some((g) => g.mode === 'edit' && s.includes(g.scope));
}

/* ------------------------------------------------------------------ */
/* build the workbook                                                  */
/* ------------------------------------------------------------------ */

interface Built {
  payload: CredentialsPayload;
  /** Every secret value by cell key (server-side only). */
  secrets: Map<string, string>;
  stored: StoredRow[];
  derived: Derived;
}

async function build(ctx: AuthContext, acc: Access): Promise<Built> {
  const derived = derive(ctx, acc.row);
  const stored = await loadStored(acc.dbId);
  const grants = acc.staff ? [] : await liveGrants(ctx, acc.dbId);
  const secrets = new Map<string, string>();
  const byKey = new Map(stored.map((s) => [`${s.sheet}|${s.rowKey}`, s]));
  const dec = new Map<string, Record<string, string>>();
  const secretsOf = (s: StoredRow | undefined): Record<string, string> => {
    if (!s) return {};
    const k = `${s.sheet}|${s.rowKey}`;
    if (!dec.has(k)) dec.set(k, decryptSecrets(s.secretCiphertext, aadOf(acc.dbId, s.sheet, s.rowKey)));
    return dec.get(k)!;
  };
  const visible = (key: string) => acc.staff || canSee(grants, key);

  /** One cell: stored value wins (Edited when it overrides an auto value). */
  const cellOf = (sheet: CredSheet, rowKey: string, colKey: string, storeRow: StoredRow | undefined, storeField: string, autoKey: string): WireCell => {
    const secret = isSecretCell(sheet, rowKey, colKey);
    const a = derived.auto.get(autoKey);
    const storedVal = secret ? secretsOf(storeRow)[storeField] : storeRow?.fields?.[storeField];
    const edited = Boolean(storeRow?.edited?.[storeField]);
    let v: string | undefined;
    let src: CredSource | undefined;
    let doc: string | undefined;
    if (storedVal != null && storedVal !== '') {
      v = storedVal;
      if (a) src = a.src;
    } else if (a) {
      v = a.v;
      src = a.src;
      doc = a.doc;
    }
    const key = `${sheet}|${rowKey}|${colKey}`;
    const out: WireCell = { v: v ?? '' };
    if (src) out.src = src;
    if (src && edited) out.edited = true;
    if (doc) out.doc = doc;
    if (secret && v) {
      secrets.set(key, v);
      out.has = true;
      if (!visible(key)) out.v = null;
    }
    return out;
  };

  const sheets = {} as Record<CredSheet, WireSheet>;

  /* flat sheets */
  for (const sheet of ['address', 'login', 'reg', 'other'] as const) {
    const cols: WireCol[] = SHEET_COLS[sheet].map((c) => ({ ...c }));
    const template: Array<[string, string] | null> =
      sheet === 'login' ? LOGIN_ROWS : sheet === 'reg' ? REG_ROWS : sheet === 'address' ? ADDRESS_ROWS : [];
    const rows: WireRow[] = [];
    const pushRow = (rowKey: string, label: string, custom: boolean) => {
      const sr = byKey.get(`${sheet}|${rowKey}`);
      const cells: Record<string, WireCell> = {};
      for (const c of cols) {
        if (c.k === 'sno') continue;
        if (c.key === LABEL_COL) {
          cells[c.key] = { v: sr?.fields?.[LABEL_COL] || label };
          continue;
        }
        if (c.k === 'status') {
          cells[c.key] = { v: sr?.fields?.status || 'Pending' };
          continue;
        }
        cells[c.key] = cellOf(sheet, rowKey, c.key, sr, c.key, `${sheet}|${rowKey}|${c.key}`);
      }
      // Company IDs from the company record wait for the COI (prototype "Pending COI").
      if (sheet === 'login' && ['cin', 'pan', 'tan-traces', 'tan-it', 'traces'].includes(rowKey) && !cells.id?.v && !cells.id?.has) {
        cells.id = { v: 'Pending COI' };
      }
      rows.push({ key: rowKey, cells, ...(custom ? { custom: true } : {}) });
    };
    let spacer = 0;
    for (const t of template) {
      if (!t) {
        rows.push({ key: `spacer-${spacer++}`, spacer: true, cells: {} });
        continue;
      }
      pushRow(t[0], t[1], false);
    }
    stored
      .filter((s) => s.sheet === sheet && s.rowKey.startsWith('custom:'))
      .sort((a, b) => a.ordinal - b.ordinal || a.createdAt.getTime() - b.createdAt.getTime())
      .forEach((s) => pushRow(s.rowKey, '', true));
    sheets[sheet] = { id: sheet, cols, rows };
  }

  /* Directors KYC (transposed) */
  const dirKeys: Array<{ key: string; name: string; custom: boolean }> = derived.directors.map((d) => ({ ...d, custom: false }));
  stored
    .filter((s) => s.sheet === 'kyc' && !dirKeys.some((d) => d.key === s.rowKey))
    .sort((a, b) => a.ordinal - b.ordinal || a.createdAt.getTime() - b.createdAt.getTime())
    .forEach((s) => dirKeys.push({ key: s.rowKey, name: '', custom: s.rowKey.startsWith('director:custom:') }));
  const kycCols: WireCol[] = [{ key: LABEL_COL, n: 'Particulars' }];
  for (const d of dirKeys) {
    const sr = byKey.get(`kyc|${d.key}`);
    kycCols.push({ key: d.key, n: sr?.fields?.[KYC_NAME_FIELD] || d.name || 'New director', hdr: true });
  }
  sheets.kyc = {
    id: 'kyc',
    cols: kycCols,
    rows: KYC_ROWS.map((p) => {
      const cells: Record<string, WireCell> = { [LABEL_COL]: { v: p.n } };
      for (const d of dirKeys) {
        const sr = byKey.get(`kyc|${d.key}`);
        cells[d.key] = cellOf('kyc', p.key, d.key, sr, p.key, `kyc|${p.key}|${d.key}`);
      }
      return { key: p.key, cells };
    }),
  };

  /* identifier tiles */
  const tile = (key: WireIdTile['key'], name: string, auth: WireIdTile['auth'], v: string | undefined, secret: boolean): WireIdTile => {
    const ck = `ids|${key}|value`;
    if (!v) return { key, name, auth, value: null, masked: null, secret };
    if (!secret) return { key, name, auth, value: v, masked: null, secret };
    secrets.set(ck, v);
    return { key, name, auth, value: visible(ck) ? v : null, masked: maskId(v), secret };
  };
  const ids = [
    tile('cin', 'CIN', 'mca', derived.ids.cin, false),
    tile('pan', 'PAN', 'it', derived.ids.pan, true),
    tile('tan', 'TAN', 'it', derived.ids.tan, true),
    tile('gstin', 'GSTIN', 'gst', derived.ids.gstin, false),
  ];
  const regNames = sheets.reg.rows
    .filter((r) => (r.cells.number?.v ?? '').trim())
    .map((r) => REG_SHORT[r.key] ?? r.cells[LABEL_COL]?.v ?? '')
    .filter((x, i, a) => x && a.indexOf(x) === i);

  const recipients = await resolveEngagementRecipients(acc.dbId);
  const mgr = recipients?.managers?.[0] ?? recipients?.manager ?? recipients?.leads?.[0] ?? null;

  return {
    payload: {
      engagementId: appEngagementId(acc.dbId),
      companyName: acc.row.companyName,
      registeredAddress: derived.registeredAddress,
      manager: mgr ? { name: mgr.name, emailMasked: maskEmail(mgr.email) } : null,
      ids,
      registrationsSummary: regNames.length ? regNames.join(' · ') : null,
      directors: dirKeys.length,
      sheets,
      grants: grants.map((g) => ({ id: g.id, mode: g.mode, scope: g.scope, expiresAt: g.expiresAt.toISOString() })),
      staff: acc.staff,
    },
    secrets,
    stored,
    derived,
  };
}

export async function getCredentials(ctx: AuthContext, engagementId?: string | null): Promise<CredentialsPayload> {
  const acc = await resolveAccess(ctx, engagementId);
  return (await build(ctx, acc)).payload;
}

/* ------------------------------------------------------------------ */
/* OTP: request, resend, verify; grants                                 */
/* ------------------------------------------------------------------ */

function verbOf(mode: CredMode): string {
  return mode === 'edit' ? 'Edit' : mode === 'preview' ? 'Preview' : 'Reveal';
}

async function approvers(dbId: string) {
  const r = await resolveEngagementRecipients(dbId);
  const managers = r?.managers?.length ? r.managers : r?.manager ? [r.manager] : [];
  // No Project Manager on the engagement → the Project Lead(s) approve (QUESTIONS.md).
  return managers.length ? managers : (r?.leads ?? []);
}

async function deliverOtp(ctx: AuthContext, acc: Access, code: string, mode: CredMode, label: string) {
  const to = await approvers(acc.dbId);
  if (!to.length) throw new CredentialsError('no_manager', 409);
  const who = ctx.name || ctx.email;
  const verb = verbOf(mode);
  const text = [
    `${who} (${acc.row.companyName}) asked to ${verb.toLowerCase()} ${label} on the Credentials page of VCFO Suite.`,
    '',
    `Code: ${code}`,
    '',
    'The code works for 10 minutes. Share it with them by phone or WhatsApp only if you expect this request.',
    'Every preview, edit and reveal is logged on the client’s Audit page.',
  ].join('\n');
  const html = `<p>${escapeHtml(who)} (${escapeHtml(acc.row.companyName)}) asked to <b>${verb.toLowerCase()} ${escapeHtml(label)}</b> on the Credentials page of VCFO Suite.</p>
<p style="font:700 28px/1.2 'IBM Plex Mono',monospace;letter-spacing:.2em">${code}</p>
<p>The code works for 10 minutes. Share it with them by phone or WhatsApp only if you expect this request.<br>Every preview, edit and reveal is logged on the client’s Audit page.</p>`;
  // WhatsApp is template-only (no free-text send) → email only; see QUESTIONS.md.
  await sendEmail({
    to: to.map((m) => m.email),
    subject: `Credentials access code for ${acc.row.companyName}`,
    text,
    html,
    purpose: 'credentials.otp',
  });
  return to[0]!;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

async function activeLock(ctx: AuthContext, dbId: string): Promise<Date | null> {
  const [row] = await db
    .select({ lockedUntil: credentialOtps.lockedUntil })
    .from(credentialOtps)
    .where(
      and(
        eq(credentialOtps.engagementId, dbId),
        eq(credentialOtps.requestedBy, ctx.userId),
        gt(credentialOtps.lockedUntil, new Date()),
      ),
    )
    .orderBy(desc(credentialOtps.lockedUntil))
    .limit(1);
  return row?.lockedUntil ?? null;
}

export interface OtpTicket {
  otpId: string;
  manager: { name: string; emailMasked: string };
  resendAt: string;
  expiresAt: string;
  lockedUntil: string | null;
}

export async function requestCredentialOtp(
  ctx: AuthContext,
  input: { engagementId?: string | null; mode: CredMode; scope: string },
): Promise<OtpTicket> {
  if (!['preview', 'edit', 'reveal'].includes(input.mode) || !isValidScope(input.scope)) {
    throw new CredentialsError('invalid_scope', 400);
  }
  if (input.mode === 'reveal' && !input.scope.startsWith('cell:')) throw new CredentialsError('invalid_scope', 400);
  if (input.mode === 'edit' && (input.scope.startsWith('cell:') || input.scope.startsWith('row:ids'))) {
    throw new CredentialsError('invalid_scope', 400);
  }
  const acc = await resolveAccess(ctx, input.engagementId);
  if (acc.staff) throw new CredentialsError('staff_no_otp', 400);
  const locked = await activeLock(ctx, acc.dbId);
  if (locked) throw new CredentialsError('locked', 423, { lockedUntil: locked.toISOString() });

  // Security review H2: at most OTP_REQUESTS_PER_HOUR codes per person and
  // engagement, and only ONE live code — a new request retires the old ones.
  const [recent] = await db
    .select({ n: sql<number>`count(*)` })
    .from(credentialOtps)
    .where(
      and(
        eq(credentialOtps.requestedBy, ctx.userId),
        eq(credentialOtps.engagementId, acc.dbId),
        gt(credentialOtps.createdAt, new Date(Date.now() - 60 * 60_000)),
      ),
    );
  if (Number(recent?.n ?? 0) >= OTP_REQUESTS_PER_HOUR) throw new CredentialsError('too_many_requests', 429);
  await db
    .update(credentialOtps)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(credentialOtps.requestedBy, ctx.userId),
        eq(credentialOtps.engagementId, acc.dbId),
        isNull(credentialOtps.consumedAt),
      ),
    );

  const built = await build(ctx, acc);
  const label = scopeLabel(built.payload.sheets, built.payload.ids, input.scope);
  const id = randomUUID();
  const code = newOtpCode();
  const now = Date.now();
  const sentTo = await deliverOtp(ctx, acc, code, input.mode, label);
  await db.insert(credentialOtps).values({
    id,
    engagementId: acc.dbId,
    requestedBy: ctx.userId,
    approverProfileId: sentTo.userId,
    approverName: sentTo.name,
    mode: input.mode,
    scope: input.scope,
    codeHash: hashOtp(id, code),
    expiresAt: new Date(now + OTP_TTL_MS),
    resendAvailableAt: new Date(now + RESEND_MS),
  });
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'credentials.otp_requested',
    summary: `asked for an OTP to ${verbOf(input.mode).toLowerCase()} ${label} · sent to ${sentTo.name}`,
    metadata: { mode: input.mode, scope: input.scope, otpId: id },
  });
  return {
    otpId: id,
    manager: { name: sentTo.name, emailMasked: maskEmail(sentTo.email) },
    resendAt: new Date(now + RESEND_MS).toISOString(),
    expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
    lockedUntil: null,
  };
}

async function loadOwnOtp(ctx: AuthContext, otpId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(otpId)) throw new CredentialsError('not_found', 404);
  const [otp] = await db
    .select()
    .from(credentialOtps)
    .where(and(eq(credentialOtps.id, otpId), eq(credentialOtps.requestedBy, ctx.userId)))
    .limit(1);
  if (!otp || otp.consumedAt) throw new CredentialsError('not_found', 404);
  // Re-check the engagement is still the caller's (membership may have changed).
  const acc = await resolveAccess(ctx, otp.engagementId);
  if (acc.dbId !== otp.engagementId) throw new CredentialsError('forbidden', 403);
  return { otp, acc };
}

export async function resendCredentialOtp(ctx: AuthContext, otpId: string): Promise<OtpTicket> {
  const { otp, acc } = await loadOwnOtp(ctx, otpId);
  const now = Date.now();
  if (otp.lockedUntil && otp.lockedUntil.getTime() > now) {
    throw new CredentialsError('locked', 423, { lockedUntil: otp.lockedUntil.toISOString() });
  }
  if (otp.resendAvailableAt.getTime() > now) {
    throw new CredentialsError('resend_too_soon', 429, { resendAt: otp.resendAvailableAt.toISOString() });
  }
  const built = await build(ctx, acc);
  const label = scopeLabel(built.payload.sheets, built.payload.ids, otp.scope);
  const code = newOtpCode();
  const sentTo = await deliverOtp(ctx, acc, code, otp.mode as CredMode, label);
  await db
    .update(credentialOtps)
    .set({
      codeHash: hashOtp(otp.id, code),
      expiresAt: new Date(now + OTP_TTL_MS),
      resendAvailableAt: new Date(now + RESEND_MS),
      approverProfileId: sentTo.userId,
      approverName: sentTo.name,
    })
    .where(eq(credentialOtps.id, otp.id));
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'credentials.otp_requested',
    summary: `asked for a new OTP for ${label} · sent to ${sentTo.name}`,
    metadata: { mode: otp.mode, scope: otp.scope, otpId: otp.id, resend: true },
  });
  return {
    otpId: otp.id,
    manager: { name: sentTo.name, emailMasked: maskEmail(sentTo.email) },
    resendAt: new Date(now + RESEND_MS).toISOString(),
    expiresAt: new Date(now + OTP_TTL_MS).toISOString(),
    lockedUntil: null,
  };
}

export type VerifyOutcome =
  | { ok: true; grant: { id: string; mode: CredMode; scope: string; expiresAt: string } }
  | { ok: false; error: 'wrong_code'; triesLeft: number }
  | { ok: false; error: 'locked'; lockedUntil: string }
  | { ok: false; error: 'expired' };

export async function verifyCredentialOtp(ctx: AuthContext, input: { otpId: string; code: string }): Promise<VerifyOutcome> {
  const { otp, acc } = await loadOwnOtp(ctx, input.otpId);
  const now = Date.now();
  if (otp.lockedUntil && otp.lockedUntil.getTime() > now) {
    return { ok: false, error: 'locked', lockedUntil: otp.lockedUntil.toISOString() };
  }
  if (otp.expiresAt.getTime() <= now) return { ok: false, error: 'expired' };
  const code = String(input.code ?? '').replace(/\D/g, '');
  // Security review H2: count the try ATOMICALLY before comparing, so parallel
  // guesses cannot all read the same counter. A lock that has run out starts
  // the count again (prototype: 3 more tries).
  const nowDate = new Date(now);
  const bumped = await db
    .update(credentialOtps)
    .set({
      attempts: sql`case when ${credentialOtps.lockedUntil} is not null and ${credentialOtps.lockedUntil} <= ${nowDate} then 1 else ${credentialOtps.attempts} + 1 end`,
      lockedUntil: sql`case when ${credentialOtps.lockedUntil} <= ${nowDate} then null else ${credentialOtps.lockedUntil} end`,
    })
    .where(
      and(
        eq(credentialOtps.id, otp.id),
        isNull(credentialOtps.consumedAt),
        or(isNull(credentialOtps.lockedUntil), sql`${credentialOtps.lockedUntil} <= ${nowDate}`),
      ),
    )
    .returning({ attempts: credentialOtps.attempts, lockedUntil: credentialOtps.lockedUntil });
  const attempts = bumped[0]?.attempts;
  if (attempts == null) {
    const [cur] = await db.select({ lockedUntil: credentialOtps.lockedUntil }).from(credentialOtps).where(eq(credentialOtps.id, otp.id)).limit(1);
    if (cur?.lockedUntil) return { ok: false, error: 'locked', lockedUntil: cur.lockedUntil.toISOString() };
    throw new CredentialsError('not_found', 404);
  }
  if (attempts > MAX_TRIES || code.length !== 6 || !otpMatches(otp.id, code, otp.codeHash)) {
    if (attempts >= MAX_TRIES) {
      const lockedUntil = new Date(now + LOCK_MS);
      await db.update(credentialOtps).set({ attempts: 0, lockedUntil }).where(eq(credentialOtps.id, otp.id));
      void recordAuditEvent(ctx, {
        engagementId: acc.dbId,
        action: 'credentials.otp_locked',
        summary: 'entered 3 wrong codes · locked for 60 seconds',
        metadata: { otpId: otp.id, scope: otp.scope },
      });
      return { ok: false, error: 'locked', lockedUntil: lockedUntil.toISOString() };
    }
    return { ok: false, error: 'wrong_code', triesLeft: MAX_TRIES - attempts };
  }

  // Consume atomically: only one verify can turn this OTP into a grant.
  const consumed = await db
    .update(credentialOtps)
    .set({ consumedAt: new Date(now) })
    .where(and(eq(credentialOtps.id, otp.id), isNull(credentialOtps.consumedAt)))
    .returning({ id: credentialOtps.id });
  if (!consumed.length) throw new CredentialsError('not_found', 404);

  const expiresAt = new Date(now + SESSION_MS);
  const [g] = await db
    .insert(credentialAccessGrants)
    .values({
      engagementId: acc.dbId,
      profileId: ctx.userId,
      mode: otp.mode,
      scope: otp.scope,
      expiresAt,
      approvedBy: otp.approverProfileId,
      otpId: otp.id,
    })
    .returning({ id: credentialAccessGrants.id });

  const built = await build(ctx, acc);
  const label = scopeLabel(built.payload.sheets, built.payload.ids, otp.scope);
  const approver = otp.approverName ?? 'the Project Manager';
  const mode = otp.mode as CredMode;
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: mode === 'reveal' ? 'credentials.reveal' : mode === 'edit' ? 'credentials.edit' : 'credentials.preview',
    summary:
      mode === 'reveal'
        ? `revealed ${label} · OTP approved by ${approver}`
        : `started ${verbOf(mode)} · ${label} · OTP approved by ${approver}`,
    metadata: { scope: otp.scope, mode, grantId: g!.id, approvedBy: otp.approverProfileId },
  });
  return { ok: true, grant: { id: g!.id, mode, scope: otp.scope, expiresAt: expiresAt.toISOString() } };
}

/** Lock / Hide: end the caller's live grants on exactly this scope. */
export async function lockCredentialScope(ctx: AuthContext, input: { engagementId?: string | null; scope: string }): Promise<void> {
  if (!isValidScope(input.scope)) throw new CredentialsError('invalid_scope', 400);
  const acc = await resolveAccess(ctx, input.engagementId);
  const ended = await db
    .update(credentialAccessGrants)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(credentialAccessGrants.engagementId, acc.dbId),
        eq(credentialAccessGrants.profileId, ctx.userId),
        eq(credentialAccessGrants.scope, input.scope),
        isNull(credentialAccessGrants.revokedAt),
        gt(credentialAccessGrants.expiresAt, new Date()),
      ),
    )
    .returning({ id: credentialAccessGrants.id });
  if (ended.length) {
    const built = await build(ctx, acc);
    void recordAuditEvent(ctx, {
      engagementId: acc.dbId,
      action: 'credentials.lock',
      summary: `${input.scope.startsWith('cell:') ? 'hid' : 'locked'} ${scopeLabel(built.payload.sheets, built.payload.ids, input.scope)}`,
      metadata: { scope: input.scope },
    });
  }
}

/* ------------------------------------------------------------------ */
/* writes                                                              */
/* ------------------------------------------------------------------ */

async function requireEdit(ctx: AuthContext, acc: Access, key: string) {
  if (acc.staff) return;
  const grants = await liveGrants(ctx, acc.dbId);
  if (!canEdit(grants, key)) throw new CredentialsError('edit_grant_required', 403);
}

async function requireSheetEdit(ctx: AuthContext, acc: Access, sheet: CredSheet) {
  if (acc.staff) return;
  const grants = await liveGrants(ctx, acc.dbId);
  if (!grants.some((g) => g.mode === 'edit' && (g.scope === 'page' || g.scope === `tab:${sheet}`))) {
    throw new CredentialsError('edit_grant_required', 403);
  }
}

async function upsertStored(
  acc: Access,
  ctx: AuthContext,
  sheet: CredSheet,
  rowKey: string,
  mutate: (cur: { fields: Record<string, string>; secrets: Record<string, string>; edited: Record<string, boolean> }) => void,
  ordinal?: number,
) {
  const [cur] = await db
    .select()
    .from(engagementCredentials)
    .where(and(eq(engagementCredentials.engagementId, acc.dbId), eq(engagementCredentials.sheet, sheet), eq(engagementCredentials.rowKey, rowKey)))
    .limit(1);
  const aad = aadOf(acc.dbId, sheet, rowKey);
  const state = {
    fields: { ...(cur?.fields ?? {}) },
    secrets: decryptSecrets(cur?.secretCiphertext, aad),
    edited: { ...(cur?.edited ?? {}) },
  };
  mutate(state);
  const values = {
    fields: state.fields,
    secretCiphertext: encryptSecrets(state.secrets, aad),
    edited: state.edited,
    updatedAt: new Date(),
    updatedBy: ctx.userId,
  };
  if (cur) {
    await db.update(engagementCredentials).set(values).where(eq(engagementCredentials.id, cur.id));
  } else {
    await db.insert(engagementCredentials).values({ engagementId: acc.dbId, sheet, rowKey, ordinal: ordinal ?? 0, ...values });
  }
}

const STATUSES = new Set(['Active', 'Pending', 'Expired', 'Not applicable']);

/**
 * Save one cell. `restore` = Undo: put back the previous value and its
 * Edited flag (an auto value that was never edited goes back to "Auto").
 */
export async function updateCredentialCell(
  ctx: AuthContext,
  input: { engagementId?: string | null; key: string; value: string; restore?: { edited: boolean } },
): Promise<CredentialsPayload> {
  const p = parseCellKey(input.key);
  if (!p || !SHEETS.includes(p.sheet as CredSheet)) throw new CredentialsError('invalid_cell', 400);
  const sheet = p.sheet as CredSheet;
  const value = String(input.value ?? '').trim().slice(0, 2000);
  const acc = await resolveAccess(ctx, input.engagementId);
  await requireEdit(ctx, acc, input.key);
  const before = await build(ctx, acc);
  const sh = before.payload.sheets[sheet];

  // Which stored row / field does this cell live in?
  let rowKey: string;
  let field: string;
  let secret = false;
  let isStatus = false;
  if (sheet === 'kyc') {
    if (p.row === 'h') {
      if (!sh.cols.some((c) => c.key === p.col && c.hdr)) throw new CredentialsError('invalid_cell', 400);
      rowKey = p.col;
      field = KYC_NAME_FIELD;
    } else {
      if (!KYC_ROWS.some((r) => r.key === p.row) || !sh.cols.some((c) => c.key === p.col && c.hdr)) throw new CredentialsError('invalid_cell', 400);
      rowKey = p.col;
      field = p.row;
      secret = isSecretCell('kyc', p.row, p.col);
    }
  } else {
    const row = sh.rows.find((r) => r.key === p.row && !r.spacer);
    const col = SHEET_COLS[sheet].find((c) => c.key === p.col);
    if (!row || !col || col.k === 'sno') throw new CredentialsError('invalid_cell', 400);
    rowKey = p.row;
    field = p.col;
    secret = Boolean(col.s);
    isStatus = col.k === 'status';
    if (isStatus && !STATUSES.has(value)) throw new CredentialsError('invalid_status', 400);
  }
  if (!value && !input.restore) throw new CredentialsError('empty_value', 400);

  const label = cellLabel(before.payload.sheets, before.payload.ids, input.key);
  const autoKey = sheet === 'kyc' ? `kyc|${p.row}|${p.col}` : `${sheet}|${p.row}|${p.col}`;
  const hasAuto = before.derived.auto.has(autoKey);
  await upsertStored(acc, ctx, sheet, rowKey, (cur) => {
    const target = secret ? cur.secrets : cur.fields;
    if (input.restore) {
      if (hasAuto && !input.restore.edited) {
        delete target[field];
        delete cur.edited[field];
      } else {
        if (value) target[field] = value;
        else delete target[field];
        if (input.restore.edited) cur.edited[field] = true;
        else delete cur.edited[field];
      }
    } else {
      target[field] = value;
      if (hasAuto) cur.edited[field] = true;
    }
  });
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: input.restore ? 'credentials.undo' : 'credentials.cell_updated',
    summary: input.restore
      ? `undid the change to ${label}`
      : isStatus
        ? `changed ${label} to ${value}`
        : `edited ${label}`,
    metadata: { key: input.key },
  });
  return (await build(ctx, acc)).payload;
}

/** Add a row (Login / Other) or a director column (Directors KYC). */
export async function addCredentialRow(
  ctx: AuthContext,
  input: { engagementId?: string | null; sheet: CredSheet },
): Promise<{ rowKey: string; payload: CredentialsPayload }> {
  if (!['login', 'other', 'kyc'].includes(input.sheet)) throw new CredentialsError('invalid_sheet', 400);
  const acc = await resolveAccess(ctx, input.engagementId);
  await requireSheetEdit(ctx, acc, input.sheet);
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`coalesce(max(${engagementCredentials.ordinal}), 0)` })
    .from(engagementCredentials)
    .where(and(eq(engagementCredentials.engagementId, acc.dbId), eq(engagementCredentials.sheet, input.sheet)));
  const rowKey = input.sheet === 'kyc' ? `director:custom:${randomUUID()}` : `custom:${randomUUID()}`;
  const before = await build(ctx, acc);
  const sh = before.payload.sheets[input.sheet];
  await db.insert(engagementCredentials).values({
    engagementId: acc.dbId,
    sheet: input.sheet,
    rowKey,
    ordinal: Number(n) + 1,
    fields: input.sheet === 'login' ? { status: 'Pending' } : {},
    edited: {},
    updatedBy: ctx.userId,
  });
  const payload = (await build(ctx, acc)).payload;
  const letter = payload.sheets.kyc.cols.length - 1;
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'credentials.row_added',
    summary:
      input.sheet === 'kyc'
        ? `added a director column (${String.fromCharCode(65 + Math.min(letter, 25))}) to Directors KYC`
        : `added row ${sh.rows.length + 1} to ${tabLabel(input.sheet)}`,
    metadata: { sheet: input.sheet, rowKey },
  });
  return { rowKey, payload };
}

/** Undo of Add row / Add director: only custom rows can be removed. */
export async function removeCredentialRow(
  ctx: AuthContext,
  input: { engagementId?: string | null; sheet: CredSheet; rowKey: string },
): Promise<CredentialsPayload> {
  if (!input.rowKey.startsWith('custom:') && !input.rowKey.startsWith('director:custom:')) throw new CredentialsError('invalid_row', 400);
  const acc = await resolveAccess(ctx, input.engagementId);
  await requireSheetEdit(ctx, acc, input.sheet);
  const before = await build(ctx, acc);
  const idx = input.sheet === 'kyc'
    ? before.payload.sheets.kyc.cols.findIndex((c) => c.key === input.rowKey)
    : before.payload.sheets[input.sheet].rows.findIndex((r) => r.key === input.rowKey);
  const del = await db
    .delete(engagementCredentials)
    .where(
      and(
        eq(engagementCredentials.engagementId, acc.dbId),
        eq(engagementCredentials.sheet, input.sheet),
        eq(engagementCredentials.rowKey, input.rowKey),
      ),
    )
    .returning({ id: engagementCredentials.id });
  if (del.length) {
    void recordAuditEvent(ctx, {
      engagementId: acc.dbId,
      action: 'credentials.row_removed',
      summary:
        input.sheet === 'kyc'
          ? `removed the new director column (${String.fromCharCode(65 + Math.max(0, Math.min(idx, 25)))})`
          : `removed row ${idx + 1} from ${tabLabel(input.sheet)}`,
      metadata: { sheet: input.sheet, rowKey: input.rowKey },
    });
  }
  return (await build(ctx, acc)).payload;
}

/* ------------------------------------------------------------------ */
/* access log                                                          */
/* ------------------------------------------------------------------ */

export async function listCredentialsLog(ctx: AuthContext, engagementId?: string | null): Promise<CredentialsLogEntry[]> {
  const acc = await resolveAccess(ctx, engagementId);
  const rows = await db
    .select({
      id: auditEvents.id,
      at: auditEvents.createdAt,
      name: auditEvents.actorName,
      email: auditEvents.actorEmail,
      summary: auditEvents.summary,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.engagementId, acc.dbId),
        or(like(auditEvents.action, 'credentials.%'), eq(auditEvents.action, 'identifiers.reveal')),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(200);
  // clients never see staff e-mail addresses (security review M2)
  const who = (r: (typeof rows)[number]) => r.name?.trim() || (acc.staff ? r.email : null) || 'Someone';
  return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), text: `${who(r)} ${r.summary.replace(/[^\s<>()@,;:]+@[^\s<>()@,;:]+\.[a-z]{2,}/gi, acc.staff ? '$&' : 'a colleague')}` }));
}

/* ------------------------------------------------------------------ */
/* PAN / TAN password reveal (Home › Company IDs, v7p_ids_password)     */
/* ------------------------------------------------------------------ */

export type IdentifierRevealOutcome =
  | { ok: true; value: string }
  | { ok: false; error: 'wrong_password'; triesLeft: number }
  | { ok: false; error: 'locked'; lockedUntil: string }
  | { ok: false; error: 'not_recorded' };

export async function revealIdentifier(
  ctx: AuthContext,
  input: { field: 'pan' | 'tan'; password: string },
): Promise<IdentifierRevealOutcome> {
  if (input.field !== 'pan' && input.field !== 'tan') throw new CredentialsError('invalid_field', 400);
  if (ctx.role !== 'client') throw new CredentialsError('forbidden', 403);
  const acc = await resolveAccess(ctx, null);
  const now = Date.now();
  const [att] = await db.select().from(identifierRevealAttempts).where(eq(identifierRevealAttempts.profileId, ctx.userId)).limit(1);
  if (att?.lockedUntil && att.lockedUntil.getTime() > now) {
    return { ok: false, error: 'locked', lockedUntil: att.lockedUntil.toISOString() };
  }
  const [me] = await db.select({ hash: profiles.passwordHash }).from(profiles).where(eq(profiles.id, ctx.userId)).limit(1);
  const ok = Boolean(me?.hash) && (await bcrypt.compare(String(input.password ?? ''), me!.hash!));
  const label = input.field.toUpperCase();
  if (!ok) {
    const prior = att?.lockedUntil ? 0 : (att?.failures ?? 0);
    const failures = prior + 1;
    const lockedUntil = failures >= MAX_TRIES ? new Date(now + LOCK_MS) : null;
    const values = { failures: lockedUntil ? 0 : failures, lockedUntil, updatedAt: new Date(now) };
    await db
      .insert(identifierRevealAttempts)
      .values({ profileId: ctx.userId, ...values })
      .onConflictDoUpdate({ target: identifierRevealAttempts.profileId, set: values });
    if (lockedUntil) {
      void recordAuditEvent(ctx, {
        engagementId: acc.dbId,
        action: 'identifiers.reveal_locked',
        summary: `entered a wrong password 3 times to show the ${label} · locked for 60 seconds`,
        metadata: { field: input.field },
      });
      return { ok: false, error: 'locked', lockedUntil: lockedUntil.toISOString() };
    }
    return { ok: false, error: 'wrong_password', triesLeft: MAX_TRIES - failures };
  }
  if (att) {
    await db
      .update(identifierRevealAttempts)
      .set({ failures: 0, lockedUntil: null, updatedAt: new Date(now) })
      .where(eq(identifierRevealAttempts.profileId, ctx.userId));
  }
  const state = checklistStateForViewer(ctx, checklistStateFromRow(acc.row));
  const value = identifiersFromState(state as never)[input.field];
  if (!value) return { ok: false, error: 'not_recorded' };
  void recordAuditEvent(ctx, {
    engagementId: acc.dbId,
    action: 'identifiers.reveal',
    summary: `showed the company ${label} for 60 seconds · password confirmed`,
    metadata: { field: input.field },
  });
  return { ok: true, value };
}
