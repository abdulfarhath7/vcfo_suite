import { inngest } from './client';
import { systemCreateNextOccurrence, systemRepeatSweep } from '@/db/repositories/compliance-tasks';
import { TASK_COMPLETED_EVENT } from '@/lib/compliance-tasks/events';
import { todayIso } from '@/lib/client-portal/compliances';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';

/**
 * "Repeats" on a non-statutory task (DR-04, S-5).
 *
 *  - Event `compliance/task.completed`: the next occurrence of that task's series, when the
 *    completed task is the latest one. The completion path also tries this inline; the unique
 *    (series_id, due_date) index makes both safe.
 *  - Daily 06:15 India time: the sweep creates the next occurrence of every series whose latest
 *    occurrence is completed or whose next start date has come.
 * Both return early while "Pause all jobs" is on. Registered in app/api/inngest/route.ts.
 */
export const complianceTaskRepeatOnComplete = inngest.createFunction(
  { id: 'compliance-task-repeat' },
  { event: TASK_COMPLETED_EVENT },
  async ({ event, step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    const taskId = String((event.data as { taskId?: unknown })?.taskId ?? '');
    if (!taskId) return { created: null };
    const created = await step.run('next-occurrence', () => systemCreateNextOccurrence(taskId));
    return { created };
  },
);

export const complianceTaskRepeatSweep = inngest.createFunction(
  { id: 'compliance-task-repeat-sweep' },
  withRunNow('compliance-task-repeat-sweep', 'TZ=Asia/Kolkata 15 6 * * *'),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    return step.run('sweep', () => systemRepeatSweep(todayIso()));
  },
);
