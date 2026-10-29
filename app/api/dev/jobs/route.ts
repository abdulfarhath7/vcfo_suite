import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { registeredJobs } from '@/lib/dev/jobs-registry';
import { listInngestRuns } from '@/lib/dev/inngest';
import { getDevSwitchForDev } from '@/db/repositories/dev-settings';
import type { JobsPayload } from '@/lib/dev/types';

const Query = z.object({ days: z.coerce.number().int().min(1).max(30).optional() });

/**
 * GET /api/dev/jobs: the Inngest functions registered in `src/jobs/` (from the code), their
 * runs over the last `days` days (default 7) from the Inngest REST API, and the "Pause all
 * jobs" switch. Without INNGEST_SIGNING_KEY the runs come back as "not set up".
 * Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, Query, async (ctx, q): Promise<JobsPayload> => {
    const functions = registeredJobs();
    const [runs, paused] = await Promise.all([listInngestRuns(functions, q.days ?? 7), getDevSwitchForDev(ctx, 'jobs.paused')]);
    return { functions, runs, paused };
  });
}
