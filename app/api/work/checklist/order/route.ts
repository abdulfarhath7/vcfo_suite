import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { reorderChecklist } from '@/db/repositories/work-checklist';
import { parseJsonBody } from '@/lib/api/parse-body';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

const orderSchema = z.object({
  key: z.string().trim().min(3).max(200),
  ids: z.array(z.string().uuid()).max(60),
});

/** PUT /api/work/checklist/order { key, ids } — the new order of the caller's whole list on the item. */
export async function PUT(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await parseJsonBody(request, orderSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const items = await reorderChecklist(guard.ctx, body.data.key, body.data.ids);
    if (!items) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ items });
  } catch (err) {
    const message = errorText(err, 'reorder_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
