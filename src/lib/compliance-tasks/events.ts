/**
 * Inngest events of the compliance task model. The repeat job (`src/jobs/compliance-task-repeat.ts`)
 * listens for TASK_COMPLETED_EVENT and creates the next occurrence of a repeating task (DR-04).
 */

export const TASK_COMPLETED_EVENT = 'compliance/task.completed';

/** Queue the event. Never throws: the write that completed the task has already succeeded. */
export async function queueTaskCompleted(taskId: string): Promise<void> {
  try {
    const { inngest } = await import('@/jobs/client');
    await inngest.send({ name: TASK_COMPLETED_EVENT, data: { taskId } });
  } catch (err) {
    console.error('[compliance-tasks] could not queue the repeat event', err);
  }
}
