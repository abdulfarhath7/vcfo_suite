import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { readServiceConfig } from '@/lib/dev/env-status';
import { listOutlookConnectionsForDev } from '@/db/repositories/dev-connections';
import type { ConnectionsPayload } from '@/lib/dev/types';

/**
 * GET /api/dev/connections: the configured state of each outside service (env var names
 * only, never values) and the linked Outlook mailboxes (no tokens). Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<ConnectionsPayload> => ({
    services: readServiceConfig(),
    outlook: await listOutlookConnectionsForDev(ctx),
  }));
}
