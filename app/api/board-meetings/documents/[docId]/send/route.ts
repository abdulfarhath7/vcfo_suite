import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { checkSendForSignature, getMeeting, markSentForSignature, recordMeetingEvent, systemMeetingBundle, systemMeetingPeople } from '@/db/repositories/board-meetings';
import { previewForSignature, sendForSignature } from '@/lib/board-meetings/send';
import { EmailStepSchema } from '@/lib/email/email-edits';
import { recordEmailSent } from '@/lib/email/record-email-sent';
import { meetingError, type DocContext } from '../../../_respond';

/**
 * POST /api/board-meetings/documents/:docId/send[?reminder=1] — email the MoM or resolution to
 * the signing directors (reply to the lead) and log the signature events. Staff.
 * GL-07: `{ preview: true }` gives the "Send email" pop-up the draft and changes nothing;
 * `{ email }` (its Send) logs the events and sends the edited email.
 */
export async function POST(request: Request, context: DocContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { docId } = await context.params;
  const reminder = new URL(request.url).searchParams.get('reminder') === '1';
  const body = await parseJsonBody(request, EmailStepSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const checked = await checkSendForSignature(guard.ctx, docId, reminder);
    const bundle = await systemMeetingBundle(checked.doc.meetingId);
    const team = bundle ? await systemMeetingPeople(bundle.engagement) : null;
    const lead = team?.lead ?? { name: guard.ctx.name, email: guard.ctx.email };
    if (body.data.preview) {
      const draft = await previewForSignature(docId, { lead, reminder });
      return draft ? NextResponse.json({ draft }) : NextResponse.json({ error: 'No signing director has an email address.' }, { status: 409 });
    }
    if (!body.data.email) return NextResponse.json({ error: 'Open the email and press Send.' }, { status: 400 });
    const { doc } = await markSentForSignature(guard.ctx, docId, reminder);
    const { count, mail } = await sendForSignature(doc.id, { lead, reminder, edits: body.data.email });
    if (mail?.ok) {
      await recordMeetingEvent(guard.ctx.userId, doc.meetingId, `${guard.ctx.name || 'Staff'} sent "${doc.title}" for signature to ${count}`);
      await recordEmailSent(guard.ctx, { to: mail.to, cc: mail.cc, subject: mail.subject, engagementId: bundle?.engagement.id, itemId: `board-meeting:${doc.meetingId}`, via: 'firm' });
    }
    return NextResponse.json({ sent: count, meeting: await getMeeting(guard.ctx, doc.meetingId) });
  } catch (e) {
    return meetingError(e);
  }
}
