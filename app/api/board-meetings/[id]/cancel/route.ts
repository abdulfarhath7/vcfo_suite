import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { cancelMeeting, getMeeting, recordMeetingEvent, systemMeetingBundle, systemMeetingPeople } from '@/db/repositories/board-meetings';
import { previewCancellation, sendCancellation } from '@/lib/board-meetings/send';
import { EmailStepSchema } from '@/lib/email/email-edits';
import { recordEmailSent } from '@/lib/email/record-email-sent';
import { meetingError, type RouteContext } from '../../_respond';

/**
 * POST /api/board-meetings/:id/cancel { reason } — cancels the meeting.
 * GL-07: when the notice went out, the directors are told through the "Send email" pop-up:
 * `{ reason, preview: true }` gives the drafted cancellation without cancelling anything, and
 * `{ reason, email }` (its Send) cancels and sends the edited email. A meeting whose notice never
 * went out is cancelled with `{ reason }` alone and emails nobody.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, z.object({ reason: z.string().max(500).default('') }).merge(EmailStepSchema));
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const current = await getMeeting(guard.ctx, id);
    const noticeWentOut = Boolean(current.sentAt);
    if (body.data.preview) {
      if (!current.can.cancel) return NextResponse.json({ error: 'This meeting cannot be cancelled.' }, { status: 409 });
      return NextResponse.json({ draft: noticeWentOut ? await previewCancellation(current.id, body.data.reason) : null });
    }
    if (noticeWentOut && !body.data.email) return NextResponse.json({ error: 'Open the cancellation email and press Send.' }, { status: 400 });
    const { before } = await cancelMeeting(guard.ctx, id, body.data.reason);
    const bundle = await systemMeetingBundle(id);
    const team = bundle ? await systemMeetingPeople(bundle.engagement) : null;
    const mail = await sendCancellation(id, {
      leadId: team?.lead?.id ?? null,
      notifyIds: [team?.lead?.id, team?.manager?.id].filter((x): x is string => Boolean(x)),
      wasSent: Boolean(before.sentAt),
      edits: body.data.email,
    });
    if (mail?.ok) {
      await recordMeetingEvent(guard.ctx.userId, id, `${guard.ctx.name || 'Staff'} sent the cancellation to ${mail.to.length}`);
      await recordEmailSent(guard.ctx, { to: mail.to, cc: mail.cc, subject: mail.subject, engagementId: bundle?.engagement.id, itemId: `board-meeting:${id}`, via: 'firm' });
    }
    return NextResponse.json({ meeting: await getMeeting(guard.ctx, id) });
  } catch (e) {
    return meetingError(e);
  }
}
