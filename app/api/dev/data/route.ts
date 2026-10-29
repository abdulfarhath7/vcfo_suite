import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { getDatabaseStatsForDev } from '@/db/repositories/dev-data';
import { readCosts } from '@/lib/dev/aws';
import type { DataPayload } from '@/lib/dev/types';

/**
 * GET /api/dev/data: table row estimates and sizes for the public schema, and AWS costs for
 * the last 30 days by service when AWS_COST_EXPLORER=on. Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<DataPayload> => {
    const [database, costs] = await Promise.all([getDatabaseStatsForDev(ctx), readCosts(30)]);
    return { database, costs };
  });
}
