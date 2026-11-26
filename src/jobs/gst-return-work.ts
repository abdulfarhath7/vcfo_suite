import { inngest } from './client';
import { PAUSED, skipWhenPaused } from '@/jobs/dev-controls';
import { GST_RETURN_WORK_EVENT, POLL_DELAYS_S, beginWork, fail, finishWork, pollWork, type WorkTask } from '@/lib/gstzen/work';

/**
 * GST return work (event `gstzen/return.work`, sent when a person starts a save, an offset or a
 * proceed to file on a GST return card). Runs the slow GSTZen calls of `src/lib/gstzen/work.ts`:
 * begin, then a status check after each wait (5 s, 10 s, 30 s, 1 min, 2 min, 5 min, 10 min), then
 * the figures. Each call is its own step, so a retry repeats only the call that failed. One task at
 * a time per run. The event carries the run id and the task only: never an OTP or a figure.
 * While "Pause all jobs" is on, the run is marked failed with a plain message so the card can retry.
 * Registered in app/api/inngest/route.ts.
 */
export const gstReturnWork = inngest.createFunction(
  {
    id: 'gst-return-work',
    retries: 2,
    concurrency: { limit: 1, key: 'event.data.runId' },
    onFailure: async ({ event, error }) => {
      const data = (event.data.event.data ?? {}) as { runId?: unknown; task?: unknown };
      const runId = typeof data.runId === 'string' ? data.runId : '';
      const task = data.task === 'offset' || data.task === 'proceed' ? data.task : 'save';
      void error;
      if (runId) await fail(runId, task, 'The GST return step failed. Try again in a few minutes.');
    },
  },
  { event: GST_RETURN_WORK_EVENT },
  async ({ event, step }) => {
    const runId = typeof event.data?.runId === 'string' ? event.data.runId : '';
    const task: WorkTask | null = event.data?.task === 'save' || event.data?.task === 'offset' || event.data?.task === 'proceed' ? event.data.task : null;
    if (!runId || !task) return { skipped: 'invalid_payload' };
    if (await skipWhenPaused(step)) {
      await step.run('paused', () => fail(runId, task, 'Background jobs are paused. Try again when they are running.'));
      return PAUSED;
    }

    const begun = await step.run('begin', () => beginWork(runId, task));
    if (begun.next === 'stop') return { runId, task, stopped: begun.reason };
    if (begun.next === 'poll') {
      let done = false;
      for (let i = 0; i < POLL_DELAYS_S.length; i += 1) {
        await step.sleep(`wait-${i}`, `${POLL_DELAYS_S[i]}s`);
        const st = await step.run(`status-${i}`, () => pollWork(runId, task, begun.referenceId));
        if (st === 'stop') return { runId, task, stopped: 'status' };
        if (st === 'done') {
          done = true;
          break;
        }
      }
      if (!done) {
        await step.run('timed-out', () => fail(runId, task, 'The portal is still processing the return. Try again later.'));
        return { runId, task, stopped: 'timeout' };
      }
    }
    const finished = await step.run('finish', () => finishWork(runId, task));
    return { runId, task, finished };
  },
);
