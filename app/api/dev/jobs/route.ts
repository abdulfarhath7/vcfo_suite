import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { registeredJobs } from '@/lib/dev/jobs-registry';
import { listInngestRuns } from '@/lib/dev/inngest';
import type { JobsPayload } from '@/lib/dev/types';

const Query = z.object({ days: z.coerce.number().int().min(1).max(30).optional() });

/**
 * GET /api/dev/jobs: the Inngest functions registered in `src/jobs/`, and their recent runs
 * from the Inngest REST API ("not set up" without INNGEST_SIGNING_KEY). Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, Query, async (_ctx, q): Promise<JobsPayload> => {
    const functions = registeredJobs();
    return { functions, runs: await listInngestRuns(functions, q.days ?? 7) };
  });
}
