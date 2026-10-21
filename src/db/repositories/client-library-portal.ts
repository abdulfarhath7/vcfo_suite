import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientLibraryItems, clientLibraryReads, clientLibraryRemovals } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { getTopic } from '@/lib/ask/topics';

/**
 * CLIENT LIBRARY — portal v7 additions: reading progress ("Recently read")
 * and soft removal with Undo.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Private to the reader, like `client_library_items`: every read and write is
 * keyed by `ctx.userId`; an item id must belong to `ctx.userId`; a topic slug
 * must name a published topic. Client role only for writes.
 */

export class LibraryPortalForbiddenError extends Error {}

export interface LibraryReadView {
  ref: string;
  itemId: string | null;
  topicSlug: string | null;
  title: string;
  category: string;
  progressPct: number;
  sectionsRead: number;
  sectionsTotal: number;
  lastReadAt: string;
  finishedAt: string | null;
}

function toView(r: typeof clientLibraryReads.$inferSelect): LibraryReadView {
  return {
    ref: r.ref,
    itemId: r.itemId,
    topicSlug: r.topicSlug,
    title: r.title,
    category: r.category,
    progressPct: r.progressPct,
    sectionsRead: r.sectionsRead,
    sectionsTotal: r.sectionsTotal,
    lastReadAt: r.lastReadAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
  };
}

async function ownItem(ctx: AuthContext, itemId: string) {
  const [row] = await db
    .select({ id: clientLibraryItems.id, title: clientLibraryItems.title, category: clientLibraryItems.category, topicSlug: clientLibraryItems.topicSlug })
    .from(clientLibraryItems)
    .where(and(eq(clientLibraryItems.id, itemId), eq(clientLibraryItems.profileId, ctx.userId)))
    .limit(1);
  return row ?? null;
}

export async function listRecentReads(ctx: AuthContext, limit = 20): Promise<LibraryReadView[]> {
  const rows = await db
    .select()
    .from(clientLibraryReads)
    .where(eq(clientLibraryReads.profileId, ctx.userId))
    .orderBy(desc(clientLibraryReads.lastReadAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  const removed = await db
    .select({ id: clientLibraryRemovals.itemId })
    .from(clientLibraryRemovals)
    .where(eq(clientLibraryRemovals.profileId, ctx.userId));
  const gone = new Set(removed.map((r) => r.id));
  return rows.filter((r) => !r.itemId || !gone.has(r.itemId)).map(toView);
}

export interface RecordReadInput {
  itemId?: string | null;
  topicSlug?: string | null;
  sectionsRead: number;
  sectionsTotal: number;
}

/** Progress only moves forward; 100 % stamps `finished_at` once. */
export async function recordReadProgress(ctx: AuthContext, input: RecordReadInput): Promise<LibraryReadView | null> {
  if (ctx.role !== 'client') throw new LibraryPortalForbiddenError('Only clients keep reading progress');
  let ref: string;
  let title: string;
  let category: string;
  let itemId: string | null = null;
  let topicSlug: string | null = null;
  if (input.itemId) {
    const item = await ownItem(ctx, input.itemId);
    if (!item) return null;
    ref = item.id;
    itemId = item.id;
    topicSlug = item.topicSlug;
    title = item.title;
    category = item.category;
  } else if (input.topicSlug) {
    const topic = getTopic(input.topicSlug);
    if (!topic) return null;
    ref = `topic:${topic.slug}`;
    topicSlug = topic.slug;
    title = topic.title;
    category = topic.category;
  } else return null;
  const total = Math.max(1, Math.min(50, Math.round(input.sectionsTotal)));
  const read = Math.max(0, Math.min(total, Math.round(input.sectionsRead)));
  const pct = Math.round((read / total) * 100);
  const [prev] = await db
    .select()
    .from(clientLibraryReads)
    .where(and(eq(clientLibraryReads.profileId, ctx.userId), eq(clientLibraryReads.ref, ref)))
    .limit(1);
  const now = new Date();
  const best = Math.max(pct, prev?.progressPct ?? 0);
  const bestRead = Math.max(read, prev?.sectionsRead ?? 0);
  const values = {
    profileId: ctx.userId,
    ref,
    itemId,
    topicSlug,
    title,
    category,
    progressPct: best,
    sectionsRead: Math.min(bestRead, total),
    sectionsTotal: total,
    lastReadAt: now,
    finishedAt: prev?.finishedAt ?? (best >= 100 ? now : null),
  };
  const [row] = await db
    .insert(clientLibraryReads)
    .values(values)
    .onConflictDoUpdate({ target: [clientLibraryReads.profileId, clientLibraryReads.ref], set: values })
    .returning();
  return row ? toView(row) : null;
}

/** Soft remove (toast Undo). */
export async function removeLibraryItem(ctx: AuthContext, itemId: string): Promise<boolean> {
  if (ctx.role !== 'client') throw new LibraryPortalForbiddenError('Only clients change the library');
  const item = await ownItem(ctx, itemId);
  if (!item) return false;
  await db.insert(clientLibraryRemovals).values({ itemId, profileId: ctx.userId }).onConflictDoNothing();
  return true;
}

export async function restoreLibraryItem(ctx: AuthContext, itemId: string): Promise<boolean> {
  if (ctx.role !== 'client') throw new LibraryPortalForbiddenError('Only clients change the library');
  const rows = await db
    .delete(clientLibraryRemovals)
    .where(and(eq(clientLibraryRemovals.itemId, itemId), eq(clientLibraryRemovals.profileId, ctx.userId)))
    .returning({ id: clientLibraryRemovals.itemId });
  return rows.length > 0;
}
