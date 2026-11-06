import { systemProactiveOwners } from '@/db/repositories/ask-proactive';
import { askFlags } from '@/lib/ask/config';
import { prepareForOwner } from '@/lib/ask/proactive/prepare';
import { inngest } from './client';
import { PAUSED, skipWhenPaused, withRunNow } from './dev-controls';

type Step = { run: <T>(name: string, fn: () => Promise<T>) => Promise<unknown> };

/**
 * Nightly, behind ASK_PROACTIVE_ENABLED, default off: one step per named owner, each leaving review
 * cards for that person and nothing else. Every card still waits for a person, so a night the job does
 * not run costs only the proposals. Nothing here reads the acceptance report, so autonomy never rises by itself.
 */
export async function runProactive(step: Step) {
  if (!askFlags().proactive) return { skipped: 'off' };
  if (await skipWhenPaused(step)) return PAUSED;
  const owners = (await step.run('owners', () => systemProactiveOwners())) as Awaited<ReturnType<typeof systemProactiveOwners>>;
  let cards = 0;
  let rows = 0;
  for (const owner of owners) {
    const done = (await step.run(`owner-${owner.ownerId}`, () => prepareForOwner(owner, new Date()))) as Awaited<ReturnType<typeof prepareForOwner>>;
    if ('stopped' in done) continue;
    cards += done.cards;
    rows += done.rows;
  }
  return { owners: owners.length, cards, rows };
}

export const askProactive = inngest.createFunction(
  { id: 'ask-proactive', retries: 1, concurrency: { limit: 1 } },
  withRunNow('ask-proactive', 'TZ=Asia/Kolkata 30 2 * * *'),
  ({ step }) => runProactive(step),
);
