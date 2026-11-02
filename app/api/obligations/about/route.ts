import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { getObligationAbout } from '@/db/repositories/obligation-about';

const query = z
  .object({
    obligationId: z.string().trim().min(1).max(120).optional(),
    instanceId: z.string().uuid().optional(),
  })
  .refine((q) => q.obligationId || q.instanceId, { message: 'obligationId or instanceId is required' });

/**
 * GET /api/obligations/about?obligationId=|instanceId= — the About, Why it applies and
 * If filed late facts of one obligation (G-04), with its applicability note and the due
 * rule in one sentence. Staff ask by obligation id; the client portal asks with one of its
 * filing ids. Scoped in the repository like the register; 404 when out of scope.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const params = new URL(request.url).searchParams;
  const parsed = query.safeParse({
    obligationId: params.get('obligationId') ?? undefined,
    instanceId: params.get('instanceId') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 });
  try {
    const about = await getObligationAbout(guard.ctx, parsed.data);
    if (!about) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, about });
  } catch (e) {
    console.error('[obligations/about] failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
