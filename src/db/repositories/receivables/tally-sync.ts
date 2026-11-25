import 'server-only';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { and, desc, eq, inArray, isNotNull, isNull, lt, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, receivableSheets, tallyConnectors, tallySyncJobs } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isValidDbRole } from '@/lib/auth';
import { isReceivablesStaffRole } from '@/lib/receivables/roles';
import { mapReceiptVouchers, mapSalesVouchers, periodLabel } from '@/lib/receivables/tally-live/map';
import {
  ONLINE_MS,
  PC_OFF_MESSAGE,
  PC_STOPPED_MESSAGE,
  QUEUED_TTL_MS,
  RUNNING_TTL_MS,
  type PairingCodeDto,
  type TallyJobDto,
  type TallyJobResult,
  type TallyJobStatus,
  type TallyJobType,
  type TallyStatusDto,
} from '@/lib/receivables/tally-live/wire';
import { stageTallyImport, stageTallyReceipts } from './imports';
import { ISO_DATE, UUID, conflict, invalid, logChange, notFound, scopedSheet } from './shared';
import { assertNotDemo } from '@/lib/demo-logins';

/**
 * RECEIVABLES — Tally live sync (docs/specs/receivables/TALLY-LIVE.md).
 *
 * Staff functions take an `AuthContext` and go through `scopedSheet`, like the rest of receivables.
 *
 * Connector functions (`pairConnector`, `connectorByToken`, `connectorHello`, `claimNextJob`,
 * `saveJobResult`) have no user session: the connector on the Tally PC is authenticated by the
 * sha256 of its bearer token (or, once, of its pairing code), and only ever reaches its own sheet.
 * When a result is staged, the work runs as the person who pressed Sync, rebuilt from their profile
 * (as `askRunActor` does for Ask jobs), so `scopedSheet` checks that they may still edit the sheet.
 */

export type ConnectorRow = typeof tallyConnectors.$inferSelect;
type JobRow = typeof tallySyncJobs.$inferSelect;

const PAIRING_TTL_MS = 10 * 60_000;
/** No 0/O, 1/I/L: the code is read off a screen and typed on another PC. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** The longest period one sync may cover. */
const MAX_DAYS = 400;

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

function newPairingCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

const newToken = () => `tc_${randomBytes(32).toString('base64url')}`;

const ACTIVE: TallyJobStatus[] = ['queued', 'running'];

function toJobDto(row: JobRow, requestedByName: string | null = null): TallyJobDto {
  return {
    id: row.id,
    type: row.type === 'receipts' ? 'receipts' : 'sales',
    from: String(row.fromDate),
    to: String(row.toDate),
    status: row.status as TallyJobStatus,
    error: row.error,
    stats: row.stats ?? null,
    requestedByName,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

/**
 * Closes the sheet's jobs nobody finished: a queued job older than 2 minutes expires (the PC is off
 * or the connector is not running), a running job older than 10 minutes fails.
 */
async function expireStale(sheetId: string, now: Date): Promise<void> {
  await db
    .update(tallySyncJobs)
    .set({ status: 'expired', error: PC_OFF_MESSAGE, finishedAt: now })
    .where(and(eq(tallySyncJobs.sheetId, sheetId), eq(tallySyncJobs.status, 'queued'), lt(tallySyncJobs.createdAt, new Date(now.getTime() - QUEUED_TTL_MS))));
  await db
    .update(tallySyncJobs)
    .set({ status: 'failed', error: PC_STOPPED_MESSAGE, finishedAt: now })
    .where(and(eq(tallySyncJobs.sheetId, sheetId), eq(tallySyncJobs.status, 'running'), lt(tallySyncJobs.startedAt, new Date(now.getTime() - RUNNING_TTL_MS))));
}

/** The sheet's paired, not revoked connector. */
async function liveConnector(sheetId: string): Promise<ConnectorRow | null> {
  const [row] = await db
    .select()
    .from(tallyConnectors)
    .where(and(eq(tallyConnectors.sheetId, sheetId), isNull(tallyConnectors.revokedAt), isNotNull(tallyConnectors.tokenHash)))
    .orderBy(desc(tallyConnectors.pairedAt))
    .limit(1);
  return row ?? null;
}

/* ───────────────────────────── staff ───────────────────────────── */

/**
 * A pairing code for the sheet: 8 characters, valid 10 minutes, returned once (only its sha256 is
 * kept). An earlier unused code of the sheet stops working. The live connector keeps working until
 * the new code is used.
 */
export async function createPairingCode(ctx: AuthContext, sheetId: string, now = new Date()): Promise<PairingCodeDto> {
  assertNotDemo(ctx, 'createPairingCode');
  const sheet = await scopedSheet(ctx, sheetId);
  const code = newPairingCode();
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
  await db
    .update(tallyConnectors)
    .set({ revokedAt: now, pairingCodeHash: null })
    .where(and(eq(tallyConnectors.sheetId, sheet.id), isNull(tallyConnectors.tokenHash), isNull(tallyConnectors.revokedAt)));
  await db.insert(tallyConnectors).values({ sheetId: sheet.id, pairingCodeHash: sha256(code), pairingExpiresAt: expiresAt, createdBy: ctx.userId });
  await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: 'Tally connection code made', affectsPage: false });
  return { code, expiresAt: expiresAt.toISOString() };
}

/** Disconnect: the sheet's connector and any unused code stop working, and a waiting sync ends. */
export async function revokeConnector(ctx: AuthContext, sheetId: string, now = new Date()): Promise<{ revoked: number }> {
  assertNotDemo(ctx, 'revokeConnector');
  const sheet = await scopedSheet(ctx, sheetId);
  const rows = await db
    .update(tallyConnectors)
    .set({ revokedAt: now, pairingCodeHash: null })
    .where(and(eq(tallyConnectors.sheetId, sheet.id), isNull(tallyConnectors.revokedAt)))
    .returning({ id: tallyConnectors.id });
  await db
    .update(tallySyncJobs)
    .set({ status: 'failed', error: 'Tally was disconnected.', finishedAt: now })
    .where(and(eq(tallySyncJobs.sheetId, sheet.id), inArray(tallySyncJobs.status, ACTIVE)));
  if (rows.length) await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: 'Tally disconnected', affectsPage: false });
  return { revoked: rows.length };
}

/** The Sync button's state: the connector (online when seen in the last 2 minutes), a waiting code, the job in progress and the last few. */
export async function getTallyStatus(ctx: AuthContext, sheetId: string, now = new Date()): Promise<TallyStatusDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  await expireStale(sheet.id, now);
  const connector = await liveConnector(sheet.id);
  const [code] = await db
    .select({ expiresAt: tallyConnectors.pairingExpiresAt })
    .from(tallyConnectors)
    .where(and(eq(tallyConnectors.sheetId, sheet.id), isNull(tallyConnectors.revokedAt), isNull(tallyConnectors.tokenHash), isNotNull(tallyConnectors.pairingCodeHash)))
    .orderBy(desc(tallyConnectors.createdAt))
    .limit(1);
  const recent = await recentJobs(sheet.id, 5);
  const active = recent.find((j) => j.status === 'queued' || j.status === 'running') ?? null;
  return {
    connector: connector
      ? {
          id: connector.id,
          name: connector.name,
          tallyCompany: connector.tallyCompany,
          version: connector.version,
          tallyReachable: connector.tallyReachable,
          lastSeenAt: connector.lastSeenAt ? connector.lastSeenAt.toISOString() : null,
          pairedAt: connector.pairedAt ? connector.pairedAt.toISOString() : null,
          online: Boolean(connector.lastSeenAt && now.getTime() - connector.lastSeenAt.getTime() < ONLINE_MS),
        }
      : null,
    pairingExpiresAt: code?.expiresAt && code.expiresAt > now ? code.expiresAt.toISOString() : null,
    activeJob: active,
    recent,
  };
}

async function recentJobs(sheetId: string, limit: number): Promise<TallyJobDto[]> {
  const rows = await db
    .select({ job: tallySyncJobs, name: profiles.name })
    .from(tallySyncJobs)
    .leftJoin(profiles, eq(profiles.id, tallySyncJobs.requestedBy))
    .where(eq(tallySyncJobs.sheetId, sheetId))
    .orderBy(desc(tallySyncJobs.createdAt))
    .limit(limit);
  return rows.map((r) => toJobDto(r.job, r.name ?? null));
}

/**
 * Queues one sync for the connector to pick up. Refused with `tally_not_connected` when the sheet
 * has no connector and with `sync_running` while another sync of the sheet is queued or running
 * (the partial unique index also refuses a race between two clicks).
 */
export async function queueSyncJob(ctx: AuthContext, sheetId: string, input: { type: unknown; from: unknown; to: unknown }, now = new Date()): Promise<TallyJobDto> {
  assertNotDemo(ctx, 'queueSyncJob');
  const sheet = await scopedSheet(ctx, sheetId);
  const type = input.type === 'sales' || input.type === 'receipts' ? (input.type as TallyJobType) : null;
  if (!type) throw invalid('sync_type');
  const from = typeof input.from === 'string' && ISO_DATE.test(input.from) ? input.from : null;
  const to = typeof input.to === 'string' && ISO_DATE.test(input.to) ? input.to : null;
  if (!from || !to || Number.isNaN(Date.parse(`${from}T00:00:00Z`)) || Number.isNaN(Date.parse(`${to}T00:00:00Z`))) throw invalid('sync_period');
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (days < 0 || days > MAX_DAYS) throw invalid('sync_period');

  const connector = await liveConnector(sheet.id);
  if (!connector) throw conflict('tally_not_connected');
  await expireStale(sheet.id, now);
  const [active] = await db
    .select({ id: tallySyncJobs.id })
    .from(tallySyncJobs)
    .where(and(eq(tallySyncJobs.sheetId, sheet.id), inArray(tallySyncJobs.status, ACTIVE)))
    .limit(1);
  if (active) throw conflict('sync_running');
  try {
    const [row] = await db.insert(tallySyncJobs).values({ sheetId: sheet.id, connectorId: connector.id, type, fromDate: from, toDate: to, requestedBy: ctx.userId }).returning();
    return toJobDto(row, ctx.name);
  } catch (e) {
    if ((e as { code?: string })?.code === '23505') throw conflict('sync_running');
    throw e;
  }
}

export async function listRecentJobs(ctx: AuthContext, sheetId: string, limit = 10): Promise<TallyJobDto[]> {
  const sheet = await scopedSheet(ctx, sheetId);
  return recentJobs(sheet.id, Math.max(1, Math.min(50, limit)));
}

export async function getSyncJob(ctx: AuthContext, sheetId: string, jobId: string, now = new Date()): Promise<TallyJobDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  if (!UUID.test(jobId ?? '')) throw notFound();
  await expireStale(sheet.id, now);
  const [row] = await db
    .select({ job: tallySyncJobs, name: profiles.name })
    .from(tallySyncJobs)
    .leftJoin(profiles, eq(profiles.id, tallySyncJobs.requestedBy))
    .where(and(eq(tallySyncJobs.id, jobId), eq(tallySyncJobs.sheetId, sheet.id)))
    .limit(1);
  if (!row) throw notFound();
  return toJobDto(row.job, row.name ?? null);
}

/* ─────────────────────── connector (no session) ─────────────────────── */

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Pairs a connector with an unused, unexpired code. The token is returned once; only its sha256 is
 * kept. Every other connector of the sheet is revoked. Null when the code is unknown, used or old.
 */
export async function pairConnector(input: { code: string; name?: unknown; version?: unknown; tallyCompany?: unknown }, now = new Date()): Promise<{ token: string; sheetName: string } | null> {
  const code = normaliseCode(input.code ?? '');
  if (code.length !== 8) return null;
  const [row] = await db
    .select({ connector: tallyConnectors, sheetName: receivableSheets.name })
    .from(tallyConnectors)
    .innerJoin(receivableSheets, eq(receivableSheets.id, tallyConnectors.sheetId))
    .where(and(eq(tallyConnectors.pairingCodeHash, sha256(code)), isNull(tallyConnectors.revokedAt), isNull(tallyConnectors.tokenHash)))
    .limit(1);
  if (!row || !row.connector.pairingExpiresAt || row.connector.pairingExpiresAt <= now) return null;
  const token = newToken();
  const paired = await db
    .update(tallyConnectors)
    .set({
      tokenHash: sha256(token),
      pairingCodeHash: null,
      pairingExpiresAt: null,
      name: clip(input.name, 100),
      version: clip(input.version, 40) || null,
      tallyCompany: clip(input.tallyCompany, 200) || null,
      pairedAt: now,
      lastSeenAt: now,
    })
    // Only while still unused, so two connectors racing with one code cannot both pair.
    .where(and(eq(tallyConnectors.id, row.connector.id), isNull(tallyConnectors.tokenHash), isNull(tallyConnectors.revokedAt)))
    .returning({ id: tallyConnectors.id });
  if (!paired.length) return null;
  await db
    .update(tallyConnectors)
    .set({ revokedAt: now, pairingCodeHash: null })
    .where(and(eq(tallyConnectors.sheetId, row.connector.sheetId), ne(tallyConnectors.id, row.connector.id), isNull(tallyConnectors.revokedAt)));
  await logChange({ sheetId: row.connector.sheetId, invoiceId: null, actorId: row.connector.createdBy, summary: `Tally connected from ${clip(input.name, 100) || 'a PC'}`, affectsPage: false });
  return { token, sheetName: row.sheetName };
}

/** The live connector holding this token, or null (unknown or revoked). */
export async function connectorByToken(token: string | null | undefined): Promise<ConnectorRow | null> {
  if (!token || !token.startsWith('tc_') || token.length > 200) return null;
  const [row] = await db
    .select()
    .from(tallyConnectors)
    .where(and(eq(tallyConnectors.tokenHash, sha256(token)), isNull(tallyConnectors.revokedAt)))
    .limit(1);
  return row ?? null;
}

/** The connector's heartbeat: version, the Tally company open, whether TallyPrime answered. */
export async function connectorHello(connector: ConnectorRow, input: { version?: unknown; tallyCompany?: unknown; tallyReachable?: unknown }, now = new Date()): Promise<void> {
  await db
    .update(tallyConnectors)
    .set({
      lastSeenAt: now,
      version: clip(input.version, 40) || connector.version,
      tallyCompany: clip(input.tallyCompany, 200) || connector.tallyCompany,
      tallyReachable: typeof input.tallyReachable === 'boolean' ? input.tallyReachable : connector.tallyReachable,
    })
    .where(eq(tallyConnectors.id, connector.id));
}

/** Marks the connector as seen now (each long-poll). */
export async function touchConnector(connector: ConnectorRow, now = new Date()): Promise<void> {
  await db.update(tallyConnectors).set({ lastSeenAt: now }).where(eq(tallyConnectors.id, connector.id));
}

/**
 * The oldest queued job of the connector's sheet, now marked running and given to this connector;
 * null when none waits. Stale jobs are closed first, so a job the PC missed is not run late.
 */
export async function claimNextJob(connector: ConnectorRow, now = new Date()): Promise<{ id: string; type: TallyJobType; from: string; to: string } | null> {
  await expireStale(connector.sheetId, now);
  const [next] = await db
    .select()
    .from(tallySyncJobs)
    .where(and(eq(tallySyncJobs.sheetId, connector.sheetId), eq(tallySyncJobs.status, 'queued')))
    .orderBy(tallySyncJobs.createdAt)
    .limit(1);
  if (!next) return null;
  const [claimed] = await db
    .update(tallySyncJobs)
    .set({ status: 'running', startedAt: now, connectorId: connector.id })
    .where(and(eq(tallySyncJobs.id, next.id), eq(tallySyncJobs.status, 'queued')))
    .returning();
  if (!claimed) return null;
  return { id: claimed.id, type: claimed.type === 'receipts' ? 'receipts' : 'sales', from: String(claimed.fromDate), to: String(claimed.toDate) };
}

/**
 * Rebuilds the AuthContext of the person who pressed Sync, for staging with no session. An inactive
 * profile or a role that cannot edit receivables gets null; `scopedSheet` then checks the sheet.
 */
export async function jobActor(userId: string | null): Promise<AuthContext | null> {
  if (!userId) return null;
  const [p] = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name, role: profiles.role, internId: profiles.internId, clientId: profiles.clientId, status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!p || p.status !== 'active' || !isValidDbRole(p.role) || !isReceivablesStaffRole(p.role)) return null;
  return {
    userId: p.id,
    email: p.email ?? '',
    name: p.name?.trim() || p.email?.split('@')[0] || 'User',
    role: p.role,
    internId: p.internId ?? undefined,
    clientId: p.clientId ?? undefined,
  };
}

async function finishJob(jobId: string, set: Partial<typeof tallySyncJobs.$inferInsert>, now: Date): Promise<void> {
  await db.update(tallySyncJobs).set({ ...set, finishedAt: now }).where(eq(tallySyncJobs.id, jobId));
}

export class TallyJobError extends Error {
  constructor(readonly status: 404 | 409) {
    super(status === 404 ? 'not_found' : 'not_running');
  }
}

/**
 * Saves the connector's answer for a running job of its own sheet. An `ok: false` answer fails the
 * job with the connector's message. Otherwise the vouchers are mapped and staged for approval as
 * the person who pressed Sync; the job is done with its counts. Answers the number of rows staged.
 */
export async function saveJobResult(connector: ConnectorRow, jobId: string, result: TallyJobResult, now = new Date()): Promise<{ staged: number }> {
  if (!UUID.test(jobId ?? '')) throw new TallyJobError(404);
  const [job] = await db
    .select()
    .from(tallySyncJobs)
    .where(and(eq(tallySyncJobs.id, jobId), eq(tallySyncJobs.sheetId, connector.sheetId)))
    .limit(1);
  if (!job) throw new TallyJobError(404);
  if (job.status !== 'running') throw new TallyJobError(409);
  await touchConnector(connector, now);

  if (result.ok === false) {
    await finishJob(job.id, { status: 'failed', error: clip(result.error, 500) || 'The connector could not read Tally.' }, now);
    return { staged: 0 };
  }
  const ctx = await jobActor(job.requestedBy);
  if (!ctx) {
    await finishJob(job.id, { status: 'failed', error: 'The person who asked for this sync can no longer edit the sheet.' }, now);
    return { staged: 0 };
  }
  const from = String(job.fromDate);
  const to = String(job.toDate);
  const period = periodLabel(from, to);
  const fileName = `Tally sync ${period}`;
  const company = clip(result.company, 200);
  try {
    if (job.type === 'receipts') {
      const mapped = mapReceiptVouchers(result.vouchers, company, period);
      const staged = await stageTallyReceipts(ctx, job.sheetId, fileName, mapped);
      const notes = mapped.skipped.slice(0, 50).map((s) => `${s.voucherNo || 'A receipt'} (${s.partyName || 'no party'}, ₹${s.amount}): ${s.reason}`);
      if (staged.alreadyApplied) notes.unshift(`${staged.alreadyApplied} payment(s) were already applied by an earlier sync.`);
      await finishJob(
        job.id,
        { status: 'done', batchId: staged.batchId, stats: { vouchers: result.vouchers.length, staged: staged.staged, skipped: mapped.skipped.length, receipts: mapped.receiptVouchers, notes } },
        now,
      );
      return { staged: staged.staged };
    }
    const mapped = mapSalesVouchers(result.vouchers, company, period);
    let staged = 0;
    let batchId: string | null = null;
    if (mapped.rows.length) {
      const res = await stageTallyImport(ctx, job.sheetId, fileName, mapped, { source: 'tally_live' });
      batchId = res.batchId;
      // Rows already on the sheet with the same amount (SAME) are not waiting for anyone.
      staged = res.rows.filter((r) => r.batchId === res.batchId && r.kind !== 'same').length;
    }
    await finishJob(
      job.id,
      { status: 'done', batchId, stats: { vouchers: result.vouchers.length, staged, skipped: result.vouchers.length - mapped.rows.length, receipts: 0, notes: mapped.warnings.slice(0, 50) } },
      now,
    );
    return { staged };
  } catch (e) {
    console.error('[tally-sync] staging failed', e instanceof Error ? e.message : e);
    await finishJob(job.id, { status: 'failed', error: 'VCFO could not stage the Tally data. Try again, or import the Excel instead.' }, now);
    return { staged: 0 };
  }
}
