import { NextResponse } from 'next/server';
import { EngagementNotesError } from '@/db/repositories/engagement-notes';

/** Map notes repository errors to HTTP (shared by the notes routes). */
export function notesError(e: unknown) {
  if (e instanceof EngagementNotesError) return NextResponse.json({ ok: false, error: e.code }, { status: e.status });
  console.error('[notes] route failed', e instanceof Error ? e.message : e);
  return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
}
