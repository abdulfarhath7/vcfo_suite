import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getMeeting } from '@/db/repositories/board-meetings';
import { sendDocumentForSignature } from '@/lib/actions/board-meetings/flows';
import { meetingError, type DocContext } from '../../../_respond';

/**
 * POST /api/board-meetings/documents/:docId/send[?reminder=1] — email the MoM or resolution to
 * the signing directors (reply to the lead) and log the signature events. Staff.
 */
export async function POST(request: Request, context: DocContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { docId } = await context.params;
  const reminder = new URL(request.url).searchParams.get('reminder') === '1';
  try {
    const { sent, meetingId } = await sendDocumentForSignature(guard.ctx, docId, reminder);
    return NextResponse.json({ sent, meeting: await getMeeting(guard.ctx, meetingId) });
  } catch (e) {
    return meetingError(e);
  }
}
