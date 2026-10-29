import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { deleteEngagementFee, updateEngagementFee } from '@/db/repositories/engagement-fees';
import { feeBodySchema, feeErrorStatus } from '../schema';

type RouteContext = { params: Promise<{ id: string; feeId: string }> };

const feeIdSchema = z.string().uuid();

/** PATCH /api/engagements/:id/fees/:feeId — change a fee line (P-100). DELETE — remove it. */
export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id, feeId } = await context.params;
  if (!feeIdSchema.safeParse(feeId).success) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  const body = await parseJsonBody(request, feeBodySchema);
  if (body.ok === false) return NextResponse.json({ ok: false, error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ ok: true, fee: await updateEngagementFee(auth.ctx, id, feeId, body.data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'save_failed';
    return NextResponse.json({ ok: false, error: message }, { status: feeErrorStatus(message) });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id, feeId } = await context.params;
  if (!feeIdSchema.safeParse(feeId).success) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  try {
    await deleteEngagementFee(auth.ctx, id, feeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed';
    return NextResponse.json({ ok: false, error: message }, { status: feeErrorStatus(message) });
  }
}
