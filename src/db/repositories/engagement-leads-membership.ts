import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementLeads } from '@/db/schema';

/** Engagement DB ids this lead may access via membership. */
export async function listLeadMemberEngagementIds(internId: string): Promise<string[]> {
  const rows = await db
    .select({ engagementId: engagementLeads.engagementId })
    .from(engagementLeads)
    .where(eq(engagementLeads.internId, internId));
  return rows.map((r) => r.engagementId);
}

/** Batch: map engagement db id → lead intern_ids. */
export async function listLeadIdsByEngagementIds(
  engagementIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (engagementIds.length === 0) return map;
  const rows = await db
    .select({
      engagementId: engagementLeads.engagementId,
      internId: engagementLeads.internId,
    })
    .from(engagementLeads)
    .where(inArray(engagementLeads.engagementId, engagementIds));
  for (const r of rows) {
    const list = map.get(r.engagementId) ?? [];
    list.push(r.internId);
    map.set(r.engagementId, list);
  }
  return map;
}

export async function ensureEngagementLead(input: {
  engagementDbId: string;
  internId: string;
  invitedBy?: string | null;
}): Promise<void> {
  await db
    .insert(engagementLeads)
    .values({
      engagementId: input.engagementDbId,
      internId: input.internId,
      invitedBy: input.invitedBy ?? null,
    })
    .onConflictDoNothing({
      target: [engagementLeads.engagementId, engagementLeads.internId],
    });
}
