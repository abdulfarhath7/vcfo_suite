import 'server-only';
import {
  connFor,
  systemConnectionById,
  systemCreateJob,
  systemFirmOrgIds,
  systemJobById,
  systemMapTargets,
  systemSaveLinks,
  systemSaveOrgs,
  systemTouchConnection,
  systemUpdateJob,
} from '@/db/repositories/integrations';
import { appsInScopes, consentApps } from './oauth';
import { discoverAll, mapDiscovery } from './discover';

/** The Inngest event; the function is `src/jobs/integrations-zoho.ts`. */
export const ZOHO_DISCOVER_EVENT = 'integrations/zoho.discover';

/**
 * True while `zohoDiscover` and `zohoReceivablesSync` are listed in app/api/inngest/route.ts. Set it
 * to false if they are taken out: a sent event would wait for a function that does not exist.
 */
export const ZOHO_JOBS_REGISTERED = true;

/**
 * Starts discovery for a connection: a job row, then Inngest, or this process when Inngest is not
 * reachable (local dev), the same fallback as `queueAskDrop`. Returns null when one is already running.
 */
export async function queueZohoDiscover(connectionId: string, requestedBy: string | null): Promise<{ jobId: string; mode: 'queued' | 'inline' } | null> {
  const job = await systemCreateJob({ connectionId, app: 'all', module: 'discover', requestedBy });
  if (!job) return null;
  if (!ZOHO_JOBS_REGISTERED) {
    void runZohoDiscover(job.id);
    return { jobId: job.id, mode: 'inline' };
  }
  try {
    const { inngest } = await import('@/jobs/client');
    await inngest.send({ name: ZOHO_DISCOVER_EVENT, data: { jobId: job.id } });
    return { jobId: job.id, mode: 'queued' };
  } catch (error) {
    console.warn('[zoho] inngest unavailable; running discovery inline', error instanceof Error ? error.message : error);
    void runZohoDiscover(job.id);
    return { jobId: job.id, mode: 'inline' };
  }
}

/** Runs one discovery job to the end. Never throws: a failure is written on the job. */
export async function runZohoDiscover(jobId: string): Promise<void> {
  const job = await systemJobById(jobId);
  if (!job || job.status === 'done' || job.status === 'failed') return;
  try {
    const row = await systemConnectionById(job.connectionId);
    if (!row || row.revokedAt) throw new Error('Zoho is not connected');
    await systemUpdateJob(jobId, { status: 'running', stats: { step: 'starting' } });
    const granted = appsInScopes(row.scopes);
    const apps = granted.length ? granted : consentApps();
    const conn = connFor(row);
    const { results, summary } = await discoverAll(conn, apps, (app, done) => systemUpdateJob(jobId, { stats: { step: app, apps: done } }));
    await systemUpdateJob(jobId, { stats: { step: 'matching', apps: summary } });
    await systemSaveOrgs(row.id, results.flatMap((r) => r.orgs));
    const { targets, firm } = await systemMapTargets();
    const links = mapDiscovery(results, targets, firm, await systemFirmOrgIds(row.id));
    const matched = await systemSaveLinks(row.id, links);
    await systemTouchConnection(row.id);
    await systemUpdateJob(jobId, { status: 'done', stats: { step: 'done', apps: summary, links: matched } });
  } catch (err) {
    await systemUpdateJob(jobId, { status: 'failed', error: (err instanceof Error ? err.message : 'Discovery failed').slice(0, 300) }).catch(() => undefined);
  }
}
