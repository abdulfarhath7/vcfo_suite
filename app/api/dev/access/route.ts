import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { readAppRunner } from '@/lib/dev/aws';
import { healthByService } from '@/lib/dev/health';
import { secretInventory, serviceAccounts } from '@/lib/dev/secrets';
import { countDemoLoginsForDev, getAccessForDev, listSessionsForDev, signInMethodsForDev } from '@/db/repositories/dev-access';
import { listServiceChecksForDev } from '@/db/repositories/dev-checks';
import { listDevTokensForDev } from '@/db/repositories/dev-tokens';
import type { AccessExtra, AccessPayload } from '@/lib/dev/types';

/**
 * GET /api/dev/access: staff accounts (two-step, sessions, last seen), client accounts as
 * counts, people per role, staff devices signed in now, sign-in methods over 30 days, the
 * secrets inventory (names and where stored, never values) and the service accounts the
 * app runs as, and the personal API tokens (never the token itself). Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<AccessPayload & AccessExtra> => {
    const [base, sessions, methods, runner, checks, demoLogins, tokens] = await Promise.all([
      getAccessForDev(ctx),
      listSessionsForDev(ctx),
      signInMethodsForDev(ctx),
      readAppRunner(),
      listServiceChecksForDev(ctx, { days: 90 }),
      countDemoLoginsForDev(ctx),
      listDevTokensForDev(ctx),
    ]);
    const svc = runner.service.state === 'ok' ? runner.service.data : null;
    const last = Object.fromEntries(healthByService(['deploys', 'jobs', 'outlook', 'storage'], checks).map((h) => [h.service, h.lastCheck]));
    return {
      ...base,
      sessions,
      methods,
      secrets: secretInventory(process.env, svc),
      secretsSource: runner.service.state === 'ok' ? 'app_runner' : 'process',
      accounts: serviceAccounts(process.env, svc, last),
      demoLogins,
      tokens,
    };
  });
}
