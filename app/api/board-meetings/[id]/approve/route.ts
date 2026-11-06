import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { getMeeting } from '@/db/repositories/board-meetings';
import { approveAndSendNotice } from '@/lib/actions/board-meetings/flows';
import { meetingError, type RouteContext } from '../../_respond';

/**
 * POST /api/board-meetings/:id/approve — admin, super admin or manager approves; VCFO then
 * emails the notice (Word file, .ics, Teams link from the lead's Outlook when it can). A second
 * approval after a reschedule sends an update with the same calendar UID.
 *
 * The route answers as soon as the approval is saved. The Teams meeting, the Word notice and the
 * email run after the response (`after` from next/server, because Inngest cloud keys are not set
 * on App Runner); the meeting turns `sent` when they are done, and the lead, the manager and the
 * approver get a bell saying whether the email went out.
 */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  try {
    await approveAndSendNotice(guard.ctx, id);
    return NextResponse.json({ meeting: await getMeeting(guard.ctx, id), queued: true });
  } catch (e) {
    return meetingError(e);
  }
}
