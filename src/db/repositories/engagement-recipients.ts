import 'server-only';

import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementClients, engagements, profiles } from '@/db/schema';
import { engagementDbId, LEGACY_ENGAGEMENT_IDS } from '@/lib/legacy-engagement-ids';
import { getProgressCcRecipients } from '@/lib/email/merge-cc';
import { isUuid } from '@/lib/slug';
import { listLeadIdsByEngagementIds } from '@/db/repositories/engagement-leads-membership';
import { listManagerIdsForEngagement } from '@/db/repositories/engagement-managers-membership';

export type EngagementParty = {
  userId: string;
  email: string;
  name: string;
};

export type EngagementRecipients = {
  dbId: string;
  appId: string;
  slug: string;
  companyName: string;
  /** Primary client (legacy pointer). */
  client: EngagementParty | null;
  /** All client members on the engagement (includes primary). */
  clients: EngagementParty[];
  /** Primary lead (engagements.intern_id). */
  lead: EngagementParty | null;
  /** All leads from engagement_leads (+ primary if missing). */
  leads: EngagementParty[];
  /** Primary PM (`engagements.manager_id`, else first membership / fallback). */
  manager: EngagementParty | null;
  /** All PMs from engagement_managers (+ primary if missing). */
  managers: EngagementParty[];
  /** Active firm admins / super admins (CC on manager → client approval). */
  admins: EngagementParty[];
  progressCc: string[];
};

async function profileById(id: string | null | undefined): Promise<EngagementParty | null> {
  if (!id?.trim() || !isUuid(id.trim())) return null;
  const [row] = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, id.trim()))
    .limit(1);
  if (!row?.email?.trim()) return null;
  return {
    userId: row.id,
    email: row.email.trim(),
    name: row.name?.trim() || row.email.trim(),
  };
}

async function profileByInternKey(internKey: string | null | undefined): Promise<EngagementParty | null> {
  if (!internKey?.trim()) return null;
  const key = internKey.trim();
  // Only OR against profiles.id when key is a UUID — otherwise Postgres rejects
  // `id = 'i…'` and the whole recipient resolve (and email fan-out) fails.
  const match = isUuid(key)
    ? or(eq(profiles.internId, key), eq(profiles.id, key))
    : eq(profiles.internId, key);

  const [row] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
      internId: profiles.internId,
    })
    .from(profiles)
    .where(and(eq(profiles.role, 'intern'), match))
    .limit(1);
  if (!row?.email?.trim()) return null;
  return {
    userId: row.id,
    email: row.email.trim(),
    name: row.name?.trim() || row.email.trim(),
  };
}

async function loadEngagementRow(appOrDbEngagementId: string) {
  const raw = appOrDbEngagementId.trim();
  if (!raw) return null;

  const mapped = engagementDbId(raw);
  if (isUuid(mapped)) {
    const [byId] = await db.select().from(engagements).where(eq(engagements.id, mapped)).limit(1);
    if (byId) return byId;
  }

  // Slug or other route param (e.g. asdf-2) — never pass non-UUIDs into id = $1.
  const [bySlug] = await db.select().from(engagements).where(eq(engagements.slug, raw)).limit(1);
  return bySlug ?? null;
}

/**
 * Resolve client / project lead / manager emails for an engagement.
 * Call after a mutation already authorized access to the engagement.
 */
export async function resolveEngagementRecipients(
  appOrDbEngagementId: string,
): Promise<EngagementRecipients | null> {
  const row = await loadEngagementRow(appOrDbEngagementId);
  if (!row) return null;

  const memberRows = await db
    .select({
      userId: engagementClients.userId,
      email: profiles.email,
      name: profiles.name,
    })
    .from(engagementClients)
    .innerJoin(profiles, eq(profiles.id, engagementClients.userId))
    .where(eq(engagementClients.engagementId, row.id));

  const clients: EngagementParty[] = memberRows
    .filter((m) => m.email?.trim())
    .map((m) => ({
      userId: m.userId,
      email: m.email.trim(),
      name: m.name?.trim() || m.email.trim(),
    }));

  const [primary, lead] = await Promise.all([
    profileById(row.clientUserId),
    profileByInternKey(row.internId),
  ]);

  if (primary && !clients.some((c) => c.userId === primary.userId)) {
    clients.unshift(primary);
  }

  const leadIdMap = await listLeadIdsByEngagementIds([row.id]);
  const leadKeys = leadIdMap.get(row.id) ?? [];
  if (row.internId?.trim() && !leadKeys.includes(row.internId.trim())) {
    leadKeys.unshift(row.internId.trim());
  }
  const leadParties = (
    await Promise.all(leadKeys.map((key) => profileByInternKey(key)))
  ).filter((p): p is EngagementParty => Boolean(p));
  const leads: EngagementParty[] = [];
  for (const p of leadParties) {
    if (!leads.some((l) => l.userId === p.userId)) leads.push(p);
  }
  if (lead && !leads.some((l) => l.userId === lead.userId)) {
    leads.unshift(lead);
  }

  const managerIdQueue: string[] = [];
  const pushManagerId = (id: string | null | undefined) => {
    const v = id?.trim();
    if (!v || !isUuid(v) || managerIdQueue.includes(v)) return;
    managerIdQueue.push(v);
  };
  pushManagerId(row.managerId);
  const membershipManagerIds = await listManagerIdsForEngagement(row.id);
  for (const id of membershipManagerIds) pushManagerId(id);
  if (managerIdQueue.length === 0) pushManagerId(row.adminId);
  if (managerIdQueue.length === 0) {
    const internProfileId = (lead ?? leads[0])?.userId;
    if (internProfileId) {
      const [internRow] = await db
        .select({ reportsToManagerId: profiles.reportsToManagerId })
        .from(profiles)
        .where(eq(profiles.id, internProfileId))
        .limit(1);
      pushManagerId(internRow?.reportsToManagerId);
    }
  }

  const managerParties = (
    await Promise.all(managerIdQueue.map((id) => profileById(id)))
  ).filter((p): p is EngagementParty => Boolean(p));
  const managers: EngagementParty[] = [];
  for (const p of managerParties) {
    if (!managers.some((m) => m.userId === p.userId)) managers.push(p);
  }
  const manager =
    managers.find((m) => m.userId === row.managerId) ?? managers[0] ?? null;

  const adminRows = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name })
    .from(profiles)
    .where(
      and(
        inArray(profiles.role, ['admin', 'super_admin']),
        eq(profiles.status, 'active'),
      ),
    );
  const admins: EngagementParty[] = [];
  for (const a of adminRows) {
    const email = a.email?.trim();
    if (!email) continue;
    if (admins.some((x) => x.userId === a.id)) continue;
    admins.push({
      userId: a.id,
      email,
      name: a.name?.trim() || email,
    });
  }

  const client = primary ?? clients[0] ?? null;
  const progressCc = getProgressCcRecipients(row.progressCcEmails ?? [], {
    excludeTo: client?.email,
  });

  return {
    dbId: row.id,
    appId: LEGACY_ENGAGEMENT_IDS[row.id] ?? row.id,
    slug: row.slug,
    companyName: row.companyName,
    client,
    clients,
    lead: lead ?? leads[0] ?? null,
    leads,
    manager,
    managers,
    admins,
    progressCc,
  };
}
