import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { addChecklistItem, CHECKLIST_LABEL_MAX, listChecklist } from '@/db/repositories/work-checklist';
import { parseJsonBody } from '@/lib/api/parse-body';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

const keySchema = z.string().trim().min(3).max(200);
const createSchema = z.object({ key: keySchema, label: z.string().trim().min(1).max(CHECKLIST_LABEL_MAX) });

/** GET /api/work/checklist?key=<itemKey> — the caller's own checklist on the item, in order. */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const key = keySchema.safeParse(new URL(request.url).searchParams.get('key') ?? '');
  if (!key.success) return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
  try {
    const items = await listChecklist(guard.ctx, key.data);
    if (!items) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ items });
  } catch (err) {
    const message = errorText(err, 'list_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}

/** POST /api/work/checklist { key, label } — add a line at the end of the caller's list. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await parseJsonBody(request, createSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const item = await addChecklistItem(guard.ctx, body.data.key, body.data.label);
    if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const message = errorText(err, 'create_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
