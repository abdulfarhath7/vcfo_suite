import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/guards';
import { publicErrorMessage } from '@/lib/api-error';
import { getFirmConnection, latestFirmJob, listFirmLinks, listFirmOrgs } from '@/db/repositories/integrations';
import { appsInScopes, zohoConfigured } from '@/lib/integrations/zoho/oauth';
import type { ZohoAppSummaryDto, ZohoStatusDto } from '@/lib/integrations/zoho/wire';

/**
 * GET /api/integrations/zoho — the firm's Zoho connection, the last discovery, the organisations
 * found and every link for the Match clients screen. Super admin and admin. No token leaves.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const conn = await getFirmConnection(guard.ctx);
    const [job, orgs, links] = conn ? await Promise.all([latestFirmJob(guard.ctx), listFirmOrgs(guard.ctx), listFirmLinks(guard.ctx)]) : [null, [], []];
    const stats = (job?.stats ?? {}) as { step?: string; apps?: ZohoAppSummaryDto[]; links?: NonNullable<ZohoStatusDto['job']>['links'] };
    const body: ZohoStatusDto = {
      configured: zohoConfigured(),
      connection: conn
        ? {
            id: conn.id,
            status: conn.status,
            location: conn.location,
            apiDomain: conn.apiDomain,
            connectedAt: conn.connectedAt.toISOString(),
            lastUsedAt: conn.lastUsedAt?.toISOString() ?? null,
            lastError: conn.lastError,
            apps: appsInScopes(conn.scopes),
          }
        : null,
      job: job
        ? {
            id: job.id,
            status: job.status,
            step: stats.step ?? null,
            apps: stats.apps ?? [],
            links: stats.links ?? null,
            error: job.error,
            createdAt: job.createdAt.toISOString(),
            finishedAt: job.finishedAt?.toISOString() ?? null,
          }
        : null,
      orgs: orgs.map((o) => ({ id: o.id, app: o.app, externalOrgId: o.externalOrgId, name: o.name, gstin: o.gstin, counts: o.counts, fieldCheck: o.fieldCheck })),
      links: links.map((l) => ({
        id: l.id,
        app: l.app,
        externalType: l.externalType,
        externalId: l.externalId,
        externalName: l.externalName,
        externalGstin: l.externalGstin,
        vcfoType: l.vcfoType,
        vcfoId: l.vcfoId,
        vcfoName: l.vcfoName,
        match: l.match,
        status: l.status,
      })),
    };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, 'zoho_status_failed') }, { status: 500 });
  }
}
