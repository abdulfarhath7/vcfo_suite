import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { setDevSwitchForDev } from '@/db/repositories/dev-settings';

const Body = z.object({ on: z.boolean() });

/**
 * POST /api/dev/jobs/pause: turn "Pause all jobs" on or off (`dev_settings` 'jobs.paused').
 * The jobs read it through `systemJobsPaused`. Writes `dev.setting.change` with before and
 * after. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const paused = await setDevSwitchForDev(ctx, 'jobs.paused', body.on);
    return { status: 200, body: { ok: true, paused } };
  });
}
