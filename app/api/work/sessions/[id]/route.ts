import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { stopSession } from '@/db/repositories/work-sessions';
import { parseJsonBody } from '@/lib/api/parse-body';
import { canUseWorkTools } from '@/lib/work/work-access';
import { errorText, workErrorStatus } from '@/lib/work/route-errors';

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();
const patchSchema = z.object({ action: z.literal('stop'), note: z.string().max(500).nullable().optional() });

/** PATCH /api/work/sessions/:id { action: 'stop', note? } — stop the caller's own running session. */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!canUseWorkTools(guard.ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const body = await parseJsonBody(request, patchSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const session = await stopSession(guard.ctx, id, body.data.note);
    if (!session) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ session });
  } catch (err) {
    const message = errorText(err, 'stop_failed');
    return NextResponse.json({ error: message }, { status: workErrorStatus(message) });
  }
}
