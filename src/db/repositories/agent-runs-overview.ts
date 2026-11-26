import 'server-only';

import { and, desc, eq, gte, inArray, isNull, lte, ne, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  agentOtpRequests,
  assistAgentRuns,
  assistRecipePatches,
  complianceInstances,
  complianceInstanceWorkflow,
  engagements,
  gstReturnRuns,
  liveBrowserSessions,
  profiles,
} from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { listScopedEngagementIds } from '@/db/repositories/engagements';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { cardTasksFor } from '@/lib/card-agents/card-agents';
import {
  agentFacets,
  buildAgentRunItems,
  computeAgentResults,
  filterAgentRuns,
  gstObligationId,
  gstRunMatches,
  istDayStart,
  monthBounds,
  periodStart,
  previousMonth,
  summarizeAgentsToday,
  type AgentResults,
  type AgentRunFilters,
  type AgentRunItem,
  type AgentsTodaySummary,
  type DueOccurrence,
  type GstRunKey,
  type RawAssistRun,
  type RawEngagement,
  type RawGstRun,
  type RawOtpRequest,
  type RawSession,
} from '@/lib/card-agents/overview';

/**
 * AGENT RUNS OVERVIEW REPOSITORY — read only. "Agents today" on the staff home, the control room
 * (Agent runs) and the Agent results page (docs/specs/live-portal-browser/MASTER-PLAN.md screens
 * 1, 9 and 11). It reads `live_browser_sessions`, `assist_agent_runs`, `gst_return_runs` and
 * `agent_otp_requests`, and the compliance occurrences due in the next seven days. The pure
 * shaping is in `src/lib/card-agents/overview.ts`.
 *
 * >>> ACCESS CONTROL <<<
 *   list and summary — staff only. Super admin and admin see every engagement; a manager sees the
 *     engagements they manage; a project lead (intern) sees only the engagements they lead
 *     (`listScopedEngagementIds`, the same scope as the engagement list). Clients and the
 *     developer role are refused before any query.
 *   results and browser usage — firm-wide admins only (`isFirmWideAdmin`).
 * Soft-deleted engagements are left out everywhere.
 */

export class AgentRunsOverviewForbiddenError extends Error {
  constructor(message = 'Not permitted to read agent runs') {
    super(message);
    this.name = 'AgentRunsOverviewForbiddenError';
  }
}

const STAFF = new Set(['super_admin', 'admin', 'manager', 'intern']);
const ROW_LIMIT = 300;

function assertStaff(ctx: AuthContext): void {
  if (!STAFF.has(ctx.role)) throw new AgentRunsOverviewForbiddenError();
}

function assertFirmAdmin(ctx: AuthContext): void {
  if (!isFirmWideAdmin(ctx.role)) throw new AgentRunsOverviewForbiddenError('Only firm admins may read agent results');
}

type Scope = 'all' | string[];

async function scopeOf(ctx: AuthContext): Promise<Scope> {
  return isFirmWideAdmin(ctx.role) ? 'all' : listScopedEngagementIds(ctx);
}

/** The engagement condition for a table's `engagement_id` column, with soft-deleted rows left out. */
function inScope(column: Parameters<typeof inArray>[0], scope: Scope): SQL {
  const live = isNull(engagements.deletedAt);
  return scope === 'all' ? live : and(live, inArray(column, scope))!;
}

const engagementCols = { dbId: engagements.id, slug: engagements.slug, companyName: engagements.companyName };

const toEngagement = (e: { dbId: string; slug: string | null; companyName: string }): RawEngagement => ({
  dbId: e.dbId,
  appId: appEngagementId(e.dbId),
  slug: e.slug,
  companyName: e.companyName,
});

const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function namesFor(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x && UUID.test(x))))];
  if (unique.length === 0) return new Map();
  const rows = await db.select({ id: profiles.id, name: profiles.name, email: profiles.email }).from(profiles).where(inArray(profiles.id, unique));
  return new Map(rows.map((r) => [r.id, r.name?.trim() || r.email]));
}

const GST_OPEN = ['draft', 'consent_needed', 'saving', 'saved', 'checked', 'filing'];
const GST_LABEL: Record<string, string> = {
  figures: 'Figures checked against the books',
  unmatched: 'Unmatched invoices checked',
};

interface LoadedRuns {
  items: AgentRunItem[];
  gstKeys: GstRunKey[];
}

/**
 * Every run in the viewer's scope that started at or after `since` (all of them when null), and
 * every run still open, whatever its age.
 */
async function loadRuns(ctx: AuthContext, scope: Scope, since: Date | null, now: Date): Promise<LoadedRuns> {
  if (scope !== 'all' && scope.length === 0) return { items: [], gstKeys: [] };

  const sessionRows = await db
    .select({ s: liveBrowserSessions, e: engagementCols })
    .from(liveBrowserSessions)
    .innerJoin(engagements, eq(engagements.id, liveBrowserSessions.engagementId))
    .where(and(inScope(liveBrowserSessions.engagementId, scope), since ? or(gte(liveBrowserSessions.createdAt, since), isNull(liveBrowserSessions.endedAt)) : undefined))
    .orderBy(desc(liveBrowserSessions.createdAt))
    .limit(ROW_LIMIT);

  const runRows = await db
    .select({ r: assistAgentRuns, e: engagementCols })
    .from(assistAgentRuns)
    .innerJoin(engagements, eq(engagements.id, assistAgentRuns.engagementId))
    .where(
      and(
        inScope(assistAgentRuns.engagementId, scope),
        since ? or(gte(assistAgentRuns.startedAt, since), inArray(assistAgentRuns.status, ['running', 'waiting_user'])) : undefined,
      ),
    )
    .orderBy(desc(assistAgentRuns.startedAt))
    .limit(ROW_LIMIT);

  // A session's own run may be older than `since` (a long session); fetch the missing ones.
  const haveRun = new Set(runRows.map((r) => r.r.id));
  const missing = sessionRows.map((s) => s.s.runId).filter((id): id is string => Boolean(id && !haveRun.has(id)));
  const extraRuns = missing.length
    ? await db
        .select({ r: assistAgentRuns, e: engagementCols })
        .from(assistAgentRuns)
        .innerJoin(engagements, eq(engagements.id, assistAgentRuns.engagementId))
        .where(and(inScope(assistAgentRuns.engagementId, scope), inArray(assistAgentRuns.id, missing)))
    : [];

  const gstRows = await db
    .select({ g: gstReturnRuns, e: engagementCols })
    .from(gstReturnRuns)
    .innerJoin(engagements, eq(engagements.id, gstReturnRuns.engagementId))
    .where(
      and(
        inScope(gstReturnRuns.engagementId, scope),
        since ? or(gte(gstReturnRuns.createdAt, since), gte(gstReturnRuns.filedAt, since), inArray(gstReturnRuns.status, GST_OPEN)) : undefined,
      ),
    )
    .orderBy(desc(gstReturnRuns.createdAt))
    .limit(ROW_LIMIT);

  const subjectIds = [...sessionRows.map((s) => s.s.id), ...gstRows.map((g) => g.g.id)];
  const otpRows = subjectIds.length
    ? await db
        .select()
        .from(agentOtpRequests)
        .where(and(inArray(agentOtpRequests.subjectId, subjectIds), inArray(agentOtpRequests.subjectType, ['live_browser_session', 'gst_return_run'])))
    : [];

  // The compliance occurrence each GST return files, for the card link.
  const gstEngagements = [...new Set(gstRows.map((g) => g.g.engagementId))];
  const gstObligations = [...new Set(gstRows.map((g) => gstObligationId(g.g.form)).filter((x): x is string => Boolean(x)))];
  const occurrences =
    gstEngagements.length && gstObligations.length
      ? await db
          .select({
            id: complianceInstances.id,
            engagementDbId: complianceInstances.engagementId,
            obligationId: complianceInstances.obligationId,
            periodStart: complianceInstances.periodStart,
            periodEnd: complianceInstances.periodEnd,
          })
          .from(complianceInstances)
          .where(and(inArray(complianceInstances.engagementId, gstEngagements), inArray(complianceInstances.obligationId, gstObligations)))
      : [];

  const checksOf = (checks: Record<string, { by: string; at: string } | undefined>) =>
    Object.entries(checks ?? {})
      .filter((e): e is [string, { by: string; at: string }] => Boolean(e[1]))
      .map(([key, v]) => ({ key, by: v.by, at: v.at }));

  const names = await namesFor([
    ...sessionRows.flatMap((s) => [s.s.startedBy, ...(s.s.viewers ?? []).map((v) => v.userId)]),
    ...gstRows.flatMap((g) => [g.g.createdBy, ...checksOf(g.g.checks as Record<string, { by: string; at: string }>).map((c) => c.by)]),
    ...otpRows.flatMap((o) => [o.requestedBy, o.answeredBy]),
  ]);
  const nameOf = (id: string | null | undefined, fallback: string | null = null) => (id ? (names.get(id) ?? fallback) : fallback);

  const sessions: RawSession[] = sessionRows.map(({ s, e }) => ({
    id: s.id,
    engagement: toEngagement(e),
    taskId: s.taskId,
    runId: s.runId,
    startedByName: s.startedByName ?? nameOf(s.startedBy),
    portalHost: s.portalHost,
    portalLoginLabel: s.portalLoginLabel,
    status: s.status,
    gate: s.gate,
    progressText: s.progressText,
    fieldsTotal: s.fieldsTotal,
    fieldsDone: s.fieldsDone,
    egressIp: s.egressIp,
    viewers: (s.viewers ?? []).map((v) => ({ name: nameOf(v.userId, 'A staff member'), ip: v.ip, firstAt: v.firstAt, lastAt: v.lastAt })),
    createdAt: iso(s.createdAt)!,
    readyAt: iso(s.readyAt),
    lastActivityAt: iso(s.lastActivityAt)!,
    endedAt: iso(s.endedAt),
    endReason: s.endReason,
  }));

  const assistRuns: RawAssistRun[] = [...runRows, ...extraRuns].map(({ r, e }) => ({
    id: r.id,
    engagement: toEngagement(e),
    subAgent: r.subAgent,
    status: r.status,
    state: r.state,
    fieldsTotal: r.fieldsTotal,
    fieldsFilled: r.fieldsFilled,
    heals: r.heals ?? [],
    refusals: (r.refusals ?? []).map((x) => ({ kind: x.kind, ...(x.target ? { target: x.target } : {}) })),
    blanks: (r.blanks ?? []).length,
    srn: r.srn,
    error: r.error,
    userName: r.userName,
    clientIps: (r.clientIps ?? []).map((c) => ({ ip: c.ip, firstAt: c.firstAt, lastAt: c.lastAt })),
    startedAt: iso(r.startedAt)!,
    finishedAt: iso(r.finishedAt),
    updatedAt: iso(r.updatedAt)!,
  }));

  const gstRuns: RawGstRun[] = gstRows.map(({ g, e }) => {
    const occ = occurrences.find((o) => gstRunMatches(o, { engagementDbId: g.engagementId, form: g.form, period: g.period }));
    return {
      id: g.id,
      engagement: toEngagement(e),
      gstin: g.gstin,
      form: g.form,
      period: g.period,
      status: g.status,
      arn: g.arn,
      error: g.error,
      checks: checksOf(g.checks as Record<string, { by: string; at: string }>).map((c) => ({ label: GST_LABEL[c.key] ?? c.key, by: nameOf(c.by, c.by), at: c.at })),
      createdByName: nameOf(g.createdBy),
      createdAt: iso(g.createdAt)!,
      updatedAt: iso(g.updatedAt)!,
      filedAt: iso(g.filedAt),
      instanceId: occ?.id ?? null,
    };
  });

  const otps: RawOtpRequest[] = otpRows.map((o) => ({
    subjectType: o.subjectType,
    subjectId: o.subjectId,
    purpose: o.purpose,
    audience: o.audience,
    status: o.status,
    sentTo: o.sentTo,
    requestedAt: iso(o.requestedAt)!,
    requestedByName: nameOf(o.requestedBy),
    answeredAt: iso(o.answeredAt),
    answeredByName: o.answeredBy ? nameOf(o.answeredBy, o.audience === 'client' ? 'The client' : 'A staff member') : null,
  }));

  return {
    items: buildAgentRunItems({ role: ctx.role, sessions, assistRuns, gstRuns, otps, now }),
    gstKeys: gstRows.map(({ g }) => ({ engagementDbId: g.engagementId, form: g.form, period: g.period, status: g.status })),
  };
}

export interface AgentRunsList {
  runs: AgentRunItem[];
  agents: Array<{ taskId: string; name: string; count: number }>;
}

/** The control room: both routes in one list, filtered by state, period, agent and search. */
export async function listAgentRunsOverview(ctx: AuthContext, filters: AgentRunFilters, now = new Date()): Promise<AgentRunsList> {
  assertStaff(ctx);
  const scope = await scopeOf(ctx);
  const { items } = await loadRuns(ctx, scope, periodStart(filters.period, now), now);
  const inPeriod = filterAgentRuns(items, { ...filters, state: 'all', agent: null, search: '' }, now);
  return { runs: filterAgentRuns(items, filters, now), agents: agentFacets(inPeriod) };
}

/** "Agents today": your turn, running, filed today and the agent cards due in the next seven days. */
export async function getAgentsTodaySummary(ctx: AuthContext, now = new Date()): Promise<AgentsTodaySummary> {
  assertStaff(ctx);
  const scope = await scopeOf(ctx);
  const dayStart = istDayStart(now);
  const { items, gstKeys } = await loadRuns(ctx, scope, dayStart, now);

  const today = new Date(dayStart.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  const until = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const due: DueOccurrence[] =
    scope !== 'all' && scope.length === 0
      ? []
      : (
          await db
            .select({
              id: complianceInstances.id,
              engagementDbId: complianceInstances.engagementId,
              obligationId: complianceInstances.obligationId,
              dueDate: complianceInstances.dueDate,
              periodStart: complianceInstances.periodStart,
              periodEnd: complianceInstances.periodEnd,
              status: complianceInstances.status,
              filedOn: complianceInstances.filedOn,
              stage: complianceInstanceWorkflow.stage,
            })
            .from(complianceInstances)
            .innerJoin(engagements, eq(engagements.id, complianceInstances.engagementId))
            .leftJoin(complianceInstanceWorkflow, eq(complianceInstanceWorkflow.instanceId, complianceInstances.id))
            .where(
              and(
                inScope(complianceInstances.engagementId, scope),
                gte(complianceInstances.dueDate, today),
                lte(complianceInstances.dueDate, until),
                ne(complianceInstances.status, 'filed'),
                isNull(complianceInstances.filedOn),
                or(isNull(complianceInstanceWorkflow.stage), notInArray(complianceInstanceWorkflow.stage, ['completed', 'not-applicable'])),
              ),
            )
            .limit(2000)
        )
          .map((r) => ({ ...r, stage: r.stage ?? null }))
          .filter((r) => cardTasksFor({ obligationId: r.obligationId }).length > 0);

  return summarizeAgentsToday(items, due, gstKeys, now);
}

/** Live browser hours used in the calendar month that holds `now` (firm-wide; Settings > Agents). */
export async function browserHoursThisMonth(ctx: AuthContext, month: string): Promise<{ hours: number; sessions: number }> {
  assertFirmAdmin(ctx);
  const { start, end } = monthBounds(month);
  const [row] = await db
    .select({
      seconds: sql<number>`coalesce(sum(extract(epoch from (coalesce(${liveBrowserSessions.endedAt}, ${liveBrowserSessions.lastActivityAt}) - ${liveBrowserSessions.createdAt}))), 0)`,
      sessions: sql<number>`count(*)`,
    })
    .from(liveBrowserSessions)
    .where(and(gte(liveBrowserSessions.createdAt, start), sql`${liveBrowserSessions.createdAt} < ${end}`));
  return { hours: Math.round((Number(row?.seconds ?? 0) / 3600) * 10) / 10, sessions: Number(row?.sessions ?? 0) };
}

/** The Agent results page for one month (firm-wide admins only). */
export async function getAgentResults(ctx: AuthContext, month: string, browserHoursCap: number, now = new Date()): Promise<AgentResults> {
  assertFirmAdmin(ctx);
  const since = monthBounds(previousMonth(month)).start;
  const { items } = await loadRuns(ctx, 'all', since, now);
  const patches = await db
    .select({ recipeId: assistRecipePatches.recipeId, status: assistRecipePatches.status, createdAt: assistRecipePatches.createdAt, reviewedAt: assistRecipePatches.reviewedAt })
    .from(assistRecipePatches)
    .where(or(gte(assistRecipePatches.createdAt, since), gte(assistRecipePatches.reviewedAt, since)));
  return computeAgentResults({
    month,
    items,
    patches: patches.map((p) => ({ recipeId: p.recipeId, status: p.status, createdAt: iso(p.createdAt)!, reviewedAt: iso(p.reviewedAt) })),
    browserHoursCap,
  });
}
