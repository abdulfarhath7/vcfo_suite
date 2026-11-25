import 'server-only';
import { and, asc, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceSubjectFields, engagements, firmSettings, receivableClients, receivableSheets } from '@/db/schema';
import {
  integrationLinks,
  integrationOrgs,
  integrationSyncJobs,
  type LinkStatus,
  type LinkVcfoType,
  type SyncJobStatus,
  type ZohoApp,
} from '@/db/schema-integrations';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import type { DiscoveredOrg } from '@/lib/integrations/zoho/types';
import type { FirmTarget, MapItem, MapResult, MapTarget } from '@/lib/integrations/zoho/automap';
import { assertFirmIntegrationAdmin, assertIntegrationStaff } from './access';
import { getFirmConnection } from './connections';

/**
 * Organisations, links (the Match clients screen) and jobs of the firm Zoho connection.
 * Firm-wide admins only, except `mappedOrgForEngagement`, which any staff member who can reach
 * the engagement may call (a module's Sync from Zoho).
 */

export type OrgRow = typeof integrationOrgs.$inferSelect;
export type LinkRow = typeof integrationLinks.$inferSelect;
export type JobRow = typeof integrationSyncJobs.$inferSelect;

export async function listFirmOrgs(ctx: AuthContext): Promise<OrgRow[]> {
  assertFirmIntegrationAdmin(ctx);
  const conn = await getFirmConnection(ctx);
  if (!conn) return [];
  return db.select().from(integrationOrgs).where(eq(integrationOrgs.connectionId, conn.id)).orderBy(asc(integrationOrgs.app), asc(integrationOrgs.name));
}

export async function listFirmLinks(ctx: AuthContext): Promise<LinkRow[]> {
  assertFirmIntegrationAdmin(ctx);
  const conn = await getFirmConnection(ctx);
  if (!conn) return [];
  return db.select().from(integrationLinks).where(eq(integrationLinks.connectionId, conn.id)).orderBy(asc(integrationLinks.externalName));
}

export async function latestFirmJob(ctx: AuthContext, module = 'discover'): Promise<JobRow | null> {
  assertFirmIntegrationAdmin(ctx);
  const conn = await getFirmConnection(ctx);
  if (!conn) return null;
  const [row] = await db
    .select()
    .from(integrationSyncJobs)
    .where(and(eq(integrationSyncJobs.connectionId, conn.id), eq(integrationSyncJobs.module, module)))
    .orderBy(desc(integrationSyncJobs.createdAt))
    .limit(1);
  return row ?? null;
}

export type MapTargetOption = { vcfoType: Exclude<LinkVcfoType, 'firm'>; vcfoId: string; name: string; detail: string | null };

/** The VCFO records a link may point at, for the picker. */
export async function listMapTargetOptions(ctx: AuthContext): Promise<MapTargetOption[]> {
  assertFirmIntegrationAdmin(ctx);
  const engs = await db
    .select({ id: engagements.id, name: engagements.companyName })
    .from(engagements)
    .where(isNull(engagements.deletedAt))
    .orderBy(asc(engagements.companyName));
  const clients = await db
    .select({ id: receivableClients.id, name: receivableClients.name, sheet: receivableSheets.name })
    .from(receivableClients)
    .innerJoin(receivableSheets, eq(receivableSheets.id, receivableClients.sheetId))
    .where(eq(receivableClients.active, true))
    .orderBy(asc(receivableClients.name));
  return [
    ...engs.map((e) => ({ vcfoType: 'engagement' as const, vcfoId: e.id, name: e.name, detail: 'Project' })),
    ...clients.map((c) => ({ vcfoType: 'receivable_client' as const, vcfoId: c.id, name: c.name, detail: `Receivables · ${c.sheet}` })),
  ];
}

export type LinkDecision =
  | { action: 'accept' }
  | { action: 'ignore' }
  | { action: 'clear' }
  | { action: 'set'; vcfoType: LinkVcfoType; vcfoId: string | null };

/** Accept a suggestion, pick a target, ignore, or clear one link of the firm connection. */
export async function decideLink(ctx: AuthContext, linkId: string, decision: LinkDecision): Promise<LinkRow | null> {
  assertFirmIntegrationAdmin(ctx);
  const conn = await getFirmConnection(ctx);
  if (!conn) return null;
  const [link] = await db
    .select()
    .from(integrationLinks)
    .where(and(eq(integrationLinks.id, linkId), eq(integrationLinks.connectionId, conn.id)))
    .limit(1);
  if (!link) return null;

  const now = new Date();
  let set: Partial<typeof integrationLinks.$inferInsert>;
  if (decision.action === 'accept') {
    if (link.status !== 'suggested' || !link.vcfoType) return link;
    set = { status: 'mapped', match: 'manual' };
  } else if (decision.action === 'ignore') {
    set = { status: 'ignored', vcfoType: null, vcfoId: null, vcfoName: null, match: 'manual' };
  } else if (decision.action === 'clear') {
    set = { status: 'unmapped', vcfoType: null, vcfoId: null, vcfoName: null, match: null };
  } else {
    const name = await targetName(decision.vcfoType, decision.vcfoId);
    if (name === null) throw new Error('target_not_found');
    set = { status: 'mapped', match: 'manual', vcfoType: decision.vcfoType, vcfoId: decision.vcfoType === 'firm' ? null : decision.vcfoId, vcfoName: name };
  }
  const [row] = await db
    .update(integrationLinks)
    .set({ ...set, decidedBy: ctx.userId, decidedAt: now, updatedAt: now })
    .where(eq(integrationLinks.id, link.id))
    .returning();
  await recordAuditEvent(ctx, {
    action: 'integration.zoho.link',
    summary: `Zoho ${link.externalType.replace('_', ' ')} "${link.externalName}": ${decision.action}`,
    metadata: { linkId: link.id, app: link.app, decision: decision.action, vcfoType: row?.vcfoType ?? null, vcfoId: row?.vcfoId ?? null },
  });
  return row ?? null;
}

/** Accept every suggestion at once. */
export async function acceptAllSuggested(ctx: AuthContext): Promise<number> {
  assertFirmIntegrationAdmin(ctx);
  const conn = await getFirmConnection(ctx);
  if (!conn) return 0;
  const now = new Date();
  const rows = await db
    .update(integrationLinks)
    .set({ status: 'mapped', match: 'manual', decidedBy: ctx.userId, decidedAt: now, updatedAt: now })
    .where(and(eq(integrationLinks.connectionId, conn.id), eq(integrationLinks.status, 'suggested')))
    .returning({ id: integrationLinks.id });
  if (rows.length) {
    await recordAuditEvent(ctx, { action: 'integration.zoho.link', summary: `Accepted ${rows.length} suggested Zoho matches`, metadata: { count: rows.length } });
  }
  return rows.length;
}

async function targetName(type: LinkVcfoType, id: string | null): Promise<string | null> {
  if (type === 'firm') return (await firmName()) ?? 'Firm';
  if (!id) return null;
  if (type === 'engagement') {
    const [e] = await db.select({ name: engagements.companyName }).from(engagements).where(and(eq(engagements.id, id), isNull(engagements.deletedAt))).limit(1);
    return e?.name ?? null;
  }
  const [c] = await db.select({ name: receivableClients.name }).from(receivableClients).where(eq(receivableClients.id, id)).limit(1);
  return c?.name ?? null;
}

async function firmName(): Promise<string | null> {
  const [f] = await db.select({ name: firmSettings.firmName }).from(firmSettings).limit(1);
  return f?.name?.trim() || null;
}

/**
 * The Zoho organisation mapped to one client, for a module's Sync from Zoho. Staff who can reach
 * the engagement only; clients are refused before any query.
 */
export async function mappedOrgForEngagement(ctx: AuthContext, engagementId: string, app: ZohoApp): Promise<{ connectionId: string; externalOrgId: string; name: string } | null> {
  assertIntegrationStaff(ctx);
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) return null;
  const [link] = await db
    .select({ connectionId: integrationLinks.connectionId, externalId: integrationLinks.externalId, name: integrationLinks.externalName })
    .from(integrationLinks)
    .where(
      and(
        eq(integrationLinks.app, app),
        eq(integrationLinks.externalType, 'org'),
        eq(integrationLinks.vcfoType, 'engagement'),
        eq(integrationLinks.vcfoId, access.dbId),
        eq(integrationLinks.status, 'mapped'),
      ),
    )
    .limit(1);
  return link ? { connectionId: link.connectionId, externalOrgId: link.externalId, name: link.name } : null;
}

/* ------------------------------------------------------------ system (jobs only, no session) */

/** Jobs only: every VCFO record the auto map may match, with the GSTINs and PANs VCFO holds. */
export async function systemMapTargets(): Promise<{ targets: MapTarget[]; firm: FirmTarget }> {
  const engs = await db
    .select({ id: engagements.id, name: engagements.companyName, legal: engagements.subsidiaryLegalName, client: engagements.clientName })
    .from(engagements)
    .where(isNull(engagements.deletedAt));
  const ids = engs.map((e) => e.id);
  const fields = ids.length
    ? await db
        .select({ engagementId: complianceSubjectFields.engagementId, key: complianceSubjectFields.fieldKey, value: complianceSubjectFields.value })
        .from(complianceSubjectFields)
        .where(and(inArray(complianceSubjectFields.engagementId, ids), inArray(complianceSubjectFields.fieldKey, ['gstin', 'pan'])))
    : [];
  const byEng = new Map<string, { gstins: string[]; pans: string[] }>();
  for (const f of fields) {
    if (!f.value) continue;
    const slot = byEng.get(f.engagementId) ?? { gstins: [], pans: [] };
    (f.key === 'gstin' ? slot.gstins : slot.pans).push(f.value);
    byEng.set(f.engagementId, slot);
  }
  const clients = await db
    .select({ id: receivableClients.id, name: receivableClients.name, gstin: receivableClients.gstin })
    .from(receivableClients)
    .where(eq(receivableClients.active, true));
  const targets: MapTarget[] = [
    ...engs.map((e) => ({
      vcfoType: 'engagement' as const,
      vcfoId: e.id,
      name: e.name,
      aliases: [e.legal, e.client].filter((x): x is string => Boolean(x && x.trim())),
      gstins: byEng.get(e.id)?.gstins ?? [],
      pans: byEng.get(e.id)?.pans ?? [],
    })),
    ...clients.map((c) => ({ vcfoType: 'receivable_client' as const, vcfoId: c.id, name: c.name, gstins: c.gstin ? [c.gstin] : [] })),
  ];
  const env = process.env;
  const firm: FirmTarget = {
    name: (await firmName()) ?? env.ZOHO_FIRM_NAME?.trim() ?? '',
    gstins: (env.ZOHO_FIRM_GSTIN ?? '').split(/[\s,]+/).filter(Boolean),
    orgIds: (env.ZOHO_FIRM_ORG_ID ?? '').split(/[\s,]+/).filter(Boolean),
  };
  return { targets, firm };
}

/** Jobs only: replaces the connection's organisation list with what discovery found. */
export async function systemSaveOrgs(connectionId: string, orgs: DiscoveredOrg[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(integrationOrgs).where(eq(integrationOrgs.connectionId, connectionId));
    if (orgs.length === 0) return;
    await tx.insert(integrationOrgs).values(
      orgs.map((o) => ({
        connectionId,
        app: o.app,
        externalOrgId: o.externalOrgId,
        name: o.name,
        gstin: o.gstin,
        pan: o.pan,
        counts: o.counts,
        fieldCheck: o.fieldCheck ?? null,
      })),
    );
  });
}

export type LinkInput = MapItem & MapResult & { externalOrgId: string | null };

/**
 * Jobs only: saves the auto map. A link a person decided (`match = 'manual'`, mapped or ignored)
 * keeps its decision; only the Zoho name and ids are refreshed on it.
 */
export async function systemSaveLinks(connectionId: string, rows: LinkInput[]): Promise<{ mapped: number; suggested: number; unmapped: number; ignored: number }> {
  const existing = await db.select().from(integrationLinks).where(eq(integrationLinks.connectionId, connectionId));
  const key = (r: { app: string; externalType: string; externalId: string }) => `${r.app}|${r.externalType}|${r.externalId}`;
  const byKey = new Map(existing.map((e) => [key(e), e]));
  const now = new Date();
  const counts = { mapped: 0, suggested: 0, unmapped: 0, ignored: 0 };
  for (const r of rows) {
    const prev = byKey.get(key(r));
    const keep = prev && prev.match === 'manual';
    const status: LinkStatus = keep ? prev.status : r.status;
    counts[status] += 1;
    const base = {
      externalName: r.name,
      externalOrgId: r.externalOrgId,
      externalGstin: r.gstin,
      externalPan: r.pan,
      updatedAt: now,
    };
    if (prev) {
      await db
        .update(integrationLinks)
        .set(keep ? base : { ...base, status: r.status, match: r.match, vcfoType: r.vcfoType, vcfoId: r.vcfoId, vcfoName: r.vcfoName })
        .where(eq(integrationLinks.id, prev.id));
    } else {
      await db.insert(integrationLinks).values({
        connectionId,
        app: r.app,
        externalType: r.externalType,
        externalId: r.externalId,
        ...base,
        status: r.status,
        match: r.match,
        vcfoType: r.vcfoType,
        vcfoId: r.vcfoId,
        vcfoName: r.vcfoName,
      });
    }
  }
  return counts;
}

const STALE_JOB_MS = 20 * 60_000;

/** Jobs only: a new job, or null when one of the same module is already queued or running. */
export async function systemCreateJob(input: { connectionId: string; app: string; module: string; targetKey?: string; params?: Record<string, unknown>; requestedBy: string | null }): Promise<JobRow | null> {
  const targetKey = input.targetKey ?? '';
  // A job whose process died (an inline run cut off by a deploy) would block the module for ever.
  await db
    .update(integrationSyncJobs)
    .set({ status: 'failed', error: 'The job stopped before it finished. Run it again.', finishedAt: new Date() })
    .where(
      and(
        eq(integrationSyncJobs.connectionId, input.connectionId),
        eq(integrationSyncJobs.module, input.module),
        eq(integrationSyncJobs.targetKey, targetKey),
        inArray(integrationSyncJobs.status, ['queued', 'running']),
        lt(integrationSyncJobs.createdAt, new Date(Date.now() - STALE_JOB_MS)),
      ),
    );
  const [row] = await db
    .insert(integrationSyncJobs)
    .values({ connectionId: input.connectionId, app: input.app, module: input.module, targetKey, params: input.params ?? {}, requestedBy: input.requestedBy })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function systemJobById(id: string): Promise<JobRow | null> {
  const [row] = await db.select().from(integrationSyncJobs).where(eq(integrationSyncJobs.id, id)).limit(1);
  return row ?? null;
}

export async function systemUpdateJob(id: string, patch: { status?: SyncJobStatus; stats?: Record<string, unknown>; error?: string | null }): Promise<void> {
  const now = new Date();
  await db
    .update(integrationSyncJobs)
    .set({
      ...patch,
      ...(patch.status === 'running' ? { startedAt: now } : {}),
      ...(patch.status === 'done' || patch.status === 'failed' ? { finishedAt: now } : {}),
    })
    .where(eq(integrationSyncJobs.id, id));
}

/** Jobs only: organisations already linked to the firm on this connection. */
export async function systemFirmOrgIds(connectionId: string): Promise<string[]> {
  const rows = await db
    .select({ id: integrationLinks.externalId })
    .from(integrationLinks)
    .where(and(eq(integrationLinks.connectionId, connectionId), eq(integrationLinks.externalType, 'org'), eq(integrationLinks.vcfoType, 'firm'), eq(integrationLinks.status, 'mapped')));
  return rows.map((r) => r.id);
}
