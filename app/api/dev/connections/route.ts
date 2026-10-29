import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { readServiceConfig } from '@/lib/dev/env-status';
import { serviceMeta } from '@/lib/dev/service-meta';
import { healthByService } from '@/lib/dev/health';
import { listOutlookConnectionsForDev } from '@/db/repositories/dev-connections';
import { listServiceChecksForDev } from '@/db/repositories/dev-checks';
import type { ConnectionsPayload } from '@/lib/dev/types';

/**
 * GET /api/dev/connections: each outside service's configured state (env var names only),
 * its account, endpoint and scopes, its uptime, p95 and last check from the stored live
 * checks, and the linked Outlook mailboxes (no tokens). Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<ConnectionsPayload> => {
    const [outlook, checks] = await Promise.all([listOutlookConnectionsForDev(ctx), listServiceChecksForDev(ctx, { days: 30 })]);
    const services = readServiceConfig();
    const soonest = outlook.map((o) => o.expiresAt).sort()[0] ?? null;
    return {
      services,
      outlook,
      health: healthByService(services.map((s) => s.id), checks),
      meta: serviceMeta(services, process.env, soonest),
    };
  });
}
