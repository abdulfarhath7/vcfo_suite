import {
  formatFromWithSender,
  formatReplyTo,
  sendResendEmail,
  type SendResendResult,
} from '@/lib/email/send-resend';
import {
  emailCallout,
  emailMetaTable,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '@/lib/email/email-layout';
import { loginUrl } from '@/lib/site-url';

export interface ClientEmailChangedParams {
  /** The address losing access — this email goes there and nowhere else. */
  previousEmail: string;
  previousName: string;
  /** The address that now signs in for this project. */
  newEmail: string;
  companyName: string;
  /** Staff member who made the change. */
  actorName: string;
  actorEmail: string;
}

function buildClientEmailChangedEmail(params: ClientEmailChangedParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your VCFO Suite sign-in email has changed — ${params.companyName}`;

  const html = renderEmailDocument({
    eyebrow: 'Account update',
    title: 'Your sign-in email has been changed',
    bodyHtml:
      emailParagraph(`Dear ${escapeHtml(params.previousName)},`) +
      emailParagraph(
        `The sign-in email for the <strong>${escapeHtml(params.companyName)}</strong> engagement on VCFO Suite has been changed by VCFO.`,
      ) +
      emailMetaTable([
        { label: 'Changed from', value: params.previousEmail },
        { label: 'Changed to', value: params.newEmail },
        { label: 'Project', value: params.companyName },
      ]) +
      emailCallout(
        `<strong>${escapeHtml(params.previousEmail)}</strong> can no longer sign in to this project. Everything you filed stays on the record.`,
      ) +
      emailParagraph(
        'If you did not expect this change, reply to this email and we will look into it.',
      ),
    cta: { label: 'Open VCFO Suite', href: loginUrl() },
    signatureHtml: `<p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Regards,<br/><strong>${escapeHtml(params.actorName)}</strong><br/><a href="mailto:${escapeHtml(params.actorEmail)}" style="color:#2563EB;text-decoration:none;">${escapeHtml(params.actorEmail)}</a></p>`,
  });

  const text = `Dear ${params.previousName},

The sign-in email for the ${params.companyName} engagement on VCFO Suite has been changed by VCFO.

Changed from: ${params.previousEmail}
Changed to: ${params.newEmail}
Project: ${params.companyName}

${params.previousEmail} can no longer sign in to this project. Everything you filed stays on the record.

If you did not expect this change, reply to this email and we will look into it.

VCFO Suite: ${loginUrl()}

Regards,
${params.actorName}
${params.actorEmail}
`;

  return { subject, html, text };
}

/**
 * Tells the outgoing address that it has been swapped out. Sent to the previous
 * email only — never CC'd to the new one, which gets its own welcome email.
 */
export async function sendClientEmailChangedEmail(
  params: ClientEmailChangedParams,
): Promise<SendResendResult> {
  const { subject, html, text } = buildClientEmailChangedEmail(params);
  return sendResendEmail({
    purpose: 'client-email-changed',
    to: params.previousEmail,
    from: formatFromWithSender({ name: params.actorName }),
    replyTo: formatReplyTo({ name: params.actorName, email: params.actorEmail }),
    subject,
    html,
    text,
  });
}
