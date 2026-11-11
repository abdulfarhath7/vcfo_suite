import { NextResponse } from 'next/server';
import { publicErrorMessage } from '@/lib/api-error';

/** Maps a statutory calendar error to its status: refusals 403, bad input 400, the rest 500. */
export function statutoryCalendarError(err: unknown, code: string) {
  const message = publicErrorMessage(err, code);
  const status = message === 'not permitted' ? 403 : message === 'invalid_body' || message.startsWith('invalid financial year') ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}
