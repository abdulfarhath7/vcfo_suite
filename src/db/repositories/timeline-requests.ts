import 'server-only';

import { and, desc, gte, inArray, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientTimelineRequests, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { listScopedEngagementIds } from '@/db/repositories/engagements';
import { toBookTimelineRequest, type BookTimelineRequest } from '@/lib/timeline-request-history';

/**
 * CLIENT TIMELINE REQUESTS ACROSS THE BOOK — the closed ones (approved,
 * declined, withdrawn), for the manager console's Date requests › Decided.
 * Pending requests keep their per-engagement read
 * (`listTimelineRequests` in client-change-requests.ts), which Today and the
 * client overview share.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Only the people who decide them read them: manager, admin, super admin.
 * Rows are limited to the caller's engagement scope (`listScopedEngagementIds`,
 * the same predicate every engagement read uses); leads and clients get [].
 */
const DECIDERS = new Set(['manager', 'admin', 'super_admin']);
const DAY_MS = 86_400_000;

export async function listClosedTimelineRequests(
  ctx: AuthContext,
  opts: { sinceDays?: number; limit?: number } = {},
): Promise<BookTimelineRequest[]> {
  if (!DECIDERS.has(ctx.role)) return [];
  const ids = await listScopedEngagementIds(ctx);
  if (ids.length === 0) return [];
  const sinceDays = Math.min(Math.max(Math.round(opts.sinceDays ?? 30), 1), 365);
  const limit = Math.min(Math.max(Math.round(opts.limit ?? 100), 1), 200);
  const since = new Date(Date.now() - sinceDays * DAY_MS);

  const rows = await db
    .select()
    .from(clientTimelineRequests)
    .where(
      and(
        inArray(clientTimelineRequests.engagementId, ids),
        ne(clientTimelineRequests.status, 'pending'),
        gte(clientTimelineRequests.updatedAt, since),
      ),
    )
    .orderBy(desc(clientTimelineRequests.updatedAt))
    .limit(limit);

  const deciderIds = [...new Set(rows.map((r) => r.decidedBy).filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (deciderIds.length > 0) {
    const people = await db
      .select({ id: profiles.id, name: profiles.name, email: profiles.email })
      .from(profiles)
      .where(inArray(profiles.id, deciderIds));
    for (const p of people) names.set(p.id, p.name?.trim() || p.email);
  }
  return rows.map((r) => toBookTimelineRequest(r, names));
}
