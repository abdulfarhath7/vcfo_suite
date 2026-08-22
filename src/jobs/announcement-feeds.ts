import { inngest } from './client';
import {
  systemGetOrCreateAnnouncementSource,
  systemListEnabledAnnouncementSources,
  systemMarkAnnouncementSourceFetch,
  systemUpsertFeedAnnouncements,
} from '@/db/repositories/announcements';
import { catalogCircularFeedCandidates } from '@/lib/announcement-portals';
import {
  fetchOfficialFeedXml,
  parseRssOrAtom,
  type AnnouncementSource,
} from '@/lib/announcements';

export async function ingestAnnouncementSource(
  source: AnnouncementSource,
): Promise<{ inserted: number; error?: string }> {
  try {
    const xml = await fetchOfficialFeedXml(source.feedUrl);
    const items = parseRssOrAtom(xml);
    const { inserted } = await systemUpsertFeedAnnouncements(source, items);
    await systemMarkAnnouncementSourceFetch(source.id, { error: null });
    return { inserted };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'feed_fetch_failed';
    await systemMarkAnnouncementSourceFetch(source.id, { error });
    return { inserted: 0, error };
  }
}

export async function ingestAllAnnouncementFeeds(): Promise<{
  sources: number;
  catalogTried: number;
  results: { id: string | null; name: string; inserted: number; error?: string }[];
}> {
  const sources = await systemListEnabledAnnouncementSources();
  const results: { id: string | null; name: string; inserted: number; error?: string }[] = [];
  const seen = new Set(sources.map((source) => source.feedUrl));

  for (const source of sources) {
    const result = await ingestAnnouncementSource(source);
    results.push({ id: source.id, name: source.name, ...result });
  }

  const catalogFeeds = catalogCircularFeedCandidates();
  for (const candidate of catalogFeeds) {
    if (seen.has(candidate.feedUrl)) continue;
    try {
      const xml = await fetchOfficialFeedXml(candidate.feedUrl);
      const items = parseRssOrAtom(xml);
      if (items.length === 0) continue;
      const source = await systemGetOrCreateAnnouncementSource(candidate);
      seen.add(source.feedUrl);
      const { inserted } = await systemUpsertFeedAnnouncements(source, items);
      await systemMarkAnnouncementSourceFetch(source.id, { error: null });
      results.push({ id: source.id, name: source.name, inserted });
    } catch (err) {
      results.push({
        id: null,
        name: candidate.name,
        inserted: 0,
        error: err instanceof Error ? err.message : 'feed_fetch_failed',
      });
    }
  }

  return { sources: sources.length, catalogTried: catalogFeeds.length, results };
}

/** Pull official RSS/Atom once each morning IST. Staff can still Pull now. */
export const announcementFeeds = inngest.createFunction(
  { id: 'announcement-feeds' },
  { cron: 'TZ=Asia/Kolkata 0 6 * * *' },
  async ({ step }) => {
    return step.run('ingest-all-feeds', async () => {
      const digest = await ingestAllAnnouncementFeeds();
      console.log('[announcement-feeds] morning ingest', {
        sources: digest.sources,
        catalogTried: digest.catalogTried,
        inserted: digest.results.reduce((sum, row) => row.inserted + sum, 0),
        errors: digest.results.filter((row) => row.error).length,
      });
      return digest;
    });
  },
);
