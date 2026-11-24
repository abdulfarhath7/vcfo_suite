import 'server-only';

import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { gstLookupCache } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { NormalizedGstData } from '@/lib/gst-lookup/types';

const CACHE_TTL_HOURS = 24;

export async function getCachedLookup(
  _ctx: AuthContext,
  gstin: string,
): Promise<{ data: NormalizedGstData; fetchedAt: Date } | null> {
  const [row] = await db
    .select({ data: gstLookupCache.data, fetchedAt: gstLookupCache.fetchedAt })
    .from(gstLookupCache)
    .where(eq(gstLookupCache.gstin, gstin))
    .limit(1);
  if (!row) return null;
  const age = Date.now() - row.fetchedAt.getTime();
  if (age > CACHE_TTL_HOURS * 60 * 60 * 1000) return null;
  return { data: row.data as NormalizedGstData, fetchedAt: row.fetchedAt };
}

export async function saveLookup(
  ctx: AuthContext,
  gstin: string,
  data: NormalizedGstData,
): Promise<void> {
  await db
    .insert(gstLookupCache)
    .values({ gstin, data, fetchedAt: new Date(), fetchedBy: ctx.userId })
    .onConflictDoUpdate({
      target: gstLookupCache.gstin,
      set: {
        data: sql`excluded.data`,
        fetchedAt: sql`excluded.fetched_at`,
        fetchedBy: sql`excluded.fetched_by`,
      },
    });
}
