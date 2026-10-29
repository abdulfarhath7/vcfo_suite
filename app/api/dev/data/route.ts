import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { getDatabaseFactsForDev, getDatabaseStatsForDev, getMonthVolumesForDev } from '@/db/repositories/dev-data';
import { readBucketStats, readCosts, readCostsByMonth } from '@/lib/dev/aws';
import type { DataExtra, DataPayload } from '@/lib/dev/types';

/**
 * GET /api/dev/data: table row estimates and sizes for the public schema, database facts
 * (version, connections, vacuum), this month's volumes from the app's tables, the storage
 * bucket (S3 or MinIO), and, when AWS_COST_EXPLORER=on, AWS costs for the last 30 days by
 * service and for the last six months. Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<DataPayload & DataExtra> => {
    const [database, costs, facts, volumes, months, bucket] = await Promise.all([
      getDatabaseStatsForDev(ctx),
      readCosts(30),
      getDatabaseFactsForDev(ctx),
      getMonthVolumesForDev(ctx),
      readCostsByMonth(6),
      readBucketStats(),
    ]);
    return { database, costs, facts, volumes, months, bucket };
  });
}
