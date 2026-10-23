import { inngest } from './client';
import { pollOfficialUpdates } from '@/lib/ask/feeds/poll';

/**
 * Ask VCFO official-update watchers: every 30 minutes (owner, 2026-10-23), ask each
 * government source (CBIC GST, RBI FEMA) what it published, and index anything
 * new so Ask VCFO can answer from it. Admins can also run it from the Sources
 * page ("Check for updates now"). Each new item's indexing is its own
 * `ask/document.ingest` event, so one bad PDF never stops the rest.
 */
export const askFeeds = inngest.createFunction(
  { id: 'ask-feeds', retries: 1, concurrency: { limit: 1 } },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const results = await step.run('poll-official-updates', () => pollOfficialUpdates());
    console.log(
      '[ask-feeds] morning check',
      results.map((r) => ({ feed: r.feedId, listed: r.listed, added: r.added, failed: r.failed, error: r.error })),
    );
    return results;
  },
);
