import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { revokeDevTokenForDev } from '@/db/repositories/dev-tokens';

const Body = z.object({ id: z.string().uuid() });

/** POST /api/dev/access/tokens/revoke { id }: revoke a token at once (`dev.token.revoke`). */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    if (!(await revokeDevTokenForDev(ctx, body.id))) return { status: 404, body: { error: 'not_found' } };
    return { status: 200, body: { ok: true } };
  });
}
