import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { getRunningSession, listItemSessions, startSession } from '@/db/repositories/work-sessions';
import { parseJsonBody } from '@/lib/api/parse-body';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

const keySchema = z.string().trim().min(3).max(200);
const startSchema = z.object({ key: keySchema, note: z.string().max(500).nullable().optional() });

/**
 * GET /api/work/sessions?key=<itemKey> — every session on the item, the total and the
 * caller's running one. GET /api/work/sessions?running=1 — the caller's running
 * session on any item (one per person).
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const params = new URL(request.url).searchParams;
  try {
    if (params.get('running') === '1') {
      return NextResponse.json({ running: await getRunningSession(guard.ctx) });
    }
    const key = keySchema.safeParse(params.get('key') ?? '');
    if (!key.success) return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
    const payload = await listItemSessions(guard.ctx, key.data);
    if (!payload) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(payload);
  } catch (err) {
    const message = errorText(err, 'list_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}

/** POST /api/work/sessions { key, note? } — start a session; the caller's running one stops first. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await parseJsonBody(request, startSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const session = await startSession(guard.ctx, body.data.key, body.data.note);
    if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    const message = errorText(err, 'start_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
