import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { markNocSent, NocAccessError } from '@/db/repositories/registered-office-noc';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/engagements/:id/registered-office-noc/sent — the NOC went to the
 * property owner for signature. Body: { to? } (who it went to, as typed).
 * Manager (own project) or admin.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  let body: { to?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const to = typeof body.to === 'string' ? body.to.slice(0, 160) : '';
  try {
    return NextResponse.json({ noc: await markNocSent(guard.ctx, id, to) });
  } catch (err) {
    if (err instanceof NocAccessError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : 'noc_failed' }, { status: 500 });
  }
}
