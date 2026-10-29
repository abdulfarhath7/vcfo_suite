import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { createWindowRequest, listWindowRequests } from '@/db/repositories/item-window-requests';
import { parseJsonBody } from '@/lib/api/parse-body';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const statusSchema = z.enum(['pending', 'approved', 'rejected', 'withdrawn', 'all']);
const createSchema = z.object({
  itemKey: z.string().trim().min(3).max(200),
  fromDate: dateSchema.nullable().optional(),
  toDate: dateSchema,
  reason: z.string().trim().min(1).max(1000),
});

/**
 * GET /api/work/window-requests?status=pending|approved|rejected|withdrawn|all&key=<itemKey>
 * Lead: their own requests. Manager: requests on their engagements. Admin and super
 * admin: all. Defaults to pending.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const status = statusSchema.safeParse(params.get('status') ?? 'pending');
  if (!status.success) return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  const key = params.get('key')?.trim() || undefined;
  if (key && key.length > 200) return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
  try {
    return NextResponse.json({ requests: await listWindowRequests(guard.ctx, { status: status.data, itemKey: key }) });
  } catch (err) {
    const message = errorText(err, 'list_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}

/** POST /api/work/window-requests { itemKey, fromDate?, toDate, reason } — a lead asks for a new window. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await parseJsonBody(request, createSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const row = await createWindowRequest(guard.ctx, body.data);
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ request: { id: row.id, status: row.status } }, { status: 201 });
  } catch (err) {
    const message = errorText(err, 'create_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
