import 'server-only';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceTaskChecklistItems, complianceTaskEvents, complianceTasks, engagements } from '@/db/schema';
import { nextOccurrence, periodLabelFor, type Repeats } from '@/lib/compliance-tasks/model';
import type { TaskRow } from './shared';

/**
 * REPEATING TASKS (DR-04) — SYSTEM writers with no AuthContext. Callers: the repeat job
 * (`src/jobs/compliance-task-repeat.ts`) and the completion path in `write.ts`, which has
 * already passed its own scope check on the task.
 *
 * The next occurrence copies the client, activity, name, urgency, visibility, owner, reviewer,
 * repeat, remind-before and the checklist labels (unticked), shifted by one interval. The
 * unique index on (series_id, due_date) makes every create idempotent.
 */

async function latestOfSeries(seriesId: string): Promise<TaskRow | null> {
  const [row] = await db
    .select()
    .from(complianceTasks)
    .where(eq(complianceTasks.seriesId, seriesId))
    .orderBy(desc(complianceTasks.dueDate))
    .limit(1);
  return row ?? null;
}

async function createAfter(prev: TaskRow): Promise<string | null> {
  const repeats = prev.repeats as Repeats;
  const next = nextOccurrence({ startDate: prev.startDate, dueDate: prev.dueDate, repeats });
  if (!next || !prev.seriesId) return null;
  const [eng] = await db
    .select({ deletedAt: engagements.deletedAt })
    .from(engagements)
    .where(eq(engagements.id, prev.engagementId))
    .limit(1);
  if (!eng || eng.deletedAt) return null;
  const [row] = await db
    .insert(complianceTasks)
    .values({
      engagementId: prev.engagementId,
      activityId: prev.activityId,
      name: prev.name,
      periodLabel: periodLabelFor(repeats, next.startDate),
      startDate: next.startDate,
      dueDate: next.dueDate,
      urgency: prev.urgency,
      visibility: prev.visibility,
      ownerId: prev.ownerId,
      reviewerId: prev.reviewerId,
      repeats: prev.repeats,
      remindBefore: prev.remindBefore,
      seriesId: prev.seriesId,
      previousId: prev.id,
      createdBy: prev.createdBy,
    })
    .onConflictDoNothing()
    .returning({ id: complianceTasks.id });
  if (!row) return null;
  const labels = await db
    .select({ label: complianceTaskChecklistItems.label, position: complianceTaskChecklistItems.position })
    .from(complianceTaskChecklistItems)
    .where(eq(complianceTaskChecklistItems.taskId, prev.id))
    .orderBy(asc(complianceTaskChecklistItems.position));
  if (labels.length) {
    await db.insert(complianceTaskChecklistItems).values(labels.map((l) => ({ taskId: row.id, label: l.label, position: l.position })));
  }
  await db.insert(complianceTaskEvents).values({ taskId: row.id, actorId: null, label: 'Created from the previous occurrence' });
  return row.id;
}

/** After one occurrence completes: create the next one when it is the latest of its series. */
export async function systemCreateNextOccurrence(taskId: string): Promise<string | null> {
  const [task] = await db.select().from(complianceTasks).where(eq(complianceTasks.id, taskId)).limit(1);
  if (!task || !task.seriesId || task.repeats === 'one-time' || task.stage !== 'completed') return null;
  const latest = await latestOfSeries(task.seriesId);
  if (!latest || latest.id !== task.id) return null;
  return createAfter(task);
}

/**
 * The daily sweep: for each repeating series, create the next occurrence when the latest one
 * is completed, or when the next one's start date has come (the work starts on schedule even
 * if the last one is still open). One step per series per run. A latest occurrence marked
 * not applicable pauses its series.
 */
export async function systemRepeatSweep(today: string): Promise<{ series: number; created: number }> {
  const seriesRows = await db
    .selectDistinct({ seriesId: complianceTasks.seriesId })
    .from(complianceTasks)
    .where(and(isNotNull(complianceTasks.seriesId), isNull(complianceTasks.previousId)));
  let created = 0;
  for (const { seriesId } of seriesRows) {
    if (!seriesId) continue;
    const latest = await latestOfSeries(seriesId);
    if (!latest || latest.repeats === 'one-time' || latest.stage === 'not-applicable') continue;
    const next = nextOccurrence({ startDate: latest.startDate, dueDate: latest.dueDate, repeats: latest.repeats as Repeats });
    if (!next) continue;
    if (latest.stage === 'completed' || next.startDate <= today) {
      if (await createAfter(latest)) created += 1;
    }
  }
  return { series: seriesRows.length, created };
}
