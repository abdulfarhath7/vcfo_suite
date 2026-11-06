import 'server-only';

import { after } from 'next/server';
import type { AuthContext } from '@/auth/guards';
import {
  approveMeeting,
  BoardMeetingError,
  cancelMeeting,
  getMeeting,
  markSentForSignature,
  systemMeetingBundle,
  systemMeetingPeople,
} from '@/db/repositories/board-meetings';
import { remindNonResponders, sendCancellation, sendForSignature, sendNotice } from '@/lib/board-meetings/send';

/** What the routes do around the repository and what a card must do too, so the two cannot differ. */

async function teamOf(meetingId: string) {
  const bundle = await systemMeetingBundle(meetingId);
  return bundle ? systemMeetingPeople(bundle.engagement) : null;
}

/** Saves the approval, then sends the notice after the answer; the meeting turns `sent` when that is done. */
export async function approveAndSendNotice(ctx: AuthContext, meetingId: string): Promise<void> {
  const approved = await approveMeeting(ctx, meetingId);
  const team = await teamOf(approved.id);
  const opts = {
    leadId: team?.lead?.id ?? null,
    notifyIds: [...new Set([team?.lead?.id, team?.manager?.id, ctx.userId].filter((x): x is string => Boolean(x)))],
    update: Boolean(approved.rescheduledFrom) || Boolean(approved.sentAt),
  };
  after(() => sendNotice(approved.id, opts).catch((err) => console.error('[board-meetings] notice send failed', approved.id, err)));
}

/** Cancels; if the notice went out, the directors get a cancellation. */
export async function cancelAndTell(ctx: AuthContext, meetingId: string, reason: string): Promise<void> {
  const { before } = await cancelMeeting(ctx, meetingId, reason);
  const team = await teamOf(meetingId);
  await sendCancellation(meetingId, {
    leadId: team?.lead?.id ?? null,
    notifyIds: [team?.lead?.id, team?.manager?.id].filter((x): x is string => Boolean(x)),
    wasSent: Boolean(before.sentAt),
  });
}

/** Emails the directors who have not replied, once the notice is out. Returns how many mails went. */
export async function remindDirectors(ctx: AuthContext, meetingId: string): Promise<number> {
  const meeting = await getMeeting(ctx, meetingId);
  if (!meeting.can.remind) throw new BoardMeetingError(409, 'not_sent');
  return remindNonResponders(meetingId, meeting.replies.filter((r) => r.reply).map((r) => r.directorId));
}

/** Logs the signature events and emails the signers, with replies going to the lead. */
export async function sendDocumentForSignature(ctx: AuthContext, documentId: string, reminder: boolean): Promise<{ sent: number; meetingId: string }> {
  const { doc } = await markSentForSignature(ctx, documentId, reminder);
  const team = await teamOf(doc.meetingId);
  const sent = await sendForSignature(doc.id, { lead: team?.lead ?? { name: ctx.name, email: ctx.email }, reminder });
  return { sent, meetingId: doc.meetingId };
}
