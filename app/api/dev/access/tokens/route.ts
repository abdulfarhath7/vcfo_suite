import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { createDevTokenForDev } from '@/db/repositories/dev-tokens';

const Body = z.object({ name: z.string().trim().min(1).max(60), days: z.union([z.literal(30), z.literal(90)]) });

/**
 * POST /api/dev/access/tokens { name, days }: make a personal API token for the caller. The
 * token reads the console's GET routes only. It is in the answer once and never again; the
 * repository writes `dev.token.create`. Developer or super admin, signed in (not by token).
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const out = await createDevTokenForDev(ctx, { name: body.name, days: body.days ?? 30 });
    return { status: 200, body: { ok: true, id: out.id, token: out.token } };
  });
}
