import { inngest } from './client';
import { autoFillCurrent, autoFillStep, failAskFill, FILL_MAX_STEPS } from '@/lib/ask/fill/run';
import { ASK_FILL_EVENT } from '@/lib/ask/fill/types';

/**
 * Ask VCFO "Fill into app", Auto mode: the card's checklist values saved into the project's steps one
 * step at a time, in checklist order, each step submitted as the lead so the next one opens. Each step
 * is its own Inngest step, so a retry repeats only the step that failed. One fill runs at a time per
 * person. It stops at a manager or client step, a locked step, or a submit the validator refuses.
 */
export const askFill = inngest.createFunction(
  {
    id: 'ask-fill',
    retries: 1,
    concurrency: { limit: 1, key: 'event.data.profileId' },
    onFailure: async ({ event, error }) => {
      const runId = String((event.data.event.data as { runId?: unknown })?.runId ?? '');
      if (runId) await failAskFill(runId, error);
    },
  },
  { event: ASK_FILL_EVENT },
  async ({ event, step }) => {
    const runId = String((event.data as { runId?: unknown })?.runId ?? '');
    if (!runId) return { skipped: 'invalid_payload' };
    let next = await step.run('current', () => autoFillCurrent(runId));
    let steps = 0;
    while (next && steps < FILL_MAX_STEPS) {
      const stepId: string = next;
      next = await step.run(`step-${stepId}`, () => autoFillStep(runId, stepId));
      steps += 1;
    }
    return { runId, steps };
  },
);
