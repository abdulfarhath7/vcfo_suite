import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { purgeDemoLoginsForDev } from '@/db/repositories/dev-access';

/**
 * POST /api/dev/access/purge-demo: turn off every seeded demo login (@vcfo.local) except the
 * caller's own, and sign out their devices (R-40). Nothing is deleted. The repository writes
 * `dev.demo.purge`. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, z.object({}), async (ctx) => {
    const out = await purgeDemoLoginsForDev(ctx);
    return { status: 200, body: { ok: true, accounts: out.accounts } };
  });
}
