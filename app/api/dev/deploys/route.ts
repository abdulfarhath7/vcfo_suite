import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { readAppRunner } from '@/lib/dev/aws';
import type { DeploysPayload } from '@/lib/dev/types';

/**
 * GET /api/dev/deploys: the App Runner service (DescribeService) and its recent operations
 * (ListOperations) for APP_RUNNER_SERVICE_ARN. Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (): Promise<DeploysPayload> => readAppRunner());
}
