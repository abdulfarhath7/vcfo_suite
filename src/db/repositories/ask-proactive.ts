import 'server-only';

import { and, eq, isNull, lt } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';
import { db } from '@/db/client';
import { isStaff } from '@/db/repositories/compliance-subject-scope';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { complianceInstances, engagements, profiles } from '@/db/schema';
import { complianceInstanceWorkflow } from '@/db/schema-compliance-tasks';
import { isAdminOrManager } from '@/lib/auth';

/**
 * Who the overnight job works for, and the one read it needs that no other repository offers. Each
 * project has one named owner: its lead, or its manager when it has no active lead. Every manager of a
 * project is listed too, with no projects of their own if its lead owns them all, because a due date
 * change waits on a manager. That person's own AuthContext then does every read and proposal, so a run
 * sees what they see and nothing more.
 */
export interface ProactiveOwner {
  ownerId: string;
  engagements: Array<{ id: string; companyName: string }>;
}

/** SYSTEM (no session): names and ids only, each read again under the owner's own scope. */
export async function systemProactiveOwners(): Promise<ProactiveOwner[]> {
  const [clients, people] = await Promise.all([
    db.select({ id: engagements.id, companyName: engagements.companyName, internId: engagements.internId, managerId: engagements.managerId }).from(engagements).where(isNull(engagements.deletedAt)),
    db.select({ id: profiles.id, role: profiles.role, internId: profiles.internId }).from(profiles).where(eq(profiles.status, 'active')),
  ]);
  const leadOf = new Map(people.flatMap((person) => (person.role === 'intern' && person.internId ? [[person.internId, person.id] as const] : [])));
  const managers = new Set(people.filter((person) => isAdminOrManager(person.role)).map((person) => person.id));
  const byOwner = new Map<string, ProactiveOwner>();
  const ownerOf = (ownerId: string): ProactiveOwner => {
    const owner = byOwner.get(ownerId) ?? { ownerId, engagements: [] };
    byOwner.set(ownerId, owner);
    return owner;
  };
  for (const { id, companyName, internId, managerId } of clients) {
    const manager = managerId && managers.has(managerId) ? managerId : undefined;
    if (manager) ownerOf(manager);
    const ownerId = (internId ? leadOf.get(internId) : undefined) ?? manager;
    if (ownerId) ownerOf(ownerId).engagements.push({ id, companyName });
  }
  return [...byOwner.values()];
}

/** Filings past their due date that are waiting on the client, which is when a reminder is the next step. */
export async function listOverdueWaitingFilings(ctx: AuthContext, engagementId: string, today: string): Promise<Array<{ id: string }>> {
  if (!isStaff(ctx)) return [];
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) return [];
  return db
    .select({ id: complianceInstances.id })
    .from(complianceInstances)
    .innerJoin(complianceInstanceWorkflow, eq(complianceInstanceWorkflow.instanceId, complianceInstances.id))
    .where(and(eq(complianceInstances.engagementId, access.dbId), isNull(complianceInstances.filedOn), lt(complianceInstances.dueDate, today), eq(complianceInstanceWorkflow.stage, 'waiting')));
}
