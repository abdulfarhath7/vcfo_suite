import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { addEngagementFee, listEngagementFees } from '@/db/repositories/engagement-fees';
import { feeBodySchema, feeErrorStatus } from './schema';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/engagements/:id/fees — the fee lines on one engagement (P-100).
 * POST — add a line. Super admin, admin and the engagement's manager; the repository scopes the
 * engagement by role.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  try {
    return NextResponse.json({ ok: true, fees: await listEngagementFees(auth.ctx, id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'load_failed';
    return NextResponse.json({ ok: false, error: message }, { status: feeErrorStatus(message) });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const body = await parseJsonBody(request, feeBodySchema);
  if (body.ok === false) return NextResponse.json({ ok: false, error: body.error }, { status: body.status });
  const { id } = await context.params;
  try {
    return NextResponse.json({ ok: true, fee: await addEngagementFee(auth.ctx, id, body.data) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'save_failed';
    return NextResponse.json({ ok: false, error: message }, { status: feeErrorStatus(message) });
  }
}
