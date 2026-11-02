import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { NOTE_MAX_LENGTH, deleteEngagementNote, updateEngagementNote } from '@/db/repositories/engagement-notes';
import { notesError } from '../_respond';

type RouteContext = { params: Promise<{ id: string; noteId: string }> };

const paramsSchema = z.object({ id: z.string().trim().min(1).max(80), noteId: z.string().uuid() });
const patchSchema = z
  .object({
    body: z.string().trim().min(1).max(NOTE_MAX_LENGTH).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((p) => p.body !== undefined || p.pinned !== undefined, { message: 'nothing_to_change' });

/** PATCH /api/engagements/:id/notes/:noteId with `{ body?, pinned? }` — edit (author) or pin. */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  const parsed = await parseJsonBody(request, patchSchema);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const note = await updateEngagementNote(guard.ctx, params.data.id, params.data.noteId, parsed.data);
    return NextResponse.json({ ok: true, note });
  } catch (e) {
    return notesError(e);
  }
}

/** DELETE /api/engagements/:id/notes/:noteId — soft delete (author, or a firm-wide admin). */
export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  try {
    await deleteEngagementNote(guard.ctx, params.data.id, params.data.noteId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return notesError(e);
  }
}
