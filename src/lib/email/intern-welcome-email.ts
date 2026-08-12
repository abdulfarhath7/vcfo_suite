import 'server-only';
import { loginUrl, resetPasswordUrl } from '@/lib/site-url';
import { formatReplyTo, formatFromWithSender, sendResendEmail, type SendResendResult } from './send-resend';

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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildInternWelcomeEmail(params: InternWelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'VCFO Suite — your project lead account';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f7f6fb;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1a1b22;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6fb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e4f2;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#1a1b22;padding:24px 28px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#a78bfa;">VCFO Suite</p>
              <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-weight:400;font-size:26px;color:#f7f6fb;">Your project lead account</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(params.internName)},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                Your VCFO Suite project lead account is ready. Use it to manage GCC setup projects, review client submissions, and coordinate delivery work.
              </p>
              <h2 style="margin:0 0 12px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b6560;">Sign-in credentials</h2>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;font-size:14px;line-height:1.6;border:1px solid #e8e4f2;border-radius:6px;">
                <tr>
                  <td style="padding:12px 16px;background:#f7f6fb;color:#6b6560;width:40%;">Login email</td>
                  <td style="padding:12px 16px;"><strong>${escapeHtml(params.internEmail)}</strong></td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f7f6fb;color:#6b6560;border-top:1px solid #e8e4f2;">Temporary password</td>
                  <td style="padding:12px 16px;border-top:1px solid #e8e4f2;font-family:ui-monospace,monospace;">${escapeHtml(params.temporaryPassword)}</td>
                </tr>
              </table>
              <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#6b6560;">
                <strong>Please change your password after your first sign-in.</strong>
                Use Forgot password on the login page, or open
                <a href="${escapeHtml(params.resetUrl)}" style="color:#7c5cfc;">reset password</a> directly.
              </p>
              <p style="margin:24px 0 0;font-size:14px;line-height:1.6;">
                <a href="${escapeHtml(params.portalUrl)}" style="color:#7c5cfc;font-weight:600;">Open VCFO Suite (sign in)</a>
              </p>
              <p style="margin:28px 0 0;font-size:14px;line-height:1.6;">
                Regards,<br/>
                <strong>${escapeHtml(params.managerName)}</strong><br/>
                <a href="mailto:${escapeHtml(params.managerEmail)}" style="color:#1a1b22;">${escapeHtml(params.managerEmail)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
