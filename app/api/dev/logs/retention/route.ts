import { z } from 'zod';
import { devAction, devRoute } from '@/lib/dev/route-helpers';
import { RETENTION_DAYS, readLogRetention, setLogRetention } from '@/lib/dev/aws';
import { recordAuditEvent } from '@/db/repositories/audit-events';

/**
 * GET /api/dev/logs/retention: how long CloudWatch keeps the app's log lines.
 * POST /api/dev/logs/retention { days }: change it to 14, 30 or 90 days (PutRetentionPolicy)
 * and write `dev.logs.retention` with before and after. Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async () => readLogRetention());
}

const Body = z.object({ days: z.union([z.literal(RETENTION_DAYS[0]), z.literal(RETENTION_DAYS[1]), z.literal(RETENTION_DAYS[2])]) });

export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const cur = await readLogRetention();
    if (cur.state === 'not_set_up') return { status: 503, body: { error: 'not_set_up', missing: cur.missing } };
    if (cur.state === 'unreachable') return { status: 502, body: { error: 'unreachable' } };
    const before = cur.data.days ? `${cur.data.days} days` : 'Never expire';
    try {
      await setLogRetention(body.days);
    } catch (err) {
      await recordAuditEvent(ctx, { action: 'dev.logs.retention', summary: 'Log keep period not changed', metadata: { before, after: `${body.days} days` }, result: 'failed' });
      throw err;
    }
    await recordAuditEvent(ctx, { action: 'dev.logs.retention', summary: `Logs kept for ${body.days} days`, metadata: { group: cur.data.group, before, after: `${body.days} days` } });
    return { status: 200, body: { ok: true, days: body.days } };
  });
}
