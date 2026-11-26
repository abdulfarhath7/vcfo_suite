import 'server-only';

import { and, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { liveBrowserSessions, profiles, type LiveBrowserViewer } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isAdminOrManager, isValidDbRole } from '@/lib/auth';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { LIVE_SESSION_OPEN, type LiveSessionEndReason, type LiveSessionStatus, type SessionEvent } from '@/lib/live-browser/contract';
import type { LiveSessionView } from '@/lib/live-browser/types';

/**
 * LIVE BROWSER SESSIONS REPOSITORY — `live_browser_sessions` (docs/specs/live-portal-browser/PLAN.md).
 * One row per session on SBC's server browser: state, gate, progress and evidence. Never a cookie,
 * a token, a password, a captcha, an OTP, a value or a screenshot (SAFETY.md G8, proposed G19, G22).
 *
 * >>> ACCESS CONTROL <<<
 *   Staff only (super admin, admin, manager, project lead); clients and developers are refused
 *   before any query. A session is reached through its engagement (`assertEngagementAccess`), so a
 *   lead sees the sessions of the engagements they lead and a manager those they manage. Only the
 *   person who started a session, or an admin or manager in scope, may stop it.
 *   `system*` functions serve the broker's signed callback and the reaper job (no user); they are
 *   called only after the callback's HMAC signature has been checked.
 */

const STAFF = new Set(['super_admin', 'admin', 'manager', 'intern']);
const OPEN = [...LIVE_SESSION_OPEN];
/** Most viewer entries kept on one session (user and IP pairs). */
const MAX_VIEWERS = 50;

export type LiveSessionRow = typeof liveBrowserSessions.$inferSelect;

export class LiveBrowserAccessError extends Error {
  constructor(
    message: 'forbidden' | 'not_found' | 'closed',
    readonly status: 403 | 404 | 409,
  ) {
    super(message);
    this.name = 'LiveBrowserAccessError';
  }
}

export type { LiveSessionView };

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toLiveSessionView(row: LiveSessionRow, companyName: string | null = null): LiveSessionView {
  const status = row.status as LiveSessionStatus;
  return {
    id: row.id,
    engagementId: row.engagementId,
    companyName,
    taskId: row.taskId,
    runId: row.runId,
    startedBy: row.startedBy,
    startedByName: row.startedByName,
    portalHost: row.portalHost,
    portalLoginLabel: row.portalLoginLabel,
    status,
    open: LIVE_SESSION_OPEN.has(status),
    gate: row.gate,
    progressText: row.progressText,
    fieldsTotal: row.fieldsTotal,
    fieldsDone: row.fieldsDone,
    node: row.node,
    egressIp: row.egressIp,
    viewers: row.viewers ?? [],
    createdAt: row.createdAt.toISOString(),
    readyAt: iso(row.readyAt),
    lastActivityAt: row.lastActivityAt.toISOString(),
    endedAt: iso(row.endedAt),
    endReason: row.endReason,
  };
}

function assertStaff(ctx: AuthContext): void {
  if (!STAFF.has(ctx.role)) throw new LiveBrowserAccessError('forbidden', 403);
}

/** The status a session ends with for each reason. */
export function endStatusFor(reason: LiveSessionEndReason): LiveSessionStatus {
  if (reason === 'done') return 'done';
  if (reason === 'cancelled') return 'cancelled';
  if (reason === 'error') return 'failed';
  return 'expired';
}

export interface CreateLiveSessionInput {
  taskId: string;
  portalHost: string;
  portalLoginLabel: string;
}

/** A new `starting` session on an engagement the caller can reach; null when they cannot. */
export async function createLiveSession(
  ctx: AuthContext,
  engagementParam: string,
  input: CreateLiveSessionInput,
): Promise<{ row: LiveSessionRow; companyName: string } | null> {
  assertStaff(ctx);
  const access = await assertEngagementAccess(ctx, engagementParam);
  if (access.ok === false) return null;
  const [row] = await db
    .insert(liveBrowserSessions)
    .values({
      engagementId: access.dbId,
      taskId: input.taskId,
      startedBy: ctx.userId,
      startedByName: ctx.name || null,
      portalHost: input.portalHost,
      portalLoginLabel: input.portalLoginLabel,
      status: 'starting',
    })
    .returning();
  return row ? { row, companyName: access.row.companyName } : null;
}

/** One session the caller can reach, or null. */
export async function getLiveSession(ctx: AuthContext, id: string): Promise<LiveSessionView | null> {
  const found = await loadScoped(ctx, id);
  return found ? toLiveSessionView(found.row, found.companyName) : null;
}

async function loadScoped(ctx: AuthContext, id: string): Promise<{ row: LiveSessionRow; companyName: string } | null> {
  assertStaff(ctx);
  const [row] = await db.select().from(liveBrowserSessions).where(eq(liveBrowserSessions.id, id)).limit(1);
  if (!row) return null;
  const access = await assertEngagementAccess(ctx, row.engagementId);
  return access.ok ? { row, companyName: access.row.companyName } : null;
}

/** The sessions of one engagement, newest first (open ones and the last few closed ones). */
export async function listLiveSessions(ctx: AuthContext, engagementParam: string, opts: { taskId?: string; limit?: number } = {}): Promise<LiveSessionView[] | null> {
  assertStaff(ctx);
  const access = await assertEngagementAccess(ctx, engagementParam);
  if (access.ok === false) return null;
  const rows = await db
    .select()
    .from(liveBrowserSessions)
    .where(and(eq(liveBrowserSessions.engagementId, access.dbId), opts.taskId ? eq(liveBrowserSessions.taskId, opts.taskId) : undefined))
    .orderBy(desc(liveBrowserSessions.createdAt))
    .limit(Math.min(Math.max(opts.limit ?? 10, 1), 50));
  return rows.map((r) => toLiveSessionView(r, access.row.companyName));
}

/**
 * Who may stop this session, or open it with the act role: the person who started it, or an admin
 * or manager in scope. Throws `LiveBrowserAccessError`.
 */
export async function assertSessionOwner(ctx: AuthContext, id: string): Promise<LiveSessionView> {
  const found = await loadScoped(ctx, id);
  if (!found) throw new LiveBrowserAccessError('not_found', 404);
  if (found.row.startedBy !== ctx.userId && !isAdminOrManager(ctx.role)) throw new LiveBrowserAccessError('forbidden', 403);
  return toLiveSessionView(found.row, found.companyName);
}

// ---------- system (signed callback and reaper only) ----------

/**
 * The person who started a session, as an AuthContext, so the broker's callbacks are answered with
 * exactly that person's access (the same checks the session guard makes: an active staff profile,
 * a lead with a lead id, and the demo flag the database agrees with). Null when they may no longer act.
 */
export async function systemSessionOwnerContext(row: Pick<LiveSessionRow, 'startedBy'>, demo: boolean): Promise<AuthContext | null> {
  if (!row.startedBy) return null;
  const [p] = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name, role: profiles.role, internId: profiles.internId, status: profiles.status, isDemo: profiles.isDemo })
    .from(profiles)
    .where(eq(profiles.id, row.startedBy))
    .limit(1);
  if (!p || p.status !== 'active' || !isValidDbRole(p.role) || !STAFF.has(p.role)) return null;
  if (p.role === 'intern' && !p.internId?.trim()) return null;
  if (Boolean(p.isDemo) !== demo) return null;
  return {
    userId: p.id,
    email: p.email ?? '',
    name: p.name?.trim() || p.email?.split('@')[0] || 'User',
    role: p.role as AuthContext['role'],
    internId: p.internId ?? undefined,
    ...(p.isDemo ? { demo: true } : {}),
  };
}

export async function systemGetLiveSession(id: string): Promise<LiveSessionRow | null> {
  const [row] = await db.select().from(liveBrowserSessions).where(eq(liveBrowserSessions.id, id)).limit(1);
  return row ?? null;
}

/** G21: an open session that uses this portal login label, other than `exceptId`. */
export async function systemOpenSessionForLogin(label: string, exceptId?: string): Promise<LiveSessionRow | null> {
  const [row] = await db
    .select()
    .from(liveBrowserSessions)
    .where(
      and(
        sql`lower(${liveBrowserSessions.portalLoginLabel}) = lower(${label})`,
        inArray(liveBrowserSessions.status, OPEN),
        exceptId ? ne(liveBrowserSessions.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Live browser minutes used since the start of this calendar month (UTC), open sessions counted up to now. */
export async function systemBrowserMinutesThisMonth(now = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await db
    .select({ minutes: sql<string>`coalesce(sum(extract(epoch from (coalesce(${liveBrowserSessions.endedAt}, ${now}) - ${liveBrowserSessions.createdAt}))) / 60, 0)` })
    .from(liveBrowserSessions)
    .where(gte(liveBrowserSessions.createdAt, monthStart));
  return Number(row?.minutes ?? 0);
}

export async function systemListOpenSessions(): Promise<LiveSessionRow[]> {
  return db.select().from(liveBrowserSessions).where(inArray(liveBrowserSessions.status, OPEN));
}

/** Links the engine's assist run to the session, once. */
export async function systemSetSessionRun(id: string, runId: string): Promise<void> {
  await db
    .update(liveBrowserSessions)
    .set({ runId })
    .where(and(eq(liveBrowserSessions.id, id), isNull(liveBrowserSessions.runId)));
}

function mergeViewer(list: readonly LiveBrowserViewer[], v: NonNullable<SessionEvent['viewer']>, at: string): LiveBrowserViewer[] {
  const out = [...list];
  const hit = out.find((x) => x.userId === v.userId && x.ip === v.ip);
  if (hit) hit.lastAt = at;
  else out.push({ userId: v.userId, ip: v.ip, firstAt: at, lastAt: at });
  return out.slice(-MAX_VIEWERS);
}

/**
 * Applies one broker event. A closed session takes no more changes, except that its end is
 * recorded once. Text is cut to the column's purpose; no value ever arrives here.
 */
export async function systemApplySessionEvent(id: string, event: SessionEvent, now = new Date()): Promise<LiveSessionRow | null> {
  const row = await systemGetLiveSession(id);
  if (!row) return null;
  const open = LIVE_SESSION_OPEN.has(row.status as LiveSessionStatus);
  if (!open) return row;
  const set: Partial<typeof liveBrowserSessions.$inferInsert> = { lastActivityAt: now };
  if (event.ended) {
    set.status = endStatusFor(event.ended);
    set.endReason = event.ended;
    set.endedAt = now;
    set.gate = null;
  } else if (event.status && LIVE_SESSION_OPEN.has(event.status)) {
    set.status = event.status;
    if (!row.readyAt && event.status !== 'starting') set.readyAt = now;
  }
  if (!event.ended && event.gate !== undefined) set.gate = event.gate;
  if (event.progressText !== undefined) set.progressText = event.progressText ? event.progressText.slice(0, 200) : null;
  if (event.error) set.progressText = event.error.slice(0, 200);
  if (typeof event.fieldsTotal === 'number') set.fieldsTotal = Math.max(0, Math.min(1000, Math.round(event.fieldsTotal)));
  if (typeof event.fieldsDone === 'number') set.fieldsDone = Math.max(0, Math.min(1000, Math.round(event.fieldsDone)));
  if (event.node) set.node = event.node.slice(0, 120);
  if (event.egressIp !== undefined) set.egressIp = event.egressIp ? event.egressIp.slice(0, 64) : null;
  if (event.viewer) set.viewers = mergeViewer(row.viewers ?? [], event.viewer, now.toISOString());
  const [saved] = await db.update(liveBrowserSessions).set(set).where(eq(liveBrowserSessions.id, id)).returning();
  return saved ?? row;
}

/** Ends an open session from Suite's side (stop route, reaper, failed start). */
export async function systemEndSession(id: string, reason: LiveSessionEndReason, progressText?: string): Promise<void> {
  await db
    .update(liveBrowserSessions)
    .set({ status: endStatusFor(reason), endReason: reason, endedAt: new Date(), gate: null, ...(progressText ? { progressText: progressText.slice(0, 200) } : {}) })
    .where(and(eq(liveBrowserSessions.id, id), inArray(liveBrowserSessions.status, OPEN)));
}
