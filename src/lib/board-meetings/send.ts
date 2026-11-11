import 'server-only';
import { sendEmail } from '@/lib/email/send-email';
import { draftView, messageHtml, withEdits, type ComposedEmail, type EmailDraftView, type EmailEdits } from '@/lib/email/email-edits';
import {
  emailButton,
  emailCallout,
  emailHeading,
  emailInk,
  emailMetaTable,
  emailMuted,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '@/lib/email/email-layout';
import { siteUrl } from '@/lib/site-url';
import { getObjectBuffer, bucketKey } from '@/storage/s3';
import {
  finalAgenda,
  meetingHref,
  notifyMeeting,
  noticeFor,
  systemDocument,
  systemMarkFinalSent,
  systemMarkSent,
  systemMeetingBundle,
} from '@/db/repositories/board-meetings';
import { systemTeamsMeeting } from '@/db/repositories/outlook-connections';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { addDaysIso, isShortNotice, longDate, noticeTime, shortDate, todayIst } from './dates';
import { googleCalendarLink, meetingIcs, outlookCalendarLink, type MeetingEvent } from './calendar';
import { noticeDocx } from './notice-docx';
import { resolutionDocx } from './resolution';
import { signDirectorLink } from './reply-token';
import { KIND_LABEL, MODE_LABEL, type MeetingKind, type MeetingMode } from './model';

/**
 * BOARD MEETING EMAIL — the system of record for everything a director receives
 * (CLAUDE.md rule 6). Called by the routes after the repository has checked access and changed
 * state. A failed send never undoes the state change; it is logged by `sendEmail`.
 *
 *  - sendNotice:        notice + agenda (Word), invite (.ics), Teams link, reply buttons.
 *  - sendCancellation:  cancellation with METHOD:CANCEL on the same UID.
 *  - sendForSignature:  the MoM or a resolution to the signing directors (reply to the lead).
 *  - sendFinalCopy:     the signed, locked copy to all directors, CC admin and lead.
 *  - remindLead:        T-10 "prepare the notice" and the MoM due reminders.
 */

type Bundle = NonNullable<Awaited<ReturnType<typeof systemMeetingBundle>>>;

function people(bundle: Bundle): { to: string[]; cc: string[]; directors: Array<{ id: string; name: string; email: string | null }> } {
  const to = new Set<string>();
  const cc = new Set<string>();
  const directors: Array<{ id: string; name: string; email: string | null }> = [];
  for (const r of bundle.meeting.recipients) {
    if (r.directorId) {
      const d = bundle.directors.find((x) => x.id === r.directorId);
      const email = d?.email ?? r.email;
      if (r.kind === 'to') directors.push({ id: r.directorId, name: d?.name ?? r.name, email });
      if (email) (r.kind === 'to' ? to : cc).add(email.toLowerCase());
      continue;
    }
    if (r.email) (r.kind === 'to' ? to : cc).add(r.email.toLowerCase());
  }
  for (const t of to) cc.delete(t);
  return { to: [...to], cc: [...cc], directors };
}

function eventOf(bundle: Bundle, teamsLink: string | null): MeetingEvent {
  const m = bundle.meeting;
  const kind = KIND_LABEL[m.kind as MeetingKind] ?? 'Board meeting';
  return {
    uid: `board-meeting-${m.id}@vcfo-suite`,
    sequence: m.icsSequence,
    date: m.meetingDate,
    time: m.meetingTime,
    durationMinutes: 60,
    summary: `${kind} · ${bundle.company.name}`,
    description: `${m.meetingNo}. ${MODE_LABEL[m.mode as MeetingMode] ?? ''}. The notice and agenda are attached to the notice email.`,
    location: m.mode === 'in_person' ? m.venue : teamsLink ? 'Microsoft Teams' : 'Video conference',
    url: teamsLink,
  };
}

function slug(s: string): string {
  return s.replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function btn(href: string, label: string, primary = false): string {
  return emailButton(label, href, { variant: primary ? 'primary' : 'secondary', size: 'sm', margin: '0 6px 6px 0' });
}

/** Create or move the Teams meeting in the lead's Outlook (best effort). */
async function teamsFor(bundle: Bundle, leadId: string | null): Promise<{ link: string | null; eventId: string | null } | null> {
  const m = bundle.meeting;
  if (m.mode === 'in_person' || !leadId) return null;
  const startLocal = `${m.meetingDate}T${m.meetingTime}:00`;
  const endDate = new Date(Date.parse(`${m.meetingDate}T${m.meetingTime}:00Z`) + 3_600_000).toISOString().slice(0, 19);
  const input = {
    subject: `${KIND_LABEL[m.kind as MeetingKind] ?? 'Board meeting'} · ${bundle.company.name} · ${m.meetingNo}`,
    start: startLocal,
    end: endDate,
    location: 'Microsoft Teams',
    bodyHtml: `<p>${escapeHtml(m.meetingNo)}. Created by VCFO Suite for the board meeting notice.</p>`,
  };
  if (m.teamsEventId) {
    const r = await systemTeamsMeeting(leadId, { kind: 'update', eventId: m.teamsEventId, input });
    return r ? { link: r.joinUrl ?? m.teamsLink, eventId: r.eventId } : null;
  }
  if (m.teamsLink) return null; // the lead pasted a link: keep it
  const r = await systemTeamsMeeting(leadId, { kind: 'create', input });
  return r ? { link: r.joinUrl, eventId: r.eventId } : null;
}

/** The notice email for a meeting as it stands (GL-07: built for the pop-up, then for the send). */
async function composeNotice(bundle: Bundle, update: boolean, today: string): Promise<ComposedEmail> {
  const m = bundle.meeting;
  const { agenda } = await finalAgenda(m);
  const notice = noticeFor(m, bundle.company, bundle.directors, agenda, today);
  const docx = noticeDocx(notice);
  const ev = eventOf(bundle, m.teamsLink);
  const ics = meetingIcs(ev, 'REQUEST');
  const { to, cc, directors } = people(bundle);
  const base = siteUrl();
  const kind = KIND_LABEL[m.kind as MeetingKind] ?? 'Board meeting';
  const when = `${shortDate(m.meetingDate)} · ${noticeTime(m.meetingTime)} IST${m.secondZoneLabel && m.secondZoneTime ? ` / ${noticeTime(m.secondZoneTime)} ${m.secondZoneLabel}` : ''}`;
  const replyRows = directors
    .map((d) => {
      const t = signDirectorLink(m.id, d.id);
      const href = (r: string) => `${base}/meeting-reply?t=${encodeURIComponent(t)}&r=${r}`;
      return `<tr><td style="padding:8px 0;font-size:14px;">${emailInk(escapeHtml(d.name), 400)}</td><td style="padding:8px 0;text-align:right;">${btn(href('yes'), 'I will attend', true)}${btn(href('no'), "I can't attend")}</td></tr>`;
    })
    .join('');
  const agendaHtml = `<ol style="margin:0 0 14px 18px;padding:0;">${notice.agenda.map((a) => `<li style="margin:0 0 4px;">${escapeHtml(a.text)}${a.subs.length ? `<ul style="margin:4px 0 0 0;padding-left:16px;">${a.subs.map((s) => `<li>${escapeHtml(s.text)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>`;
  const message = update
    ? 'The meeting has changed. The updated notice and agenda are attached; your calendar updates the event you already have.'
    : `${notice.salutation} The notice and agenda of the meeting are attached.`;
  const fixedHtml = [
    emailMetaTable([
      { label: 'Meeting no.', value: m.meetingNo },
      { label: 'Date and time', value: when },
      { label: 'Mode', value: MODE_LABEL[m.mode as MeetingMode] ?? m.mode },
      { label: 'Venue', value: m.venue || '—' },
    ]),
    m.teamsLink ? emailParagraph(btn(m.teamsLink, 'Join on Microsoft Teams', true)) : '',
    emailParagraph(`<b>Add to calendar:</b> ${btn(outlookCalendarLink(ev), 'Outlook')}${btn(googleCalendarLink(ev), 'Google Calendar')} — or open the attached .ics file.`),
    replyRows ? `${emailHeading('Will you attend?')}<table role="presentation" style="width:100%;border-collapse:collapse;">${replyRows}</table><p style="margin:4px 0 14px;">${emailMuted('Each director uses the buttons on their own row. No sign-in is needed.', 12)}</p>` : '',
    `${emailHeading('Agenda')}${agendaHtml}`,
    m.shortNotice || isShortNotice(today, m.meetingDate) ? emailCallout('This notice is sent less than 7 days before the meeting (Sec 173(3)). Please confirm your consent to shorter notice by reply.') : '',
  ].join('');
  const file = slug(m.meetingNo);
  return {
    to,
    cc,
    subject: `${update ? 'Updated notice' : 'Notice'} of ${kind} · ${m.meetingNo} · ${shortDate(m.meetingDate)}`,
    message,
    html: (msg) =>
      renderEmailDocument({
        eyebrow: update ? 'Updated notice' : 'Notice of meeting',
        title: `${kind} · ${bundle.company.name}`,
        bodyHtml: messageHtml(msg) + fixedHtml,
        footerNote: `${bundle.company.name}${bundle.company.cin ? ` · CIN ${bundle.company.cin}` : ''}. Sent by SBC through VCFO Suite.`,
      }),
    text: (msg) => `${msg}\n\n${kind} · ${bundle.company.name}\n${m.meetingNo}\n${when}\n${m.venue}\n${m.teamsLink ? `Join: ${m.teamsLink}\n` : ''}`,
    attachments: [
      { filename: `Notice_and_Agenda_${file}.docx`, content: docx, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: `${file}.ics`, content: new TextEncoder().encode(ics), contentType: 'text/calendar; method=REQUEST; charset=utf-8' },
    ],
    purpose: 'board_meeting.notice',
    fixed: 'the meeting details, the Teams link (made when you send, if the lead has Outlook connected), calendar links, the attendance buttons for each director and the agenda',
  };
}

/** GL-07: the notice as a draft for the "Send email" pop-up. Nothing changes and nothing is sent. */
export async function previewNotice(meetingId: string, update: boolean): Promise<EmailDraftView | null> {
  const bundle = await systemMeetingBundle(meetingId);
  if (!bundle) return null;
  return draftView(await composeNotice(bundle, update, todayIst()));
}

/**
 * Send the notice, from the "Send email" pop-up's Send (GL-07). The Teams meeting is made, the
 * meeting turns `sent`, and the edited email goes out with the Word notice and the invite.
 */
export async function sendNotice(
  meetingId: string,
  opts: { leadId: string | null; notifyIds: string[]; update: boolean; edits?: EmailEdits },
): Promise<{ sent: boolean; to: number; cc: number; teams: boolean; subject?: string; toList?: string[]; ccList?: string[] }> {
  let bundle = await systemMeetingBundle(meetingId);
  if (!bundle) return { sent: false, to: 0, cc: 0, teams: false };
  const today = todayIst();
  const teams = await teamsFor(bundle, opts.leadId);
  const { agenda } = await finalAgenda(bundle.meeting);
  const marked = await systemMarkSent(meetingId, {
    noticeOn: today,
    shortNotice: isShortNotice(today, bundle.meeting.meetingDate),
    agenda,
    bumpSequence: opts.update,
    ...(teams ? { teamsLink: teams.link, teamsEventId: teams.eventId } : {}),
  });
  if (!marked) return { sent: false, to: 0, cc: 0, teams: false };
  bundle = { ...bundle, meeting: marked };
  const m = marked;
  const composed = await composeNotice(bundle, opts.update, today);
  const mail = opts.edits
    ? withEdits(composed, opts.edits)
    : withEdits(composed, { to: composed.to, cc: composed.cc, subject: composed.subject, message: composed.message, dropAttachments: [], addAttachments: [] });
  const to = Array.isArray(mail.to) ? mail.to : [mail.to];
  const cc = mail.cc ?? [];
  let sent = false;
  if (to.length) sent = (await sendEmail(mail)).ok;
  if (to.length && !sent) {
    await bell(bundle, opts.notifyIds, `Notice not sent: ${m.meetingNo}`, 'The email to the directors failed. It is kept in the developer console for a retry.');
  } else {
    await bell(bundle, opts.notifyIds, `${opts.update ? 'Updated notice' : 'Notice'} sent: ${m.meetingNo}`, `Emailed to ${to.length} and CC ${cc.length}. ${m.teamsLink ? 'Teams link included.' : 'No Teams link.'}`);
  }
  return { sent, to: to.length, cc: cc.length, teams: Boolean(m.teamsLink), subject: mail.subject, toList: to, ccList: cc };
}

function composeCancellation(bundle: Bundle): ComposedEmail | null {
  const m = bundle.meeting;
  const { to, cc } = people(bundle);
  if (!to.length) return null;
  const ev = eventOf(bundle, m.teamsLink);
  const kind = KIND_LABEL[m.kind as MeetingKind] ?? 'Board meeting';
  const message = `The meeting ${m.meetingNo} on ${longDate(m.meetingDate)} is cancelled.${m.cancelReason ? `\n\nReason: ${m.cancelReason}` : ''}`;
  return {
    to,
    cc,
    subject: `Cancelled: ${kind} · ${m.meetingNo} · ${shortDate(m.meetingDate)}`,
    message,
    html: (msg) =>
      renderEmailDocument({
        eyebrow: 'Meeting cancelled',
        title: `${kind} · ${bundle.company.name}`,
        bodyHtml: messageHtml(msg) + emailParagraph('Your calendar removes the event when you open the attached file.'),
      }),
    text: (msg) => msg,
    attachments: [{ filename: `${slug(m.meetingNo)}-cancel.ics`, content: new TextEncoder().encode(meetingIcs(ev, 'CANCEL')), contentType: 'text/calendar; method=CANCEL; charset=utf-8' }],
    purpose: 'board_meeting.cancel',
    fixed: 'a line that the calendar file removes the event',
  };
}

/** GL-07: the cancellation email as a draft, for a meeting whose notice went out. */
export async function previewCancellation(meetingId: string, reason: string): Promise<EmailDraftView | null> {
  const bundle = await systemMeetingBundle(meetingId);
  if (!bundle) return null;
  const composed = composeCancellation({ ...bundle, meeting: { ...bundle.meeting, cancelReason: reason || bundle.meeting.cancelReason } });
  return composed ? draftView(composed) : null;
}

export async function sendCancellation(meetingId: string, opts: { leadId: string | null; notifyIds: string[]; wasSent: boolean; edits?: EmailEdits }): Promise<SentMail | null> {
  const bundle = await systemMeetingBundle(meetingId);
  if (!bundle) return null;
  const m = bundle.meeting;
  if (m.teamsEventId && opts.leadId) await systemTeamsMeeting(opts.leadId, { kind: 'cancel', eventId: m.teamsEventId, comment: m.cancelReason ?? 'Cancelled' });
  if (!opts.wasSent) return null;
  const composed = composeCancellation(bundle);
  if (!composed) return null;
  const sent = await sendComposed(composed, opts.edits);
  await bell(bundle, opts.notifyIds, `Meeting cancelled: ${m.meetingNo}`, m.cancelReason ?? '');
  return sent;
}

/** What went out, for the audit record and the card (GL-07). */
export interface SentMail {
  ok: boolean;
  to: string[];
  cc: string[];
  subject: string;
}

async function sendComposed(composed: ComposedEmail, edits?: EmailEdits): Promise<SentMail> {
  const mail = withEdits(composed, edits ?? { to: composed.to, cc: composed.cc, subject: composed.subject, message: composed.message, dropAttachments: [], addAttachments: [] });
  const res = await sendEmail(mail);
  return { ok: res.ok, to: Array.isArray(mail.to) ? mail.to : [mail.to], cc: mail.cc ?? [], subject: mail.subject };
}

async function documentFile(doc: NonNullable<Awaited<ReturnType<typeof systemDocument>>>, bundle: Bundle, which: 'file' | 'signed'): Promise<{ filename: string; content: Uint8Array; contentType: string } | null> {
  const key = which === 'signed' ? doc.signedKey : doc.fileKey;
  if (key) {
    const buf = await getObjectBuffer(bucketKey('engagement-documents', key));
    if (!buf) return null;
    return { filename: (which === 'signed' ? doc.signedName : doc.fileName) ?? `${slug(doc.title)}.pdf`, content: buf, contentType: 'application/pdf' };
  }
  if (doc.kind !== 'resolution' || which === 'signed') return null;
  const signers = doc.signerIds.map((id) => bundle.directors.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d));
  const buf = resolutionDocx({
    companyName: bundle.company.name,
    cin: bundle.company.cin,
    address: bundle.company.address,
    title: doc.title,
    description: doc.description,
    resolutionDate: doc.resolutionDate ?? todayIst(),
    meetingNo: bundle.meeting.meetingNo,
    meetingDate: bundle.meeting.meetingDate,
    changesItem: doc.changesItem,
    signers: signers.map((s) => ({ name: s.name, din: s.din })),
  });
  return { filename: `Resolution_${slug(doc.title).slice(0, 60)}.docx`, content: buf, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}

async function composeSignature(docId: string, opts: { lead: { name: string; email: string } | null; reminder: boolean }): Promise<{ composed: ComposedEmail; signers: number } | null> {
  const doc = await systemDocument(docId);
  if (!doc) return null;
  const bundle = await systemMeetingBundle(doc.meetingId);
  if (!bundle) return null;
  const signers = doc.signerIds.map((id) => bundle.directors.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => Boolean(d?.email));
  if (!signers.length) return null;
  const att = await documentFile(doc, bundle, 'file');
  const what = doc.kind === 'mom' ? 'the minutes of meeting' : 'a resolution passed after the meeting';
  const message = `Please sign ${what} of ${bundle.company.name} (${bundle.meeting.meetingNo}, ${longDate(bundle.meeting.meetingDate)}) and return the signed copy by replying to this email.`;
  return {
    signers: signers.length,
    composed: {
      to: signers.map((s) => s.email!),
      cc: opts.lead ? [opts.lead.email] : [],
      replyTo: opts.lead ? `${opts.lead.name} <${opts.lead.email}>` : undefined,
      subject: `${opts.reminder ? 'Reminder: ' : ''}Please sign ${doc.kind === 'mom' ? 'the MoM' : 'the resolution'} · ${bundle.meeting.meetingNo}`,
      message,
      html: (msg) =>
        renderEmailDocument({
          eyebrow: opts.reminder ? 'Reminder · signature needed' : 'Signature needed',
          title: doc.title,
          bodyHtml: [
            messageHtml(msg),
            doc.kind === 'resolution' ? emailCallout(escapeHtml(doc.description)) : '',
            emailMetaTable(signers.map((s) => ({ label: s.name, value: s.din ? `DIN ${s.din}` : 'Director' }))),
          ].join(''),
        }),
      text: (msg) => msg,
      attachments: att ? [att] : [],
      purpose: 'board_meeting.signature',
      fixed: doc.kind === 'resolution' ? 'the text of the resolution and the list of signing directors' : 'the list of signing directors',
    },
  };
}

/** GL-07: the signature request as a draft. */
export async function previewForSignature(docId: string, opts: { lead: { name: string; email: string } | null; reminder: boolean }): Promise<EmailDraftView | null> {
  const built = await composeSignature(docId, opts);
  return built ? draftView(built.composed) : null;
}

export async function sendForSignature(docId: string, opts: { lead: { name: string; email: string } | null; reminder: boolean; edits?: EmailEdits }): Promise<{ count: number; mail: SentMail | null }> {
  const built = await composeSignature(docId, opts);
  if (!built) return { count: 0, mail: null };
  const mail = await sendComposed(built.composed, opts.edits);
  return { count: built.signers, mail };
}

async function composeFinalCopy(docId: string, ccEmails: string[]) {
  const doc = await systemDocument(docId);
  if (!doc || doc.status !== 'locked') return null;
  const bundle = await systemMeetingBundle(doc.meetingId);
  if (!bundle) return null;
  const today = todayIst();
  const current = bundle.directors.filter((d) => (!d.ceasedOn || d.ceasedOn > today) && d.email);
  if (!current.length) return null;
  const att = await documentFile(doc, bundle, 'signed');
  const message = `The signed copy of ${doc.kind === 'mom' ? 'the minutes of meeting' : 'the resolution'} of ${bundle.company.name} (${bundle.meeting.meetingNo}) is attached for your records. It is now locked in VCFO Suite.`;
  const composed: ComposedEmail = {
    to: current.map((d) => d.email!),
    cc: [...new Set(ccEmails.filter(Boolean))],
    subject: `Signed copy · ${doc.title} · ${bundle.meeting.meetingNo}`,
    message,
    html: (msg) => renderEmailDocument({ eyebrow: 'Signed and locked', title: doc.title, bodyHtml: messageHtml(msg) }),
    text: (msg) => msg,
    attachments: att ? [att] : [],
    purpose: 'board_meeting.final_copy',
  };
  return { doc, bundle, current, composed };
}

/** GL-07: the signed copy email as a draft. */
export async function previewFinalCopy(docId: string, ccEmails: string[]): Promise<EmailDraftView | null> {
  const built = await composeFinalCopy(docId, ccEmails);
  return built ? draftView(built.composed) : null;
}

export async function sendFinalCopy(docId: string, opts: { ccEmails: string[]; notifyIds: string[]; edits?: EmailEdits }): Promise<{ count: number; mail: SentMail | null }> {
  const built = await composeFinalCopy(docId, opts.ccEmails);
  if (!built) return { count: 0, mail: null };
  const { doc, bundle, current, composed } = built;
  const mail = await sendComposed(composed, opts.edits);
  await systemMarkFinalSent(doc.id, current.map((d) => d.id));
  await bell(bundle, opts.notifyIds, `Signed and locked: ${doc.title}`, `Final copy emailed to ${mail.to.length} directors.`);
  return { count: mail.to.length, mail };
}

async function bell(bundle: Bundle, userIds: string[], title: string, body: string): Promise<void> {
  await notifyMeeting(null, { meeting: bundle.meeting, companyName: bundle.company.name, title, body, recipientIds: userIds });
}

/** T-10 and MoM reminders to the lead (bell + email). */
export async function remindLead(input: { meetingId: string; lead: { id: string; name: string; email: string }; kind: 'prepare' | 'mom'; daysAfter?: number }): Promise<void> {
  const bundle = await systemMeetingBundle(input.meetingId);
  if (!bundle) return;
  const m = bundle.meeting;
  const href = `${siteUrl()}${meetingHref('intern', m.id)}`;
  const title =
    input.kind === 'prepare'
      ? `Prepare the notice: ${m.meetingNo}`
      : (input.daysAfter ?? 0) > 30
        ? `MoM overdue: ${m.meetingNo}`
        : `Upload the signed MoM: ${m.meetingNo}`;
  const body =
    input.kind === 'prepare'
      ? `Board meeting on ${shortDate(m.meetingDate)}. Send the notice for approval so it goes out by ${shortDate(addDaysIso(m.meetingDate, -7))}.`
      : `Meeting held on ${shortDate(m.meetingDate)}. The signed MoM is due by ${shortDate(addDaysIso(m.meetingDate, 30))} (SS-1).`;
  await sendEmail({
    to: input.lead.email,
    subject: `${title} · ${bundle.company.name}`,
    html: renderEmailDocument({ eyebrow: 'Board meeting', title, bodyHtml: emailParagraph(escapeHtml(body)), cta: { label: 'Open the meeting', href } }),
    text: `${title}\n${body}\n${href}`,
    purpose: `board_meeting.reminder.${input.kind}`,
  });
  await createNotificationsForUsers([
    {
      userId: input.lead.id,
      kind: 'board.meeting' as const,
      title,
      body,
      engagementId: appEngagementId(m.engagementId),
      companyName: bundle.company.name,
      itemId: m.id,
      href: meetingHref('intern', m.id),
    },
  ]).catch(() => []);
}

function composeReplyReminder(bundle: Bundle, replied: string[]): ComposedEmail | null {
  const m = bundle.meeting;
  const { directors } = people(bundle);
  const open = directors.filter((d) => d.email && !replied.includes(d.id));
  if (!open.length) return null;
  const base = siteUrl();
  const rows = open
    .map((d) => {
      const t = signDirectorLink(m.id, d.id);
      const href = (r: string) => `${base}/meeting-reply?t=${encodeURIComponent(t)}&r=${r}`;
      return `<tr><td style="padding:8px 0;font-size:14px;">${emailInk(escapeHtml(d.name), 400)}</td><td style="padding:8px 0;text-align:right;">${btn(href('yes'), 'I will attend', true)}${btn(href('no'), "I can't attend")}</td></tr>`;
    })
    .join('');
  const kind = KIND_LABEL[m.kind as MeetingKind] ?? 'Board meeting';
  return {
    to: open.map((d) => d.email!),
    cc: [],
    subject: `Reminder: will you attend? ${kind} · ${m.meetingNo} · ${shortDate(m.meetingDate)}`,
    message: `The meeting is on ${shortDate(m.meetingDate)} at ${noticeTime(m.meetingTime)} IST. Please tell us if you will attend.`,
    html: (msg) =>
      renderEmailDocument({
        eyebrow: 'Reminder',
        title: `${kind} · ${bundle.company.name}`,
        bodyHtml: messageHtml(msg) + `<table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table>`,
      }),
    text: (msg) => `${msg}\nPlease reply from the notice email.`,
    attachments: [],
    purpose: 'board_meeting.reply_reminder',
    fixed: 'the attendance buttons for each director who has not replied',
  };
}

/** GL-07: the attendance reminder as a draft. */
export async function previewReplyReminder(meetingId: string, replied: string[]): Promise<EmailDraftView | null> {
  const bundle = await systemMeetingBundle(meetingId);
  const composed = bundle ? composeReplyReminder(bundle, replied) : null;
  return composed ? draftView(composed) : null;
}

/** Remind directors who have not replied (one email, To those directors only). */
export async function remindNonResponders(meetingId: string, replied: string[], edits?: EmailEdits): Promise<{ count: number; mail: SentMail | null }> {
  const bundle = await systemMeetingBundle(meetingId);
  const composed = bundle ? composeReplyReminder(bundle, replied) : null;
  if (!composed) return { count: 0, mail: null };
  const mail = await sendComposed(composed, edits);
  return { count: mail.to.length, mail };
}
