import 'server-only';
import { and, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { integrationConnections, integrationLinks, integrationOrgs, integrationSyncJobs, profiles, receivableSheets } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import type { TallyJobDto, TallyJobStatus } from '@/lib/receivables/tally-live/wire';
import type { SheetSource, ZohoSheetStatusDto } from '@/lib/integrations/zoho/wire';
import { ISO_DATE, UUID, conflict, invalid, logChange, notFound, scopedSheet, type SheetRow } from './shared';
import { jobActor } from './tally-sync';

/**
 * RECEIVABLES — Sync from Zoho Books (docs/specs/integrations/ZOHO.md). A sheet's source is
 * excel, tally or zoho. Picking zoho and the Books (or Invoice) organisation behind the sheet is
 * for firm-wide admins only, because the organisation lives on the firm's Zoho connection; anyone
 * who may edit the sheet (`scopedSheet`) may then press Sync. A sync is an `integration_sync_jobs`
 * row (module `receivables`, one active job per sheet); its result is staged in the same approval
 * panel as a Tally sync, as the person who pressed Sync.
 */

const MODULE = 'receivables';
const MAX_DAYS = 400;
type SyncJobRow = typeof integrationSyncJobs.$inferSelect;
export type ZohoSyncParams = { sheetId: string; type: 'sales' | 'receipts'; from: string; to: string; app: 'books' | 'invoice'; orgId: string };

async function liveConnection() {
  const [row] = await db
    .select({ id: integrationConnections.id })
    .from(integrationConnections)
    .where(and(eq(integrationConnections.provider, 'zoho'), eq(integrationConnections.scope, 'firm'), isNull(integrationConnections.revokedAt)))
    .orderBy(desc(integrationConnections.connectedAt))
    .limit(1);
  return row ?? null;
}

function toJobDto(row: SyncJobRow, requestedByName: string | null): TallyJobDto {
  const p = row.params as Partial<ZohoSyncParams>;
  const s = row.stats as Partial<NonNullable<TallyJobDto['stats']>> & { step?: string };
  return {
    id: row.id,
    type: p.type === 'receipts' ? 'receipts' : 'sales',
    from: p.from ?? '',
    to: p.to ?? '',
    status: row.status as TallyJobStatus,
    error: row.error,
    stats: row.status === 'done' ? { vouchers: s.vouchers ?? 0, staged: s.staged ?? 0, skipped: s.skipped ?? 0, receipts: s.receipts ?? 0, notes: s.notes ?? [] } : null,
    requestedByName,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

async function jobsOfSheet(sheetId: string, limit: number) {
  return db
    .select({ job: integrationSyncJobs, name: profiles.name })
    .from(integrationSyncJobs)
    .leftJoin(profiles, eq(profiles.id, integrationSyncJobs.requestedBy))
    .where(and(eq(integrationSyncJobs.module, MODULE), eq(integrationSyncJobs.targetKey, sheetId)))
    .orderBy(desc(integrationSyncJobs.createdAt))
    .limit(limit);
}

async function orgName(sheet: SheetRow, connectionId: string | null): Promise<string | null> {
  if (!connectionId || !sheet.zohoOrgId || !sheet.zohoApp) return null;
  const [o] = await db
    .select({ name: integrationOrgs.name })
    .from(integrationOrgs)
    .where(and(eq(integrationOrgs.connectionId, connectionId), eq(integrationOrgs.app, sheet.zohoApp as 'books' | 'invoice'), eq(integrationOrgs.externalOrgId, sheet.zohoOrgId)))
    .limit(1);
  return o?.name ?? null;
}

export async function getZohoSheetStatus(ctx: AuthContext, sheetId: string): Promise<ZohoSheetStatusDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  const conn = await liveConnection();
  const canChoose = isFirmWideAdmin(ctx.role);
  let orgs: ZohoSheetStatusDto['orgs'] = [];
  if (canChoose && conn) {
    const rows = await db
      .select({ app: integrationOrgs.app, externalOrgId: integrationOrgs.externalOrgId, name: integrationOrgs.name })
      .from(integrationOrgs)
      .where(and(eq(integrationOrgs.connectionId, conn.id), inArray(integrationOrgs.app, ['books', 'invoice'])));
    const firm = await db
      .select({ id: integrationLinks.externalId })
      .from(integrationLinks)
      .where(and(eq(integrationLinks.connectionId, conn.id), eq(integrationLinks.externalType, 'org'), eq(integrationLinks.vcfoType, 'firm'), eq(integrationLinks.status, 'mapped')));
    const firmIds = new Set(firm.map((f) => f.id));
    orgs = rows.map((r) => ({ app: r.app as 'books' | 'invoice', externalOrgId: r.externalOrgId, name: r.name, isFirm: firmIds.has(r.externalOrgId) }));
  }
  const [latest] = await jobsOfSheet(sheet.id, 1);
  const active = latest && (latest.job.status === 'queued' || latest.job.status === 'running') ? toJobDto(latest.job, latest.name ?? null) : null;
  return {
    source: (['excel', 'tally', 'zoho'].includes(sheet.source) ? sheet.source : 'excel') as SheetSource,
    zohoApp: sheet.zohoApp === 'books' || sheet.zohoApp === 'invoice' ? sheet.zohoApp : null,
    zohoOrgId: sheet.zohoOrgId,
    zohoOrgName: await orgName(sheet, conn?.id ?? null),
    connected: Boolean(conn),
    canChoose,
    orgs,
    activeJob: active,
  };
}

/** Sets the sheet's source. Only firm-wide admins may choose Zoho and its organisation. */
export async function setSheetSource(ctx: AuthContext, sheetId: string, input: { source: unknown; zohoApp?: unknown; zohoOrgId?: unknown }): Promise<ZohoSheetStatusDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  const source = input.source === 'excel' || input.source === 'tally' || input.source === 'zoho' ? input.source : null;
  if (!source) throw invalid('sheet_source');
  const set: Partial<typeof receivableSheets.$inferInsert> = { source, updatedAt: new Date() };
  if (source === 'zoho') {
    if (!isFirmWideAdmin(ctx.role)) throw notFound();
    const app = input.zohoApp === 'books' || input.zohoApp === 'invoice' ? input.zohoApp : null;
    const orgId = typeof input.zohoOrgId === 'string' ? input.zohoOrgId.trim() : '';
    if (!app || !orgId) throw invalid('zoho_org');
    const conn = await liveConnection();
    if (!conn) throw conflict('zoho_not_connected');
    const [org] = await db
      .select({ id: integrationOrgs.id, name: integrationOrgs.name })
      .from(integrationOrgs)
      .where(and(eq(integrationOrgs.connectionId, conn.id), eq(integrationOrgs.app, app), eq(integrationOrgs.externalOrgId, orgId)))
      .limit(1);
    if (!org) throw invalid('zoho_org');
    set.zohoApp = app;
    set.zohoOrgId = orgId;
    await db.update(receivableSheets).set(set).where(eq(receivableSheets.id, sheet.id));
    await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: `Sheet source set to Zoho ${app === 'books' ? 'Books' : 'Invoice'} (${org.name})`, affectsPage: false });
  } else {
    await db.update(receivableSheets).set(set).where(eq(receivableSheets.id, sheet.id));
    if (sheet.source !== source) await logChange({ sheetId: sheet.id, invoiceId: null, actorId: ctx.userId, summary: `Sheet source set to ${source === 'tally' ? 'Tally' : 'Excel'}`, affectsPage: false });
  }
  return getZohoSheetStatus(ctx, sheet.id);
}

/** Queues one Sync from Zoho. The caller runs it (Inngest or inline). */
export async function queueZohoSheetSync(ctx: AuthContext, sheetId: string, input: { type: unknown; from: unknown; to: unknown }): Promise<TallyJobDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  const type = input.type === 'sales' || input.type === 'receipts' ? input.type : null;
  if (!type) throw invalid('sync_type');
  const from = typeof input.from === 'string' && ISO_DATE.test(input.from) ? input.from : null;
  const to = typeof input.to === 'string' && ISO_DATE.test(input.to) ? input.to : null;
  if (!from || !to) throw invalid('sync_period');
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(days) || days < 0 || days > MAX_DAYS) throw invalid('sync_period');
  if (sheet.source !== 'zoho' || !sheet.zohoOrgId || (sheet.zohoApp !== 'books' && sheet.zohoApp !== 'invoice')) throw conflict('zoho_not_set_up');
  const conn = await liveConnection();
  if (!conn) throw conflict('zoho_not_connected');
  const params: ZohoSyncParams = { sheetId: sheet.id, type, from, to, app: sheet.zohoApp, orgId: sheet.zohoOrgId };
  // A job whose process died would block the sheet; one older than 20 minutes is closed first.
  await db
    .update(integrationSyncJobs)
    .set({ status: 'failed', error: 'The sync stopped before it finished. Try again.', finishedAt: new Date() })
    .where(and(eq(integrationSyncJobs.module, MODULE), eq(integrationSyncJobs.targetKey, sheet.id), inArray(integrationSyncJobs.status, ['queued', 'running']), lt20()));
  const [row] = await db
    .insert(integrationSyncJobs)
    .values({ connectionId: conn.id, app: sheet.zohoApp, module: MODULE, targetKey: sheet.id, params, requestedBy: ctx.userId })
    .onConflictDoNothing()
    .returning();
  if (!row) throw conflict('sync_running');
  return toJobDto(row, ctx.name);
}

function lt20() {
  const cutoff = new Date(Date.now() - 20 * 60_000);
  return lt(integrationSyncJobs.createdAt, cutoff);
}

export async function getZohoSheetSyncJob(ctx: AuthContext, sheetId: string, jobId: string): Promise<TallyJobDto> {
  const sheet = await scopedSheet(ctx, sheetId);
  if (!UUID.test(jobId ?? '')) throw notFound();
  const [row] = await db
    .select({ job: integrationSyncJobs, name: profiles.name })
    .from(integrationSyncJobs)
    .leftJoin(profiles, eq(profiles.id, integrationSyncJobs.requestedBy))
    .where(and(eq(integrationSyncJobs.id, jobId), eq(integrationSyncJobs.module, MODULE), eq(integrationSyncJobs.targetKey, sheet.id)))
    .limit(1);
  if (!row) throw notFound();
  return toJobDto(row.job, row.name ?? null);
}

/**
 * Jobs only: a queued receivables sync, its parameters and the person who pressed Sync, rebuilt
 * as an AuthContext (null when they may no longer edit receivables). Marks the job running.
 */
export async function systemStartZohoSheetSync(jobId: string): Promise<{ job: SyncJobRow; params: ZohoSyncParams; ctx: AuthContext | null } | null> {
  const [job] = await db.select().from(integrationSyncJobs).where(and(eq(integrationSyncJobs.id, jobId), eq(integrationSyncJobs.module, MODULE))).limit(1);
  if (!job || job.status !== 'queued') return null;
  await db.update(integrationSyncJobs).set({ status: 'running', startedAt: new Date() }).where(eq(integrationSyncJobs.id, job.id));
  return { job, params: job.params as ZohoSyncParams, ctx: await jobActor(job.requestedBy) };
}
