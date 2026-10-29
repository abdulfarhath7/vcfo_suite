import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { NOTE_MAX_LENGTH, createEngagementNote, listEngagementNotes } from '@/db/repositories/engagement-notes';
import { notesError } from './_respond';

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().trim().min(1).max(80);
const createSchema = z.object({
  body: z.string().trim().min(1).max(NOTE_MAX_LENGTH),
  pinned: z.boolean().optional(),
});

/** GET /api/engagements/:id/notes — staff notes on the client record, pinned first (G-19). */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, notes: await listEngagementNotes(guard.ctx, id.data) });
  } catch (e) {
    return notesError(e);
  }
}

/** POST /api/engagements/:id/notes with `{ body, pinned? }` — add a note; returns `{ note }`. */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  const parsed = await parseJsonBody(request, createSchema);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const note = await createEngagementNote(guard.ctx, id.data, parsed.data);
    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch (e) {
    return notesError(e);
  }
}
