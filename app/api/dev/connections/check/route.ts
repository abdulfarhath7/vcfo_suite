import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { probeFor, runProbe } from '@/lib/dev/checks';
import { readServiceConfig } from '@/lib/dev/env-status';
import { recordServiceCheckForDev } from '@/db/repositories/dev-checks';
import { recordAuditEvent } from '@/db/repositories/audit-events';

const SERVICE_IDS = ['email', 'whatsapp', 'storage', 'jobs', 'ask', 'outlook', 'credentials', 'logs', 'deploys'] as const;
const Body = z.object({ service: z.enum(SERVICE_IDS) });

/**
 * POST /api/dev/connections/check: "Test" on Connections. Runs one read-only live check of
 * the service with the app's own settings, stores it (uptime, p95, incidents and last check
 * read these rows) and writes a `dev.connection.test` audit row. 503 when the service is not
 * set up. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const svc = readServiceConfig().find((s) => s.id === body.service);
    const probe = probeFor(body.service);
    if (!svc || svc.status === 'off' || !probe) return { status: 503, body: { error: 'not_set_up', missing: svc?.missing ?? [] } };

    const out = await runProbe(probe);
    const check = await recordServiceCheckForDev(ctx, { service: body.service, ...out });
    await recordAuditEvent(ctx, {
      action: 'dev.connection.test',
      summary: `${svc.name} test ${out.ok ? 'passed' : 'failed'}`,
      metadata: { service: body.service, latencyMs: out.latencyMs },
      result: out.ok ? 'ok' : 'failed',
    });
    return { status: 200, body: { ok: out.ok, check } };
  });
}
