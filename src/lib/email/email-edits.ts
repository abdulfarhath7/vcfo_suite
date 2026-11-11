import { z } from 'zod';
import type { EmailAttachment, SendEmailInput } from '@/lib/email/send-email-shared';
import { emailParagraph, escapeHtml } from '@/lib/email/email-layout';

/**
 * GL-07: no card sends an email by itself. A card's action first answers with a draft (To, Cc,
 * Subject, the message and the attachment names), the person edits it in the "Send email" pop-up,
 * and only their Send click posts the edits back. The parts of an email that are not words
 * (reply buttons, an agenda table, calendar links) stay below the message and are named in the
 * pop-up, so editing the message never breaks them.
 */

/** What a sender builds before anything goes out. */
export interface ComposedEmail {
  to: string[];
  cc: string[];
  subject: string;
  /** The words the person can change. */
  message: string;
  /** The whole HTML for a given message (the fixed parts are added by the sender). */
  html: (message: string) => string;
  /** The plain-text body for a given message. */
  text: (message: string) => string;
  attachments: EmailAttachment[];
  replyTo?: string | string[];
  purpose: string;
  /** What else the email carries that the pop-up does not edit, e.g. "reply buttons and the agenda". */
  fixed?: string;
}

/** The draft the pop-up shows. */
export interface EmailDraftView {
  to: string[];
  cc: string[];
  subject: string;
  message: string;
  attachments: string[];
  fixed?: string;
}

const Attachment = z.object({
  filename: z.string().trim().min(1).max(200),
  contentBase64: z.string().max(14_000_000),
  contentType: z.string().max(200).optional(),
});

export const EmailEditsSchema = z.object({
  to: z.array(z.string().trim().email()).min(1).max(50),
  cc: z.array(z.string().trim().email()).max(50).default([]),
  subject: z.string().trim().min(1).max(300),
  message: z.string().max(20_000),
  /** Names of the drafted attachments the person removed. */
  dropAttachments: z.array(z.string()).max(50).default([]),
  /** Files the person added in the pop-up. */
  addAttachments: z.array(Attachment).max(5).default([]),
});

export type EmailEdits = z.infer<typeof EmailEditsSchema>;

/** A card action's body: `preview: true` asks for the draft; `email` is the person's Send. */
export const EmailStepSchema = z.object({
  preview: z.boolean().optional(),
  email: EmailEditsSchema.optional(),
});

export function draftView(email: ComposedEmail): EmailDraftView {
  return {
    to: email.to,
    cc: email.cc.filter((c) => !email.to.includes(c)),
    subject: email.subject,
    message: email.message,
    attachments: email.attachments.map((a) => a.filename),
    ...(email.fixed ? { fixed: email.fixed } : {}),
  };
}

/** The message as HTML paragraphs, safe to put in a layout. */
export function messageHtml(message: string): string {
  return message
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => emailParagraph(escapeHtml(para).replace(/\n/g, '<br>')))
    .join('');
}

const ADD_LIMIT_BYTES = 10 * 1024 * 1024;

/** The send that goes out: the draft with the person's edits. */
export function withEdits(email: ComposedEmail, edits: EmailEdits): SendEmailInput {
  const dropped = new Set(edits.dropAttachments);
  let added = 0;
  const extra: EmailAttachment[] = edits.addAttachments.map((a) => {
    const content = Uint8Array.from(Buffer.from(a.contentBase64, 'base64'));
    added += content.byteLength;
    return { filename: a.filename, content, contentType: a.contentType || 'application/octet-stream' };
  });
  if (added > ADD_LIMIT_BYTES) throw new Error('attachments_too_large');
  return {
    to: [...new Set(edits.to.map((e) => e.toLowerCase()))],
    cc: [...new Set(edits.cc.map((e) => e.toLowerCase()))].filter((c) => !edits.to.map((t) => t.toLowerCase()).includes(c)),
    subject: edits.subject,
    html: email.html(edits.message),
    text: email.text(edits.message),
    attachments: [...email.attachments.filter((a) => !dropped.has(a.filename)), ...extra],
    replyTo: email.replyTo,
    purpose: email.purpose,
  };
}
