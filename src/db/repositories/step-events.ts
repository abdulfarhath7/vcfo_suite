import 'server-only';
import { and, asc, gte, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementStepEvents } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isAdminOrManager, isFirmWideAdmin } from '@/lib/auth';
import { getIncorporationPhases } from '@/data/checklist';
import { appEngagementId, engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import {
  groupEvents,
  stageAverages,
  timingOf,
  timingsByStep,
  type StageAverage,
  type StepEvent,
  type StepStatusChange,
  type StepTiming,
} from '@/lib/metrics/step-timing';

/**
 * STEP EVENTS REPOSITORY — `engagement_step_events` (G-13, G-27).
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   write — only from inside the engagements repository, in the same transaction as the
 *           `checklist_state` update that changed the status (`updateChecklistState`). The
 *           caller has already passed the engagement scope; the actor is the session user.
 *   read  — staff only. Admin and super admin: every engagement. Manager and project lead:
 *           the engagements `listScopedEngagementIds(ctx)` returns. Clients and developers
 *           get nothing: these are firm working-time figures.
 */

/** The part of `db` (or a transaction) a write needs. */
type Inserter = Pick<typeof db, 'insert'>;

function isStaff(ctx: AuthContext): boolean {
  return isAdminOrManager(ctx.role) || ctx.role === 'intern';
}

/**
 * Write one event per status change. Called by `updateChecklistState` with its transaction,
 * so the event and the new status land together or not at all.
 */
export async function writeStepEvents(
  ctx: AuthContext,
  tx: Inserter,
  engagementDbIdValue: string,
  changes: StepStatusChange[],
  at: Date = new Date(),
): Promise<void> {
  if (changes.length === 0) return;
  await tx.insert(engagementStepEvents).values(
    changes.map((change) => ({
      engagementId: engagementDbIdValue,
      stepId: change.stepId,
      fromStatus: change.from,
      toStatus: change.to,
      actorId: ctx.userId,
      at,
    })),
  );
}

/**
 * The db ids the caller may read events for, narrowed to `appIds` when given. `null` means
 * firm-wide with no narrowing (no id filter needed).
 */
async function readableDbIds(ctx: AuthContext, appIds?: string[]): Promise<string[] | null> {
  const wanted = appIds ? [...new Set(appIds.map(engagementDbId))] : null;
  if (isFirmWideAdmin(ctx.role)) return wanted;
  // Dynamic import: the engagements repository imports this file for its writes.
  const { listScopedEngagementIds } = await import('@/db/repositories/engagements');
  const scoped = await listScopedEngagementIds(ctx);
  if (!wanted) return scoped;
  const allowed = new Set(scoped);
  return wanted.filter((id) => allowed.has(id));
}

export interface ListStepEventsOptions {
  /** App or db engagement ids; omitted means every engagement in scope. */
  engagementIds?: string[];
  /** Only events at or after this time. */
  since?: Date;
}

/** Events in scope, oldest first, with app engagement ids. */
export async function listStepEvents(
  ctx: AuthContext,
  options: ListStepEventsOptions = {},
): Promise<StepEvent[]> {
  if (!isStaff(ctx)) return [];
  const ids = await readableDbIds(ctx, options.engagementIds);
  if (ids && ids.length === 0) return [];

  const conds = [];
  if (ids) conds.push(inArray(engagementStepEvents.engagementId, ids));
  if (options.since) conds.push(gte(engagementStepEvents.at, options.since));

  const rows = await db
    .select({
      engagementId: engagementStepEvents.engagementId,
      stepId: engagementStepEvents.stepId,
      fromStatus: engagementStepEvents.fromStatus,
      toStatus: engagementStepEvents.toStatus,
      at: engagementStepEvents.at,
    })
    .from(engagementStepEvents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(engagementStepEvents.at));

  return rows.map((row) => ({
    engagementId: appEngagementId(row.engagementId),
    stepId: row.stepId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    at: row.at.toISOString(),
  }));
}

/** stepId → opened at, finished at and days in step, for one engagement. Empty when out of scope. */
export async function getStepTimings(
  ctx: AuthContext,
  appOrDbEngagementId: string,
  now: Date = new Date(),
): Promise<Record<string, StepTiming>> {
  const events = await listStepEvents(ctx, { engagementIds: [appOrDbEngagementId] });
  return timingsByStep(events, now);
}

/** One step's timing, or null when it has no events or is out of scope. */
export async function getStepTiming(
  ctx: AuthContext,
  appOrDbEngagementId: string,
  stepId: string,
  now: Date = new Date(),
): Promise<StepTiming | null> {
  const events = (await listStepEvents(ctx, { engagementIds: [appOrDbEngagementId] })).filter(
    (event) => event.stepId === stepId,
  );
  return events.length ? timingOf(events, now) : null;
}

/** engagementId → stepId → timing, for every engagement in scope (or the ids given). */
export async function getTimingIndex(
  ctx: AuthContext,
  options: ListStepEventsOptions = {},
  now: Date = new Date(),
): Promise<Map<string, Record<string, StepTiming>>> {
  const events = await listStepEvents(ctx, options);
  const out = new Map<string, Record<string, StepTiming>>();
  for (const [engagementId, steps] of groupEvents(events)) {
    const record: Record<string, StepTiming> = {};
    for (const [stepId, list] of steps) record[stepId] = timingOf(list, now);
    out.set(engagementId, record);
  }
  return out;
}

/** The four phases as stages, with their step ids. */
export function incorporationStages(labels: Record<string, string> = {}) {
  return getIncorporationPhases().map((phase) => ({
    id: phase.id,
    label: labels[phase.id] ?? phase.title,
    stepIds: phase.items.map((item) => item.id),
  }));
}

/**
 * Average days per stage over the stages finished in the last `months` months, and the
 * slowest open stage now, across the engagements in scope.
 */
export async function getStageAverages(
  ctx: AuthContext,
  options: { engagementIds?: string[]; months?: number; labels?: Record<string, string> } = {},
  now: Date = new Date(),
): Promise<StageAverage[]> {
  if (!isStaff(ctx)) return [];
  const months = options.months ?? 12;
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - months);
  const timings = await getTimingIndex(ctx, { engagementIds: options.engagementIds }, now);
  return stageAverages({ phases: incorporationStages(options.labels), timings, since, now });
}
