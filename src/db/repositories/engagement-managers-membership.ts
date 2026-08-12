import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementManagers } from '@/db/schema';

/** Engagement IDs where this profile is a co-manager (or sole PM via membership). */
export async function listManagerMemberEngagementIds(managerProfileId: string): Promise<string[]> {
  const rows = await db
    .select({ engagementId: engagementManagers.engagementId })
    .from(engagementManagers)
    .where(eq(engagementManagers.managerId, managerProfileId));
  return rows.map((r) => r.engagementId);
}

export async function ensureEngagementManager(input: {
  engagementDbId: string;
  managerId: string;
  invitedBy?: string | null;
}): Promise<void> {
  await db
    .insert(engagementManagers)
    .values({
      engagementId: input.engagementDbId,
      managerId: input.managerId,
      invitedBy: input.invitedBy ?? null,
    })
    .onConflictDoNothing({
      target: [engagementManagers.engagementId, engagementManagers.managerId],
    });
}
