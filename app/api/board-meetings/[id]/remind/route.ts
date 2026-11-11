import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { getMeeting, recordMeetingEvent, systemMeetingBundle } from '@/db/repositories/board-meetings';
import { previewReplyReminder, remindNonResponders } from '@/lib/board-meetings/send';
import { EmailStepSchema } from '@/lib/email/email-edits';
import { recordEmailSent } from '@/lib/email/record-email-sent';
import { meetingError, type RouteContext } from '../../_respond';

/**
 * POST /api/board-meetings/:id/remind — remind the directors who have not replied. Staff.
 * GL-07: `{ preview: true }` gives the "Send email" pop-up the draft; `{ email }` sends it.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, EmailStepSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const meeting = await getMeeting(guard.ctx, id);
    if (!meeting.can.remind) return NextResponse.json({ error: 'not_sent' }, { status: 409 });
    const replied = meeting.replies.filter((r) => r.reply).map((r) => r.directorId);
    if (body.data.preview) {
      const draft = await previewReplyReminder(id, replied);
      return draft ? NextResponse.json({ draft }) : NextResponse.json({ error: 'Every director has replied.' }, { status: 409 });
    }
    if (!body.data.email) return NextResponse.json({ error: 'Open the email and press Send.' }, { status: 400 });
    const { count, mail } = await remindNonResponders(id, replied, body.data.email);
    if (mail?.ok) {
      const bundle = await systemMeetingBundle(id);
      await recordMeetingEvent(guard.ctx.userId, id, `${guard.ctx.name || 'Staff'} reminded ${count} director${count === 1 ? '' : 's'} to reply`);
      await recordEmailSent(guard.ctx, { to: mail.to, cc: mail.cc, subject: mail.subject, engagementId: bundle?.engagement.id, itemId: `board-meeting:${id}`, via: 'firm' });
    }
    return NextResponse.json({ sent: count });
  } catch (e) {
    return meetingError(e);
  }
}
