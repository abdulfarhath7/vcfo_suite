import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { rejectLargeBody } from '@/lib/api/body-limit';
import { getMeeting, uploadSigned } from '@/db/repositories/board-meetings';
import { meetingError, pdfFrom, type DocContext } from '../../../_respond';

/**
 * POST /api/board-meetings/documents/:docId/signed — the signed copy (multipart `file`, PDF).
 * Locks the document (no edit, no replace). GL-07: the final copy is no longer emailed here; the
 * screen opens the "Send email" pop-up right after (`.../final-copy`). Staff.
 */
export async function POST(request: Request, context: DocContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const tooLarge = rejectLargeBody(request, 22 * 1024 * 1024);
  if (tooLarge) return tooLarge;
  const { docId } = await context.params;
  const file = await pdfFrom(request);
  if (!file) return NextResponse.json({ error: 'file_required' }, { status: 400 });
  try {
    const { doc } = await uploadSigned(guard.ctx, docId, file);
    return NextResponse.json({ meeting: await getMeeting(guard.ctx, doc.meetingId) });
  } catch (e) {
    return meetingError(e);
  }
}
