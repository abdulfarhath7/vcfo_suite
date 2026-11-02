import { emailCallout, emailParagraph, escapeHtml, renderEmailDocument } from '@/lib/email/email-layout';
import { siteUrl } from '@/lib/site-url';

/**
 * Email copy for client messages and reminders. Pure builders: the callers in
 * `notify-messages.ts` and `src/lib/reminders/` send them through `sendEmail`.
 */

export type MessageEmailCopy = { subject: string; html: string; text: string };

function absolute(path: string): string {
  if (path.startsWith('http')) return path;
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Keeps a subject line to one short line. */
function snippet(body: string, max = 80): string {
  const line = body.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** Message body as escaped paragraphs; blank lines split paragraphs, single breaks stay. */
function bodyHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((para) => emailParagraph(escapeHtml(para).replace(/\n/g, '<br />')))
    .join('');
}

/** To the project leads: a client wrote on the engagement. */
export function buildClientMessageEmail(input: {
  companyName: string;
  senderName: string;
  body: string;
  inboxHref: string;
}): MessageEmailCopy {
  const href = absolute(input.inboxHref);
  return {
    subject: `${input.companyName}: message from ${input.senderName} · ${snippet(input.body, 60)}`,
    html: renderEmailDocument({
      eyebrow: input.companyName,
      title: `New message from ${input.senderName}`,
      bodyHtml: bodyHtml(input.body),
      cta: { label: 'Open inbox', href },
    }),
    text: `${input.senderName} (${input.companyName}) wrote:\n\n${input.body}\n\nOpen inbox: ${href}`,
  };
}

/** To the client: someone at SBC answered. */
export function buildStaffReplyEmail(input: {
  companyName: string;
  senderName: string;
  body: string;
  portalHref: string;
}): MessageEmailCopy {
  const href = absolute(input.portalHref);
  return {
    subject: `${input.companyName}: reply from ${input.senderName}`,
    html: renderEmailDocument({
      eyebrow: input.companyName,
      title: `Reply from ${input.senderName}`,
      bodyHtml: bodyHtml(input.body),
      cta: { label: 'Open messages', href },
    }),
    text: `${input.senderName} at SBC wrote:\n\n${input.body}\n\nOpen messages: ${href}`,
  };
}

/** To the client: a reminder about one item they still owe. */
export function buildReminderEmail(input: {
  companyName: string;
  itemTitle: string;
  senderName: string;
  note?: string | null;
  portalHref: string;
}): MessageEmailCopy {
  const href = absolute(input.portalHref);
  const note = input.note?.trim();
  return {
    subject: `${input.companyName}: reminder · ${input.itemTitle}`,
    html: renderEmailDocument({
      eyebrow: 'Reminder',
      title: input.itemTitle,
      bodyHtml:
        emailParagraph(
          `<strong>${escapeHtml(input.itemTitle)}</strong> for <strong>${escapeHtml(input.companyName)}</strong> is waiting on you.`,
        ) +
        (note ? emailCallout(`<strong>${escapeHtml(input.senderName)}:</strong> ${escapeHtml(note)}`) : ''),
      cta: { label: 'Open client portal', href },
    }),
    text: `${input.itemTitle} for ${input.companyName} is waiting on you.${
      note ? `\n\n${input.senderName}: ${note}` : ''
    }\n\nOpen: ${href}`,
  };
}
