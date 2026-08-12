import 'server-only';

import { and, eq, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementClients, engagements, profiles } from '@/db/schema';
import { engagementDbId, LEGACY_ENGAGEMENT_IDS } from '@/lib/legacy-engagement-ids';
import { getProgressCcRecipients } from '@/lib/email/merge-cc';
import { isUuid } from '@/lib/slug';
import { listLeadIdsByEngagementIds } from '@/db/repositories/engagement-leads-membership';

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
  manager: EngagementParty | null;
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

  const [primary, lead, manager] = await Promise.all([
    profileById(row.clientUserId),
    profileByInternKey(row.internId),
    profileById(row.managerId ?? row.adminId),
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
    progressCc,
  };
}
