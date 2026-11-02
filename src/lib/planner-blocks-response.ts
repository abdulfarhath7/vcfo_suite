import { NextResponse } from 'next/server';
import { PLANNER_ERROR_TEXT } from '@/lib/planner-blocks';

/** Planner error code → HTTP status + plain words (the console shows `error`). */
export function plannerError(err: unknown) {
  const code = err instanceof Error ? err.message : 'failed';
  const status =
    code === 'not_permitted' ? 403 : code === 'planner_not_ready' ? 503 : code === 'not_found' ? 404 : PLANNER_ERROR_TEXT[code] ? 400 : 500;
  return NextResponse.json({ error: PLANNER_ERROR_TEXT[code] ?? 'The calendar could not be saved. Try again.', code }, { status });
}
