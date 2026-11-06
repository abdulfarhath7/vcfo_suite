import { systemStopAskRun } from '@/db/repositories/ask-runs';
import { agentResume, agentTurn } from '@/lib/ask/agent/loop';
import { ASK_CHANGESET_DECIDED, ASK_RUN_START } from '@/lib/ask/agent/events';
import { inngest } from './client';

/**
 * One agent run, durable: each model turn is a step, and the run sleeps on a person's decision
 * without holding anything open. The page can close at any point. The first wait is short because
 * an event sent before the wait begins is not seen; a look at the card after it closes that gap.
 */
const FIRST_WAIT = '1m';
const LATER_WAIT = '6h';
/** A card lives seven days, and a run looks once more after that and moves on. */
const MAX_WAITS = 30;

export const askRun = inngest.createFunction(
  {
    id: 'ask-run',
    retries: 2,
    concurrency: { limit: 5 },
    onFailure: async ({ event }) => {
      const runId = String((event.data.event.data as { runId?: unknown })?.runId ?? '');
      if (runId) await systemStopAskRun(runId, 'job failed');
    },
  },
  { event: ASK_RUN_START },
  async ({ event, step }) => {
    const runId = String((event.data as { runId?: unknown })?.runId ?? '');
    if (!runId) return { skipped: 'invalid_payload' };
    for (let turn = 0; ; turn += 1) {
      const outcome = await step.run(`turn-${turn}`, () => agentTurn(runId));
      if (outcome.kind === 'finished') return outcome;
      if (outcome.kind !== 'wait') continue;
      for (let wait = 0; wait < MAX_WAITS; wait += 1) {
        await step.waitForEvent(`decided-${turn}-${wait}`, {
          event: ASK_CHANGESET_DECIDED,
          timeout: wait === 0 ? FIRST_WAIT : LATER_WAIT,
          if: `async.data.changesetId == "${outcome.changesetId}"`,
        });
        if (await step.run(`look-${turn}-${wait}`, () => agentResume(runId))) break;
      }
    }
  },
);
