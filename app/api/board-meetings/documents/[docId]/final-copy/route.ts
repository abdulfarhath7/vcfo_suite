import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { checkFinalCopy, getMeeting, recordMeetingEvent, systemMeetingBundle, systemMeetingPeople } from '@/db/repositories/board-meetings';
import { previewFinalCopy, sendFinalCopy } from '@/lib/board-meetings/send';
import { EmailStepSchema } from '@/lib/email/email-edits';
import { recordEmailSent } from '@/lib/email/record-email-sent';
import { meetingError, type DocContext } from '../../../_respond';

/**
 * POST /api/board-meetings/documents/:docId/final-copy — the signed, locked copy to every current
 * director, CC the admin and the lead. GL-07: `{ preview: true }` gives the "Send email" pop-up the
 * draft; `{ email }` (its Send) sends the edited email and marks the final copy sent. Staff.
 */
export async function POST(request: Request, context: DocContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { docId } = await context.params;
  const body = await parseJsonBody(request, EmailStepSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const { doc } = await checkFinalCopy(guard.ctx, docId);
    const bundle = await systemMeetingBundle(doc.meetingId);
    const team = bundle ? await systemMeetingPeople(bundle.engagement) : null;
    const ccEmails = [team?.admin?.email, team?.lead?.email].filter((x): x is string => Boolean(x));
    if (body.data.preview) {
      const draft = await previewFinalCopy(doc.id, ccEmails);
      return draft ? NextResponse.json({ draft }) : NextResponse.json({ error: 'No current director has an email address.' }, { status: 409 });
    }
    if (!body.data.email) return NextResponse.json({ error: 'Open the email and press Send.' }, { status: 400 });
    const { count, mail } = await sendFinalCopy(doc.id, {
      ccEmails,
      notifyIds: [team?.lead?.id, team?.manager?.id].filter((x): x is string => Boolean(x)),
      edits: body.data.email,
    });
    if (mail?.ok) {
      await recordMeetingEvent(guard.ctx.userId, doc.meetingId, `${guard.ctx.name || 'Staff'} sent the signed copy of "${doc.title}" to ${count}`);
      await recordEmailSent(guard.ctx, { to: mail.to, cc: mail.cc, subject: mail.subject, engagementId: bundle?.engagement.id, itemId: `board-meeting:${doc.meetingId}`, via: 'firm' });
    }
    return NextResponse.json({ sent: count, meeting: await getMeeting(guard.ctx, doc.meetingId) });
  } catch (e) {
    return meetingError(e);
  }
}
