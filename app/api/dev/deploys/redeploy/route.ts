import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { readAppRunner, startRedeploy } from '@/lib/dev/aws';
import { recordAuditEvent } from '@/db/repositories/audit-events';

/**
 * POST /api/dev/deploys/redeploy: App Runner StartDeployment for the production service (R-40).
 * It rolls out the image the service already names and changes nothing else. 409 while
 * another operation runs, 503 when APP_RUNNER_SERVICE_ARN is not set. Every try writes a
 * `dev.deploy.start` audit row. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, z.object({}), async (ctx) => {
    const { service } = await readAppRunner();
    if (service.state === 'not_set_up') return { status: 503, body: { error: 'not_set_up', missing: service.missing } };
    if (service.state === 'unreachable') return { status: 502, body: { error: 'unreachable' } };
    if (service.data.status !== 'RUNNING') {
      return { status: 409, body: { error: 'busy', status: service.data.status } };
    }

    try {
      const { operationId } = await startRedeploy();
      await recordAuditEvent(ctx, {
        action: 'dev.deploy.start',
        summary: `Redeploy of ${service.data.name || 'the service'} started`,
        metadata: { operationId, image: service.data.image, before: service.data.image ?? 'Running', after: 'Redeploying' },
      });
      return { status: 200, body: { ok: true, operationId } };
    } catch (err) {
      await recordAuditEvent(ctx, {
        action: 'dev.deploy.start',
        summary: `Redeploy of ${service.data.name || 'the service'} failed to start`,
        metadata: { error: err instanceof Error ? err.name : 'Error' },
        result: 'failed',
      });
      throw err;
    }
  });
}
