import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { rotateDevTokenForDev } from '@/db/repositories/dev-tokens';

const Body = z.object({ id: z.string().uuid() });

/**
 * POST /api/dev/access/tokens/rotate { id }: a new token with the same name and life; the old
 * one works for 24 more hours. The new token is in the answer once (`dev.token.rotate`).
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const out = await rotateDevTokenForDev(ctx, body.id);
    if (!out) return { status: 404, body: { error: 'not_found' } };
    return { status: 200, body: { ok: true, id: out.id, token: out.token } };
  });
}
