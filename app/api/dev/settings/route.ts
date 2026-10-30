import { z } from 'zod';
import { devAction, devRoute } from '@/lib/dev/route-helpers';
import { readLogRetention } from '@/lib/dev/aws';
import { getDevSwitchForDev, getTestMailToForDev, setTestMailToForDev } from '@/db/repositories/dev-settings';
import type { ConsoleSettings } from '@/lib/dev/types';

/**
 * GET /api/dev/settings: the console settings in one place (P-355): "Pause all jobs", how long
 * CloudWatch keeps log lines, and the default test mail address.
 * POST /api/dev/settings { testMailTo }: save the test mail address (audited, masked). The
 * pause and the log keep period save through their own routes (`/api/dev/jobs/pause`,
 * `/api/dev/logs/retention`). Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<ConsoleSettings> => {
    const [paused, retention, testMailTo] = await Promise.all([getDevSwitchForDev(ctx, 'jobs.paused'), readLogRetention(), getTestMailToForDev(ctx)]);
    return { paused, retention, testMailTo };
  });
}

const Body = z.object({ testMailTo: z.union([z.string().trim().email().max(200), z.literal(''), z.null()]) });

export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    await setTestMailToForDev(ctx, body.testMailTo || null);
    return { status: 200, body: { ok: true } };
  });
}
