import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { revokeSessionForDev } from '@/db/repositories/dev-access';

const Body = z.object({ sessionId: z.string().uuid() });

/**
 * POST /api/dev/access/revoke { sessionId }: sign out one staff device (R-40). The caller's
 * own device and client sessions are refused (404). The repository writes `dev.session.revoke`.
 * Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const out = await revokeSessionForDev(ctx, body.sessionId);
    if (!out) return { status: 404, body: { error: 'not_found' } };
    return { status: 200, body: { ok: true, person: out.person } };
  });
}
