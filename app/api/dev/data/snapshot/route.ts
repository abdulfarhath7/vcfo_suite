import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { takeRdsSnapshot } from '@/lib/dev/rds';
import { recordAuditEvent } from '@/db/repositories/audit-events';

/**
 * POST /api/dev/data/snapshot: "Take snapshot now" (P-372), one manual RDS snapshot of
 * RDS_INSTANCE_ID. 503 when it is not set. Every try writes `dev.db.snapshot`.
 * Developer or super admin. There is no restore route on purpose (see AWS-DEPLOY.md).
 */
export async function POST(request: Request) {
  return devAction(request, z.object({}), async (ctx) => {
    if (!process.env.RDS_INSTANCE_ID?.trim()) return { status: 503, body: { error: 'not_set_up', missing: ['RDS_INSTANCE_ID'] } };
    try {
      const out = await takeRdsSnapshot();
      await recordAuditEvent(ctx, { action: 'dev.db.snapshot', summary: `Snapshot ${out.id} started`, metadata: { snapshot: out.id, before: 'None', after: out.status } });
      return { status: 200, body: { ok: true, id: out.id } };
    } catch (err) {
      await recordAuditEvent(ctx, {
        action: 'dev.db.snapshot',
        summary: 'Snapshot did not start',
        metadata: { error: err instanceof Error ? err.name : 'Error' },
        result: 'failed',
      });
      return { status: 502, body: { error: 'unreachable' } };
    }
  });
}
