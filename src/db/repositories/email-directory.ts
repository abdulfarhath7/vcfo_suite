import 'server-only';

import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementClients, engagementLeads, engagementManagers, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { listEngagements } from '@/db/repositories/engagements';
import { LEGACY_ENGAGEMENT_IDS } from '@/lib/legacy-engagement-ids';
import { isUuid } from '@/lib/slug';
import {
  kindForRole,
  type DirectoryPerson,
  type DirectoryProject,
} from '@/lib/email/directory-filter';
import type { Role } from '@/lib/auth';

function assertStaff(ctx: AuthContext) {
  if (ctx.role === 'client') throw new Error('not permitted');
}

function projectRef(row: { id: string; slug: string; companyName: string }): DirectoryProject {
  return {
    id: LEGACY_ENGAGEMENT_IDS[row.id] ?? row.id,
    slug: row.slug,
    companyName: row.companyName,
  };
}

type Bucket = {
  projects: Map<string, DirectoryProject>;
  primaryProjectIds: Set<string>;
};

function addToBucket(
  buckets: Map<string, Bucket>,
  userId: string | null | undefined,
  project: DirectoryProject | null,
  opts?: { primary?: boolean },
) {
  const id = userId?.trim();
  if (!id) return;
  const existing = buckets.get(id) ?? { projects: new Map(), primaryProjectIds: new Set() };
  if (project) existing.projects.set(project.id, project);
  if (opts?.primary && project) existing.primaryProjectIds.add(project.id);
  buckets.set(id, existing);
}

async function profilesByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  return db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
      role: profiles.role,
      internId: profiles.internId,
      status: profiles.status,
      reportsToManagerId: profiles.reportsToManagerId,
    })
    .from(profiles)
    .where(inArray(profiles.id, unique));
}

async function profilesByInternKeys(keys: string[]) {
  const unique = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const uuidKeys = unique.filter(isUuid);
  const match =
    uuidKeys.length > 0
      ? or(inArray(profiles.internId, unique), inArray(profiles.id, uuidKeys))
      : inArray(profiles.internId, unique);
  return db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
      role: profiles.role,
      internId: profiles.internId,
      status: profiles.status,
      reportsToManagerId: profiles.reportsToManagerId,
    })
    .from(profiles)
    .where(match);
}

/**
 * People the signed-in staff user may pick as Outlook recipients.
 * Scoped to engagements they can already see, plus an intern's reports-to manager.
 */
export async function listEmailDirectory(ctx: AuthContext): Promise<DirectoryPerson[]> {
  assertStaff(ctx);
  const rows = await listEngagements(ctx);
  const buckets = new Map<string, Bucket>();
  const internKeysByProject = new Map<string, DirectoryProject[]>();

  const addInternKey = (key: string | null | undefined, project: DirectoryProject) => {
    const internKey = key?.trim();
    if (!internKey) return;
    const list = internKeysByProject.get(internKey) ?? [];
    list.push(project);
    internKeysByProject.set(internKey, list);
  };

  for (const row of rows) {
    const project = projectRef(row);
    addToBucket(buckets, row.clientUserId, project, { primary: true });
    addToBucket(buckets, row.managerId, project);
    addToBucket(buckets, row.adminId, project);
    addInternKey(row.internId, project);
  }

  const dbIds = rows.map((r) => r.id);
  if (dbIds.length > 0) {
    const [clientRows, leadRows, managerRows] = await Promise.all([
      db
        .select({
          engagementId: engagementClients.engagementId,
          userId: engagementClients.userId,
          memberRole: engagementClients.memberRole,
        })
        .from(engagementClients)
        .where(inArray(engagementClients.engagementId, dbIds)),
      db
        .select({
          engagementId: engagementLeads.engagementId,
          internId: engagementLeads.internId,
        })
        .from(engagementLeads)
        .where(inArray(engagementLeads.engagementId, dbIds)),
      db
        .select({
          engagementId: engagementManagers.engagementId,
          managerId: engagementManagers.managerId,
        })
        .from(engagementManagers)
        .where(inArray(engagementManagers.engagementId, dbIds)),
    ]);

    const projectByDbId = new Map(rows.map((r) => [r.id, projectRef(r)]));

    for (const member of clientRows) {
      const project = projectByDbId.get(member.engagementId) ?? null;
      addToBucket(buckets, member.userId, project, {
        primary: member.memberRole === 'owner',
      });
    }
    for (const lead of leadRows) {
      const project = projectByDbId.get(lead.engagementId);
      if (project) addInternKey(lead.internId, project);
    }
    for (const mgr of managerRows) {
      addToBucket(buckets, mgr.managerId, projectByDbId.get(mgr.engagementId) ?? null);
    }
  }

  if (ctx.role === 'intern') {
    const [self] = await db
      .select({ reportsToManagerId: profiles.reportsToManagerId })
      .from(profiles)
      .where(eq(profiles.id, ctx.userId))
      .limit(1);
    addToBucket(buckets, self?.reportsToManagerId, null);
  }

  const internProfiles = await profilesByInternKeys([...internKeysByProject.keys()]);
  for (const intern of internProfiles) {
    const keys = [intern.internId, intern.id].filter(Boolean) as string[];
    for (const key of keys) {
      for (const project of internKeysByProject.get(key) ?? []) {
        addToBucket(buckets, intern.id, project);
      }
    }
  }

  const clientScopeKeys = [
    ...new Set(rows.map((r) => r.clientId?.trim()).filter((k): k is string => Boolean(k))),
  ];
  if (clientScopeKeys.length > 0) {
    const clientByScope = await db
      .select({
        id: profiles.id,
        clientId: profiles.clientId,
      })
      .from(profiles)
      .where(and(eq(profiles.role, 'client'), inArray(profiles.clientId, clientScopeKeys)));
    for (const profile of clientByScope) {
      const key = profile.clientId?.trim();
      if (!key) continue;
      for (const row of rows) {
        if (row.clientId?.trim() !== key) continue;
        const project = projectRef(row);
        addToBucket(buckets, profile.id, project, {
          primary: !row.clientUserId || row.clientUserId === profile.id,
        });
      }
    }
  }

  const profileRows = await profilesByIds([...buckets.keys()]);
  const byId = new Map(profileRows.map((p) => [p.id, p]));

  const missingManagerIds = [
    ...new Set(
      profileRows
        .map((p) => p.reportsToManagerId)
        .filter((id): id is string => Boolean(id && !byId.has(id))),
    ),
  ];
  for (const row of await profilesByIds(missingManagerIds)) {
    byId.set(row.id, row);
  }

  const people: DirectoryPerson[] = [];
  for (const [userId, bucket] of buckets) {
    if (userId === ctx.userId) continue;
    const row = byId.get(userId);
    const email = row?.email?.trim();
    if (!row || !email) continue;
    const role = row.role as Role;
    const manager = row.reportsToManagerId ? byId.get(row.reportsToManagerId) : undefined;
    people.push({
      userId: row.id,
      name: row.name?.trim() || email,
      email,
      role,
      kind: kindForRole(role),
      status: row.status === 'inactive' ? 'inactive' : 'active',
      reportsToManagerId: row.reportsToManagerId ?? null,
      managerName: manager ? manager.name?.trim() || manager.email : null,
      projects: [...bucket.projects.values()].sort((a, b) =>
        a.companyName.localeCompare(b.companyName),
      ),
      primaryForProjectIds: [...bucket.primaryProjectIds],
    });
  }

  return people.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'firm' ? -1 : 1;
    if (a.role !== b.role) return a.role.localeCompare(b.role);
    return a.name.localeCompare(b.name);
  });
}
