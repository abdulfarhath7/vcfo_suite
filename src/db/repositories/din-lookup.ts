import 'server-only';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { dinLookupCache, mcaDinRequests } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { DinSource, McaDinRequest, McaRequestState, NormalizedDinData } from '@/lib/din-lookup/types';

const CACHE_TTL_HOURS = 24;
/** A request nobody picked up in this long is stale: the person never opened the MCA tab. */
const REQUEST_TTL_MINUTES = 15;
const OPEN: McaRequestState[] = ['requested', 'running'];

/**
 * MCA director master data is public, so the cache is not tenant-scoped: any staff member who
 * may use the tool may read any cached DIN. The context is still taken so the seam's signature
 * holds and so each fetch is attributed to a person.
 */
export async function getCachedDinLookup(
  _ctx: AuthContext,
  din: string,
): Promise<{ data: NormalizedDinData; source: DinSource; fetchedAt: Date } | null> {
  const [row] = await db
    .select({ data: dinLookupCache.data, source: dinLookupCache.source, fetchedAt: dinLookupCache.fetchedAt })
    .from(dinLookupCache)
    .where(eq(dinLookupCache.din, din))
    .limit(1);
  if (!row) return null;
  const age = Date.now() - row.fetchedAt.getTime();
  if (age > CACHE_TTL_HOURS * 60 * 60 * 1000) return null;
  return { data: row.data as NormalizedDinData, source: row.source as DinSource, fetchedAt: row.fetchedAt };
}

export async function saveDinLookup(
  ctx: AuthContext,
  din: string,
  data: NormalizedDinData,
  source: DinSource,
): Promise<void> {
  await db
    .insert(dinLookupCache)
    .values({ din, data, source, fetchedAt: new Date(), fetchedBy: ctx.userId })
    .onConflictDoUpdate({
      target: dinLookupCache.din,
      set: {
        data: sql`excluded.data`,
        source: sql`excluded.source`,
        fetchedAt: sql`excluded.fetched_at`,
        fetchedBy: sql`excluded.fetched_by`,
      },
    });
}

function toRequest(row: typeof mcaDinRequests.$inferSelect): McaDinRequest {
  return {
    id: row.id,
    din: row.din,
    state: row.state as McaRequestState,
    error: row.error ?? null,
    requestedAt: row.requestedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * A request belongs to the person who made it, and only that person's extension sees it: the
 * extension posts from inside their own signed-in Suite tab, in the same browser as their own
 * MCA session. Nobody reads or answers anybody else's request.
 */
export async function openDinRequest(ctx: AuthContext, din: string): Promise<McaDinRequest> {
  const [existing] = await db
    .select()
    .from(mcaDinRequests)
    .where(and(eq(mcaDinRequests.requestedBy, ctx.userId), eq(mcaDinRequests.din, din), inArray(mcaDinRequests.state, OPEN)))
    .orderBy(desc(mcaDinRequests.requestedAt))
    .limit(1);
  if (existing && Date.now() - existing.requestedAt.getTime() < REQUEST_TTL_MINUTES * 60 * 1000) {
    return toRequest(existing);
  }
  const [row] = await db
    .insert(mcaDinRequests)
    .values({ din, requestedBy: ctx.userId, state: 'requested' })
    .returning();
  return toRequest(row);
}

export async function getDinRequest(ctx: AuthContext, id: string): Promise<McaDinRequest | null> {
  const [row] = await db
    .select()
    .from(mcaDinRequests)
    .where(and(eq(mcaDinRequests.id, id), eq(mcaDinRequests.requestedBy, ctx.userId)))
    .limit(1);
  return row ? toRequest(row) : null;
}

/** What the extension picks up: this person's own open requests, oldest first. */
export async function listOpenDinRequests(ctx: AuthContext): Promise<McaDinRequest[]> {
  const rows = await db
    .select()
    .from(mcaDinRequests)
    .where(and(eq(mcaDinRequests.requestedBy, ctx.userId), inArray(mcaDinRequests.state, OPEN)))
    .orderBy(mcaDinRequests.requestedAt)
    .limit(20);
  const fresh = rows.filter((row) => Date.now() - row.requestedAt.getTime() < REQUEST_TTL_MINUTES * 60 * 1000);
  return fresh.map(toRequest);
}

export async function setDinRequestState(
  ctx: AuthContext,
  id: string,
  state: McaRequestState,
  error?: string,
): Promise<McaDinRequest | null> {
  const [row] = await db
    .update(mcaDinRequests)
    .set({ state, error: error ?? null, updatedAt: new Date() })
    .where(and(eq(mcaDinRequests.id, id), eq(mcaDinRequests.requestedBy, ctx.userId)))
    .returning();
  return row ? toRequest(row) : null;
}
