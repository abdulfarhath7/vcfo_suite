import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { readAppRunner, rollBackTo } from '@/lib/dev/aws';
import { isKnownDeployImageForDev } from '@/db/repositories/dev-deploys';
import { recordAuditEvent } from '@/db/repositories/audit-events';

const Body = z.object({ image: z.string().min(3).max(400) });

/**
 * POST /api/dev/deploys/rollback { image }: "Roll back" production to an image the console
 * has seen the service run before (App Runner UpdateService). 404 for an image not in the
 * list, 409 for the current image or while another operation runs, 503 when
 * APP_RUNNER_SERVICE_ARN is not set. Every try writes `dev.deploy.rollback` with before and
 * after. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    if (!(await isKnownDeployImageForDev(ctx, body.image))) return { status: 404, body: { error: 'not_found' } };
    const { service } = await readAppRunner();
    if (service.state === 'not_set_up') return { status: 503, body: { error: 'not_set_up', missing: service.missing } };
    if (service.state === 'unreachable') return { status: 502, body: { error: 'unreachable' } };
    if (service.data.status !== 'RUNNING') return { status: 409, body: { error: 'busy' } };
    if (service.data.imageIdentifier === body.image) return { status: 409, body: { error: 'current' } };

    try {
      const out = await rollBackTo(body.image);
      await recordAuditEvent(ctx, {
        action: 'dev.deploy.rollback',
        summary: `Rolled production back to ${body.image.split('/').pop()}`,
        metadata: { operationId: out.operationId, before: out.before, after: body.image },
      });
      return { status: 200, body: { ok: true, operationId: out.operationId } };
    } catch (err) {
      await recordAuditEvent(ctx, {
        action: 'dev.deploy.rollback',
        summary: 'Roll back failed to start',
        metadata: { before: service.data.imageIdentifier, after: body.image, error: err instanceof Error ? err.name : 'Error' },
        result: 'failed',
      });
      throw err;
    }
  });
}
