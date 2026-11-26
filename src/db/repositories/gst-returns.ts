import 'server-only';

import { and, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceInstances, gstReturnRuns, profiles, type GstReturnChecks } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isValidDbRole } from '@/lib/auth';
import { GstAgentError, engagementGstin, staffEngagement } from '@/db/repositories/gst-agent-scope';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { canMove } from '@/lib/gstzen/run-state';
import { maskPan, periodLabelOf, type GstForm, type GstReturnRunView, type GstReturnSummary, type GstRunFlow, type GstRunStatus } from '@/lib/gstzen/types';

/**
 * GST RETURN RUNS REPOSITORY — `gst_return_runs`: one GST return filed through the GSP API
 * (GSTR-1, GSTR-3B, GSTR-9, GSTR-9C). The status moves only as `src/lib/gstzen/run-state.ts`
 * allows; `summary` keeps the portal's own figures (numbers and labels) and the run's flow flags.
 *
 * >>> ACCESS CONTROL <<<
 *   Staff only: the admins every engagement, a manager owned or co-managed engagements, a project
 *   lead assigned engagements. A client never reads a run here (the client's "Your turn" list reads
 *   `agent_otp_requests`). A run on an engagement out of reach reads as not found.
 *   The certifier checks are staff only and record who ticked and when.
 *   system — the return work job and the EVC answer of a client (`systemGetRun`, `systemUpdateRun`,
 *   `systemRunContext`, `systemFilingInstanceId`).
 */

type Row = typeof gstReturnRuns.$inferSelect;
type StoredSummary = Partial<GstReturnSummary> & { flow?: GstRunFlow };

/** The obligation each form files, for the ARN write-back (GSTR-9C has no calendar obligation). */
export const FORM_OBLIGATION: Record<GstForm, string | null> = {
  gstr1: 'gst-gstr-1',
  gstr3b: 'gst-gstr-3b',
  gstr9: 'gst-gstr-9',
  gstr9c: null,
};

export function splitSummary(raw: unknown): { summary: GstReturnSummary | null; flow: GstRunFlow } {
  const s = (raw && typeof raw === 'object' ? raw : {}) as StoredSummary;
  const { flow, ...rest } = s;
  const summary = rest.table && rest.form ? (rest as GstReturnSummary) : null;
  return { summary, flow: flow ?? {} };
}

export function joinSummary(summary: GstReturnSummary | null, flow: GstRunFlow): Record<string, unknown> {
  return { ...(summary ?? {}), flow };
}

async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return new Map();
  const rows = await db.select({ id: profiles.id, name: profiles.name, email: profiles.email }).from(profiles).where(inArray(profiles.id, clean));
  return new Map(rows.map((r) => [r.id, r.name?.trim() || r.email || 'Staff']));
}

export async function toRunView(r: Row): Promise<GstReturnRunView> {
  const { summary, flow } = splitSummary(r.summary);
  const checks = (r.checks ?? {}) as GstReturnChecks;
  const names = await namesOf([checks.figures?.by ?? '', checks.unmatched?.by ?? '']);
  const check = (c?: { by: string; at: string }) => (c ? { by: c.by, at: c.at, byName: names.get(c.by) ?? null } : undefined);
  const { signatoryPan, ...flowRest } = flow;
  const form = r.form as GstForm;
  return {
    id: r.id,
    engagementId: appEngagementId(r.engagementId),
    gstin: r.gstin,
    form,
    period: r.period,
    periodLabel: periodLabelOf(form, r.period),
    status: r.status as GstRunStatus,
    summary,
    checks: { figures: check(checks.figures), unmatched: check(checks.unmatched) },
    flow: { ...flowRest, signatoryPanMasked: maskPan(signatoryPan) },
    arn: r.arn,
    filedAt: r.filedAt?.toISOString() ?? null,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Runs on an engagement, newest first; optionally one form and period. */
export async function listGstReturnRuns(ctx: AuthContext, engagementId: string, filter: { form?: GstForm; period?: string } = {}): Promise<Row[]> {
  const { dbId } = await staffEngagement(ctx, engagementId);
  const where = [eq(gstReturnRuns.engagementId, dbId)];
  if (filter.form) where.push(eq(gstReturnRuns.form, filter.form));
  if (filter.period) where.push(eq(gstReturnRuns.period, filter.period));
  return db.select().from(gstReturnRuns).where(and(...where)).orderBy(desc(gstReturnRuns.createdAt)).limit(20);
}

/** A filing instance's period on the engagement (the card's obligation instance), or null. Staff only. */
export async function filingInstancePeriod(ctx: AuthContext, engagementId: string, instanceId: string): Promise<{ periodStart: string | null; periodEnd: string | null; dueDate: string | null } | null> {
  const { dbId } = await staffEngagement(ctx, engagementId);
  if (!/^[0-9a-f-]{36}$/i.test(instanceId)) return null;
  const [row] = await db
    .select({ periodStart: complianceInstances.periodStart, periodEnd: complianceInstances.periodEnd, dueDate: complianceInstances.dueDate })
    .from(complianceInstances)
    .where(and(eq(complianceInstances.id, instanceId), eq(complianceInstances.engagementId, dbId)))
    .limit(1);
  if (!row) return null;
  const s = (v: unknown) => (v ? String(v).slice(0, 10) : null);
  return { periodStart: s(row.periodStart), periodEnd: s(row.periodEnd), dueDate: s(row.dueDate) };
}

/** One run in the caller's scope, or a 404. */
export async function getGstReturnRun(ctx: AuthContext, runId: string): Promise<Row> {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new GstAgentError('Return run not found.', 404);
  const [row] = await db.select().from(gstReturnRuns).where(eq(gstReturnRuns.id, runId)).limit(1);
  if (!row) throw new GstAgentError('Return run not found.', 404);
  await staffEngagement(ctx, row.engagementId).catch((e) => {
    throw e instanceof GstAgentError && e.status === 403 && ctx.role !== 'client' ? new GstAgentError('Return run not found.', 404) : e;
  });
  return row;
}

/**
 * Opens a run for a form and period on the engagement's recorded GSTIN, or returns the open run
 * already there (one open run per GSTIN, form and period).
 */
export async function createGstReturnRun(ctx: AuthContext, input: { engagementId: string; form: GstForm; period: string }): Promise<{ row: Row; created: boolean }> {
  const { dbId, row: eng } = await staffEngagement(ctx, input.engagementId);
  const gstin = await engagementGstin(dbId, eng);
  if (!gstin) throw new GstAgentError('Record the GSTIN on the GST registration first.', 409);
  const [open] = await db
    .select()
    .from(gstReturnRuns)
    .where(and(eq(gstReturnRuns.engagementId, dbId), eq(gstReturnRuns.gstin, gstin), eq(gstReturnRuns.form, input.form), eq(gstReturnRuns.period, input.period), notInArray(gstReturnRuns.status, ['filed', 'cancelled'])))
    .orderBy(desc(gstReturnRuns.createdAt))
    .limit(1);
  if (open) return { row: open, created: false };
  const [row] = await db.insert(gstReturnRuns).values({ engagementId: dbId, gstin, form: input.form, period: input.period, status: 'draft', createdBy: ctx.userId }).returning();
  return { row: row!, created: true };
}

export interface RunPatch {
  status?: GstRunStatus;
  summary?: GstReturnSummary | null;
  flow?: Partial<GstRunFlow>;
  checks?: GstReturnChecks;
  referenceId?: string | null;
  error?: string | null;
  arn?: string;
  filedAt?: Date;
}

function applyPatch(row: Row, patch: RunPatch): Partial<typeof gstReturnRuns.$inferInsert> {
  if (patch.status && patch.status !== row.status && !canMove(row.status as GstRunStatus, patch.status)) {
    throw new GstAgentError(`The return cannot move from ${row.status} to ${patch.status}.`, 409);
  }
  const cur = splitSummary(row.summary);
  const set: Partial<typeof gstReturnRuns.$inferInsert> = { updatedAt: new Date() };
  if (patch.status) set.status = patch.status;
  if (patch.summary !== undefined || patch.flow) set.summary = joinSummary(patch.summary === undefined ? cur.summary : patch.summary, { ...cur.flow, ...(patch.flow ?? {}) });
  if (patch.checks) set.checks = patch.checks;
  if (patch.referenceId !== undefined) set.referenceId = patch.referenceId;
  if (patch.error !== undefined) set.error = patch.error;
  if (patch.arn) set.arn = patch.arn;
  if (patch.filedAt) set.filedAt = patch.filedAt;
  return set;
}

/** Updates a run the caller can reach. The write only lands if the status has not moved since it was read. */
export async function updateGstReturnRun(ctx: AuthContext, runId: string, patch: RunPatch): Promise<Row> {
  const row = await getGstReturnRun(ctx, runId);
  return writePatch(row, patch);
}

async function writePatch(row: Row, patch: RunPatch): Promise<Row> {
  const set = applyPatch(row, patch);
  const [updated] = await db
    .update(gstReturnRuns)
    .set(set)
    .where(and(eq(gstReturnRuns.id, row.id), eq(gstReturnRuns.status, row.status)))
    .returning();
  if (!updated) throw new GstAgentError('The return changed while you were working. Refresh and try again.', 409);
  return updated;
}

/* ------------------------------------------------------------------ */
/* system (the return work job and client answers)                     */
/* ------------------------------------------------------------------ */

export async function systemGetRun(runId: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return null;
  const [row] = await db.select().from(gstReturnRuns).where(eq(gstReturnRuns.id, runId)).limit(1);
  return row ?? null;
}

export async function systemUpdateRun(runId: string, patch: RunPatch): Promise<Row> {
  const row = await systemGetRun(runId);
  if (!row) throw new GstAgentError('Return run not found.', 404);
  return writePatch(row, patch);
}

/**
 * The person who started the run, as an AuthContext, so a job or a client's EVC answer acts (and
 * is audited) as them. Null when the person is gone, inactive or no longer staff.
 */
export async function systemRunContext(runId: string): Promise<AuthContext | null> {
  const row = await systemGetRun(runId);
  if (!row?.createdBy) return null;
  const [p] = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name, role: profiles.role, internId: profiles.internId, status: profiles.status, isDemo: profiles.isDemo })
    .from(profiles)
    .where(eq(profiles.id, row.createdBy))
    .limit(1);
  if (!p || p.status !== 'active' || !isValidDbRole(p.role)) return null;
  if (!['super_admin', 'admin', 'manager', 'intern'].includes(p.role)) return null;
  if (p.role === 'intern' && !p.internId?.trim()) return null;
  return {
    userId: p.id,
    email: p.email ?? '',
    name: p.name?.trim() || p.email?.split('@')[0] || 'Staff',
    role: p.role,
    internId: p.internId ?? undefined,
    ...(p.isDemo ? { demo: true } : {}),
  };
}

/**
 * The compliance filing (obligation instance) a run files, for the ARN write-back: the form's
 * obligation on the engagement whose period starts (or, for a quarter, ends) in the run's month, or
 * ends in the financial year for an annual return. Null when the calendar has none.
 */
export async function systemFilingInstanceId(row: Pick<Row, 'engagementId' | 'form' | 'period'>): Promise<string | null> {
  const obligation = FORM_OBLIGATION[row.form as GstForm];
  if (!obligation || !/^\d{6}$/.test(row.period)) return null;
  const rows = await db
    .select({ id: complianceInstances.id, periodStart: complianceInstances.periodStart, periodEnd: complianceInstances.periodEnd })
    .from(complianceInstances)
    .where(and(eq(complianceInstances.engagementId, row.engagementId), eq(complianceInstances.obligationId, obligation)));
  const mm = row.period.slice(0, 2);
  const yyyy = row.period.slice(2);
  const ym = `${yyyy}-${mm}`;
  const annual = row.form === 'gstr9';
  const hit = rows.find((r) => {
    const start = r.periodStart ? String(r.periodStart).slice(0, 7) : '';
    const end = r.periodEnd ? String(r.periodEnd).slice(0, 7) : '';
    return annual ? end === ym : start === ym || end === ym;
  });
  return hit?.id ?? null;
}
