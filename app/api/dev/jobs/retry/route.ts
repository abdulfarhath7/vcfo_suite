import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { registeredJobs } from '@/lib/dev/jobs-registry';
import { retryInngestRun } from '@/lib/dev/inngest';
import { recordAuditEvent } from '@/db/repositories/audit-events';

const Id = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/, 'invalid id');
const Body = z.object({ runId: Id, eventId: Id });

/**
 * POST /api/dev/jobs/retry: start a failed Inngest run again by sending the event that
 * started it once more (`retryInngestRun`). Only a run of an event function with a single
 * listener qualifies; a cron run answers 409. Every try writes a `dev.job.retry` audit row,
 * ok or failed. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const out = await retryInngestRun(body, registeredJobs());
    if (out.ok === false) {
      if (out.error === 'not_set_up') return { status: 503, body: { error: 'not_set_up', missing: out.missing ?? [] } };
      await recordAuditEvent(ctx, {
        action: 'dev.job.retry',
        summary: `Retry refused for run ${body.runId}: ${out.error === 'not_found' ? 'run not found' : 'not retryable'}`,
        metadata: { runId: body.runId, eventId: body.eventId },
        result: 'failed',
      });
      return { status: out.error === 'not_found' ? 404 : 409, body: { error: out.error } };
    }
    await recordAuditEvent(ctx, {
      action: 'dev.job.retry',
      summary: `Run ${body.runId} of ${out.functionId ?? out.event} queued again`,
      metadata: { runId: body.runId, eventId: body.eventId, event: out.event, sentIds: out.sentIds, before: 'Failed', after: 'Queued' },
    });
    return { status: 200, body: { ok: true, functionId: out.functionId } };
  });
}
