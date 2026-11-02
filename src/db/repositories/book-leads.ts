import 'server-only';

import { inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementLeads, engagements, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { listScopedEngagementIds } from '@/db/repositories/engagements';

/**
 * BOOK LEADS — every project lead on the engagements a caller may read, with
 * the person's name, in one read.
 *
 * Why: the staff console names leads on Today, in its sidebar and on the lead
 * pages. `/api/admin/interns` is a roster for pickers and, for a manager, only
 * lists the leads who report to them — a lead who reports to another manager
 * but works on this manager's client (a co-led project) would show as a raw
 * key. `/api/engagements/:id/leads` has the names but is one call per client.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * One scope source: `listScopedEngagementIds(ctx)` — admin and super admin the
 * firm, a manager the owned and co-managed books, a lead their assignments.
 * Clients are refused outright: they read their team through the client team
 * route, never staff e-mail addresses across a book.
 *
 * Leads are collected the way `toAppEngagement` builds `leadIds`: membership
 * rows (`engagement_leads`) plus the primary pointer (`engagements.intern_id`).
 */

export interface BookLead {
  /** `profiles.intern_id` — the key `Engagement.leadIds` / `internId` hold. */
  internId: string;
  name: string;
  email: string;
  /** `profiles.id` (what `tasks.assigned_to` holds), or null when no profile has the key. */
  profileId: string | null;
}

export async function listBookLeads(ctx: AuthContext): Promise<BookLead[]> {
  if (ctx.role === 'client') throw new Error('Clients are not permitted to list book leads');

  const ids = await listScopedEngagementIds(ctx);
  if (ids.length === 0) return [];

  const [members, primaries] = await Promise.all([
    db
      .select({ internId: engagementLeads.internId })
      .from(engagementLeads)
      .where(inArray(engagementLeads.engagementId, ids)),
    db
      .select({ internId: engagements.internId })
      .from(engagements)
      .where(inArray(engagements.id, ids)),
  ]);

  const keys = [
    ...new Set(
      [...members, ...primaries]
        .map((row) => row.internId?.trim() ?? '')
        .filter((key) => key.length > 0),
    ),
  ];
  if (keys.length === 0) return [];

  const people = await db
    .select({
      id: profiles.id,
      internId: profiles.internId,
      name: profiles.name,
      email: profiles.email,
    })
    .from(profiles)
    .where(inArray(profiles.internId, keys));

  // A key held by two profiles (legacy duplicates) keeps the first, as the roster does.
  const byKey = new Map<string, (typeof people)[number]>();
  for (const person of people) {
    const key = person.internId?.trim();
    if (key && !byKey.has(key)) byKey.set(key, person);
  }

  return keys
    .map((key) => {
      const person = byKey.get(key);
      return {
        internId: key,
        name: person?.name?.trim() || person?.email || key,
        email: person?.email ?? '',
        profileId: person?.id ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
