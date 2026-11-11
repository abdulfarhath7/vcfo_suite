import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { getMeeting, recordMeetingEvent, systemMeetingBundle, systemMeetingPeople } from '@/db/repositories/board-meetings';
import { previewNotice, sendNotice } from '@/lib/board-meetings/send';
import { EmailStepSchema } from '@/lib/email/email-edits';
import { recordEmailSent } from '@/lib/email/record-email-sent';
import { meetingError, type RouteContext } from '../../_respond';

/**
 * POST /api/board-meetings/:id/send-notice — GL-07: `{ preview: true }` gives the "Send email" pop-up the
 * drafted notice; `{ email }` (its Send) makes the Teams meeting, marks the meeting sent and emails
 * the edited notice with the Word file and the invite. Only an approved, unsent notice. Staff.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, EmailStepSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const meeting = await getMeeting(guard.ctx, id);
    if (!meeting.can.sendNotice) return NextResponse.json({ error: 'The notice is not approved, or it was already sent.' }, { status: 409 });
    const update = Boolean(meeting.rescheduledFrom) || Boolean(meeting.sentAt);
    if (body.data.preview) return NextResponse.json({ draft: await previewNotice(meeting.id, update) });
    if (!body.data.email) return NextResponse.json({ error: 'Open the email and press Send.' }, { status: 400 });
    const bundle = await systemMeetingBundle(meeting.id);
    const team = bundle ? await systemMeetingPeople(bundle.engagement) : null;
    const result = await sendNotice(meeting.id, {
      leadId: team?.lead?.id ?? null,
      notifyIds: [...new Set([team?.lead?.id, team?.manager?.id, guard.ctx.userId].filter((x): x is string => Boolean(x)))],
      update,
      edits: body.data.email,
    });
    if (result.sent) {
      await recordMeetingEvent(guard.ctx.userId, meeting.id, `${guard.ctx.name || 'Staff'} sent the notice to ${result.to} (CC ${result.cc})`);
      await recordEmailSent(guard.ctx, { to: result.toList ?? [], cc: result.ccList, subject: result.subject ?? 'Notice', engagementId: bundle?.engagement.id, itemId: `board-meeting:${meeting.id}`, via: 'firm' });
    }
    if (!result.sent) {
      return NextResponse.json({ error: 'The meeting is marked sent, but the email failed. It is kept in the developer console for a retry.' }, { status: 502 });
    }
    return NextResponse.json({ sent: true, meeting: await getMeeting(guard.ctx, id) });
  } catch (e) {
    return meetingError(e);
  }
}
