import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { getAccessForDev } from '@/db/repositories/dev-access';

/**
 * GET /api/dev/access: staff accounts with role, status, last seen, two-step state and open
 * sessions; client accounts as counts only. Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx) => getAccessForDev(ctx));
}
