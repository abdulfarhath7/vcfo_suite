import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { registeredJobs } from '@/lib/dev/jobs-registry';
import { runJobNow } from '@/lib/dev/inngest';
import { getDevSwitchForDev } from '@/db/repositories/dev-settings';
import { recordAuditEvent } from '@/db/repositories/audit-events';

const Body = z.object({ functionId: z.string().min(1).max(120) });

/**
 * POST /api/dev/jobs/run: "Run now". Sends the job's `dev/run.<id>` event once. 409 when the
 * job does not listen to that event or jobs are paused, 503 without INNGEST_EVENT_KEY.
 * Every try writes a `dev.job.run` audit row. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const fn = registeredJobs().find((f) => f.id === body.functionId);
    if (!fn) return { status: 404, body: { error: 'not_found' } };
    if (!fn.runEvent) return { status: 409, body: { error: 'not_runnable' } };
    if ((await getDevSwitchForDev(ctx, 'jobs.paused')).on) return { status: 409, body: { error: 'paused' } };
    try {
      const out = await runJobNow(fn, ctx.name || ctx.email);
      await recordAuditEvent(ctx, { action: 'dev.job.run', summary: `Started ${fn.id} by hand`, metadata: { functionId: fn.id, sentIds: out.sentIds } });
      return { status: 200, body: { ok: true } };
    } catch (err) {
      const code = err instanceof Error && err.message === 'not_set_up' ? 'not_set_up' : 'unreachable';
      await recordAuditEvent(ctx, { action: 'dev.job.run', summary: `Could not start ${fn.id}`, metadata: { functionId: fn.id, error: code }, result: 'failed' });
      return { status: code === 'not_set_up' ? 503 : 502, body: { error: code } };
    }
  });
}
