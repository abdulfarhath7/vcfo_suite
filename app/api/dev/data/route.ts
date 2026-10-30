import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { getDatabaseFactsForDev, getDatabaseStatsForDev, getMonthVolumesForDev } from '@/db/repositories/dev-data';
import { readBucketStats, readCosts, readCostsByMonth } from '@/lib/dev/aws';
import { readRdsBackups } from '@/lib/dev/rds';
import { readBackupPlan, readNetwork } from '@/lib/dev/soc';
import { listExportFilesForDev } from '@/db/repositories/export-files';
import type { DataExtra, DataPayload } from '@/lib/dev/types';

/**
 * GET /api/dev/data: table row estimates and sizes for the public schema, database facts
 * (version, connections, vacuum), this month's volumes from the app's tables, the storage
 * bucket (S3 or MinIO), and, when AWS_COST_EXPLORER=on, AWS costs for the last 30 days by
 * service and for the last six months, RDS backups and snapshots (RDS_INSTANCE_ID), and the
 * exports log; the AWS Backup plan and its recovery points, and the network (VPC connector,
 * NAT, RDS private) (M7). Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<DataPayload & DataExtra> => {
    const [database, costs, facts, volumes, months, bucket, backups, exports, backupPlan, network] = await Promise.all([
      getDatabaseStatsForDev(ctx),
      readCosts(30),
      getDatabaseFactsForDev(ctx),
      getMonthVolumesForDev(ctx),
      readCostsByMonth(6),
      readBucketStats(),
      readRdsBackups(),
      listExportFilesForDev(ctx),
      readBackupPlan(),
      readNetwork(),
    ]);
    return { database, costs, facts, volumes, months, bucket, backups, exports, backupPlan, network };
  });
}
