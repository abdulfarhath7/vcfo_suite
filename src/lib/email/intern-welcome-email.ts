import 'server-only';
import { loginUrl, resetPasswordUrl } from '@/lib/site-url';
import {
  formatReplyTo,
  formatFromWithSender,
  sendResendEmail,
  type SendResendResult,
} from './send-resend';
import {
  emailMetaTable,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '@/lib/email/email-layout';

export type SendEmailResult = SendResendResult;

export interface InternWelcomeEmailParams {
  internEmail: string;
  internName: string;
  managerName: string;
  managerEmail: string;
  portalUrl: string;
  resetUrl: string;
  /** One-time credential for welcome email only — never log or persist. */
  temporaryPassword: string;
}

export function buildInternWelcomeEmail(params: InternWelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'VCFO Suite — your project lead account';

  const html = renderEmailDocument({
    eyebrow: 'Account ready',
    title: 'Your project lead account',
    bodyHtml:
      emailParagraph(`Dear ${escapeHtml(params.internName)},`) +
      emailParagraph(
        'Your VCFO Suite project lead account is ready. Use it to manage GCC setup projects, review client submissions, and coordinate delivery work.',
      ) +
      `<p style="margin:18px 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;font-weight:700;">Sign-in credentials</p>` +
      emailMetaTable([
        { label: 'Login email', value: params.internEmail },
        { label: 'Temporary password', value: params.temporaryPassword },
      ]) +
      emailParagraph(
        `<strong>Please change your password after your first sign-in.</strong> Use Forgot password on the login page, or open <a href="${escapeHtml(params.resetUrl)}" style="color:#ea580c;">reset password</a> directly.`,
      ),
    cta: { label: 'Open VCFO Suite', href: params.portalUrl },
    signatureHtml: `<p style="margin:0;font-size:14px;line-height:1.6;color:#44403c;">Regards,<br/><strong>${escapeHtml(params.managerName)}</strong><br/><a href="mailto:${escapeHtml(params.managerEmail)}" style="color:#ea580c;text-decoration:none;">${escapeHtml(params.managerEmail)}</a></p>`,
  });

  const text = `Dear ${params.internName},

Your VCFO Suite project lead account is ready.

Sign-in credentials:
Login email: ${params.internEmail}
Temporary password: ${params.temporaryPassword}

Please change your password after your first sign-in.
Reset password: ${params.resetUrl}
Sign in: ${params.portalUrl}

Regards,
${params.managerName}
${params.managerEmail}
`;

  return { subject, html, text };
}

export async function sendInternWelcomeEmail(
  params: InternWelcomeEmailParams,
): Promise<SendEmailResult> {
  const { subject, html, text } = buildInternWelcomeEmail(params);

  return sendResendEmail({
    purpose: 'intern-welcome',
    to: params.internEmail,
    from: formatFromWithSender({ name: params.managerName }),
    replyTo: formatReplyTo({
      name: params.managerName,
      email: params.managerEmail,
    }),
    subject,
    html,
    text,
  });
}

export function resolveInternWelcomeUrls(): { portalUrl: string; resetUrl: string } {
  return { portalUrl: loginUrl(), resetUrl: resetPasswordUrl() };
}
