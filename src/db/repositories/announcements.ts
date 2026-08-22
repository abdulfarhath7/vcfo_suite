import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { announcementSources, announcements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import {
  assertSafeFeedUrl,
  assertSafeHttpsUrl,
  canManageAnnouncementSources,
  canWriteAnnouncements,
  inferAnnouncementKind,
  parseAnnouncementKind,
  type Announcement,
  type AnnouncementKind,
  type AnnouncementOrigin,
  type AnnouncementSource,
  type ParsedFeedItem,
} from '@/lib/announcements';

type AnnouncementRow = typeof announcements.$inferSelect;
type SourceRow = typeof announcementSources.$inferSelect;

function assertCanWrite(ctx: AuthContext) {
  if (!canWriteAnnouncements(ctx.role)) throw new Error('not permitted');
}

function assertCanManageSources(ctx: AuthContext) {
  if (!canManageAnnouncementSources(ctx.role)) throw new Error('not permitted');
}

function mapAnnouncement(
  row: AnnouncementRow,
  sourceName: string | null,
): Announcement {
  const origin: AnnouncementOrigin = row.origin === 'feed' ? 'feed' : 'manual';
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? '',
    kind: parseAnnouncementKind(row.kind),
    origin,
    sourceId: row.sourceId,
    sourceName: origin === 'feed' ? sourceName : null,
    sourceUrl: row.sourceUrl,
    authorId: row.authorId,
    authorName: row.authorName,
    authorRole: row.authorRole,
    publishedAt: row.publishedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapSource(row: SourceRow): AnnouncementSource {
  return {
    id: row.id,
    name: row.name,
    feedUrl: row.feedUrl,
    homepageUrl: row.homepageUrl,
    enabled: row.enabled,
    lastFetchedAt: row.lastFetchedAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAnnouncements(
  _ctx: AuthContext,
  limit = 80,
): Promise<Announcement[]> {
  const cap = Math.min(Math.max(1, limit), 120);
  const rows = await db
    .select({
      announcement: announcements,
      sourceName: announcementSources.name,
    })
    .from(announcements)
    .leftJoin(announcementSources, eq(announcements.sourceId, announcementSources.id))
    .orderBy(desc(announcements.publishedAt))
    .limit(cap);
  return rows.map((row) => mapAnnouncement(row.announcement, row.sourceName));
}

export async function createAnnouncement(
  ctx: AuthContext,
  input: { title?: string; body?: string; sourceUrl?: string | null; kind?: AnnouncementKind },
): Promise<Announcement> {
  assertCanWrite(ctx);
  const body = (input.body ?? '').trim().slice(0, 8000);
  const title = (input.title?.trim() || body).slice(0, 200);
  if (!title) throw new Error('invalid_body');
  let sourceUrl: string | null = null;
  if (input.sourceUrl?.trim()) {
    sourceUrl = assertSafeHttpsUrl(input.sourceUrl, 'link').href;
  }
  const authorName = ctx.name.trim() || ctx.email.split('@')[0] || 'Staff';
  const kind = parseAnnouncementKind(input.kind);
  const [row] = await db
    .insert(announcements)
    .values({
      title,
      body: body || title,
      kind,
      origin: 'manual',
      sourceUrl,
      authorId: ctx.userId,
      authorName,
      authorRole: ctx.role,
      publishedAt: new Date(),
    })
    .returning();
  return mapAnnouncement(row, null);
}

export async function deleteAnnouncement(ctx: AuthContext, id: string): Promise<boolean> {
  assertCanWrite(ctx);
  const deleted = await db.delete(announcements).where(eq(announcements.id, id)).returning({
    id: announcements.id,
  });
  return deleted.length > 0;
}

export async function listAnnouncementSources(ctx: AuthContext): Promise<AnnouncementSource[]> {
  assertCanManageSources(ctx);
  const rows = await db
    .select()
    .from(announcementSources)
    .orderBy(desc(announcementSources.createdAt));
  return rows.map(mapSource);
}

export async function createAnnouncementSource(
  ctx: AuthContext,
  input: { name: string; feedUrl: string; homepageUrl?: string | null },
): Promise<AnnouncementSource> {
  assertCanManageSources(ctx);
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error('invalid_body');
  const feedUrl = assertSafeFeedUrl(input.feedUrl).href;
  let homepageUrl: string | null = null;
  if (input.homepageUrl?.trim()) {
    homepageUrl = assertSafeHttpsUrl(input.homepageUrl, 'link').href;
  }
  try {
    const [row] = await db
      .insert(announcementSources)
      .values({
        name,
        feedUrl,
        homepageUrl,
        enabled: true,
        createdById: ctx.userId,
      })
      .returning();
    return mapSource(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('announcement_sources_feed_url_uidx') || message.includes('duplicate')) {
      throw new Error('feed_already_added');
    }
    throw err;
  }
}

export async function deleteAnnouncementSource(ctx: AuthContext, id: string): Promise<boolean> {
  assertCanManageSources(ctx);
  const deleted = await db
    .delete(announcementSources)
    .where(eq(announcementSources.id, id))
    .returning({ id: announcementSources.id });
  return deleted.length > 0;
}

export async function getAnnouncementSourceForWrite(
  ctx: AuthContext,
  id: string,
): Promise<AnnouncementSource | null> {
  assertCanManageSources(ctx);
  const [row] = await db
    .select()
    .from(announcementSources)
    .where(eq(announcementSources.id, id))
    .limit(1);
  return row ? mapSource(row) : null;
}

/** Job-only: enabled sources, no session. Do not call from request handlers. */
/** Job-only: persist a source after a catalog URL has already parsed as RSS/Atom. */
export async function systemGetOrCreateAnnouncementSource(input: {
  name: string;
  feedUrl: string;
}): Promise<AnnouncementSource> {
  const feedUrl = assertSafeFeedUrl(input.feedUrl).href;
  const [existing] = await db
    .select()
    .from(announcementSources)
    .where(eq(announcementSources.feedUrl, feedUrl))
    .limit(1);
  if (existing) return mapSource(existing);
  const name = input.name.trim().slice(0, 120) || 'Official feed';
  try {
    const [row] = await db
      .insert(announcementSources)
      .values({ name, feedUrl, enabled: true })
      .returning();
    return mapSource(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('announcement_sources_feed_url_uidx') || message.includes('duplicate')) {
      const [again] = await db
        .select()
        .from(announcementSources)
        .where(eq(announcementSources.feedUrl, feedUrl))
        .limit(1);
      if (again) return mapSource(again);
    }
    throw err;
  }
}

export async function systemListEnabledAnnouncementSources(): Promise<AnnouncementSource[]> {
  const rows = await db
    .select()
    .from(announcementSources)
    .where(eq(announcementSources.enabled, true));
  return rows.map(mapSource);
}

export async function systemMarkAnnouncementSourceFetch(
  id: string,
  result: { error?: string | null },
): Promise<void> {
  await db
    .update(announcementSources)
    .set({
      lastFetchedAt: new Date(),
      lastError: result.error?.slice(0, 500) ?? null,
    })
    .where(eq(announcementSources.id, id));
}

export async function systemUpsertFeedAnnouncements(
  source: AnnouncementSource,
  items: ParsedFeedItem[],
): Promise<{ inserted: number }> {
  if (items.length === 0) return { inserted: 0 };
  const existing = await db
    .select({ externalId: announcements.externalId })
    .from(announcements)
    .where(and(eq(announcements.sourceId, source.id), eq(announcements.origin, 'feed')));
  const seen = new Set(existing.map((row) => row.externalId).filter(Boolean));
  const fresh = items.filter((item) => !seen.has(item.externalId));
  if (fresh.length === 0) return { inserted: 0 };

  await db
    .insert(announcements)
    .values(
      fresh.map((item) => ({
        title: item.title,
        body: item.body,
        kind: inferAnnouncementKind(item.title, source.name),
        origin: 'feed' as const,
        sourceId: source.id,
        externalId: item.externalId,
        sourceUrl: item.link,
        authorId: null,
        authorName: source.name,
        authorRole: null,
        publishedAt: item.publishedAt,
      })),
    )
    .onConflictDoNothing({
      target: [announcements.sourceId, announcements.externalId],
    });
  return { inserted: fresh.length };
}
