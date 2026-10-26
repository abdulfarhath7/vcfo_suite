import { inngest } from './client';
import { pollOfficialUpdates } from '@/lib/ask/feeds/poll';

/**
 * Ask VCFO official-update watchers: every 30 minutes (owner, 2026-10-23), ask each
 * government source on the firm's portal list (see feeds/registry.ts) what it
 * published, and index anything new so a manager can review it.
 *
 * The timer only fires when an Inngest server is connected: locally
 * `npm run inngest:dev` (port 8288) must be running next to `npm run dev`;
 * in production the Inngest keys do it. Without one, updates arrive only
 * when an admin presses "Check for updates now". Admins can also run it from the Sources
 * page ("Check for updates now"). Each new item's indexing is its own
 * `ask/document.ingest` event, so one bad PDF never stops the rest.
 */
export const askFeeds = inngest.createFunction(
  { id: 'ask-feeds', retries: 1, concurrency: { limit: 1 } },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const results = await step.run('poll-official-updates', () => pollOfficialUpdates());
    console.log(
      '[ask-feeds] 30-minute check',
      results.map((r) => ({ feed: r.feedId, listed: r.listed, added: r.added, failed: r.failed, error: r.error })),
    );
    return results;
  },
);
