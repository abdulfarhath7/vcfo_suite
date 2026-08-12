import { dueItemsForStage, formatEngagementDueContext, type DueLine } from './due-summary';
import { getProgressCcRecipients } from './merge-cc';
import { formatReplyTo, formatFromWithSender, sendResendEmail, type SendResendResult } from './send-resend';
import { loginUrl } from '@/lib/site-url';

export interface WelcomeEmailParams {
  clientEmail: string;
  clientName: string;
  companyName: string;
  stage: string;
  health: string;
  createdAt: string;
  managerName: string;
  managerEmail: string;
  portalUrl: string;
  /** One-time credential for welcome email only — never log, persist to DB, or include in error payloads. */
  clientPassword?: string;
  /** Resend from project detail — password not available. */
  isResend?: boolean;
  /** Engagement-specific CC (merged with RESEND_PROGRESS_CC; excludes primary recipient). */
  engagementProgressCc?: string[];
}

export type SendEmailResult = SendResendResult;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildDueListHtml(lines: DueLine[]): string {
  if (!lines.length) {
    return '<p>No checklist items for this phase yet. Your manager will share deadlines in the portal.</p>';
  }
  const items = lines
    .map(
      (line) =>
        `<li style="margin-bottom:8px;"><strong>${escapeHtml(line.title)}</strong><br/><span style="color:#6b6560;">${escapeHtml(line.timeline)}</span></li>`,
    )
    .join('');
  return `<ul style="padding-left:20px;margin:0;">${items}</ul>`;
}

function buildDueListText(lines: DueLine[]): string {
  if (!lines.length) return '- Review upcoming items in your client portal.';
  return lines.map((line) => `- ${line.title}: ${line.timeline}`).join('\n');
}

function buildCredentialsHtml(params: WelcomeEmailParams): string {
  if (params.clientPassword) {
    return `
              <h2 style="margin:0 0 12px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b6560;">Sign-in credentials</h2>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;font-size:14px;line-height:1.6;border:1px solid #e8e2d8;border-radius:6px;">
                <tr>
                  <td style="padding:12px 16px;background:#f5f1ea;color:#6b6560;width:40%;">Login email</td>
                  <td style="padding:12px 16px;"><strong>${escapeHtml(params.clientEmail)}</strong></td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background:#f5f1ea;color:#6b6560;border-top:1px solid #e8e2d8;">Temporary password</td>
                  <td style="padding:12px 16px;border-top:1px solid #e8e2d8;font-family:ui-monospace,monospace;">${escapeHtml(params.clientPassword)}</td>
                </tr>
              </table>`;
  }
  if (params.isResend) {
    return `
              <p style="margin:0 0 20px;font-size:14px;line-height:1.6;padding:14px 16px;background:#f5f1ea;border-radius:6px;border:1px solid #e8e2d8;">
                Your temporary password was sent when this project was first set up.
                If you need to sign in or reset access, use <strong>Forgot password</strong> on the login page.
              </p>`;
  }
  return '';
}

function buildCredentialsText(params: WelcomeEmailParams): string {
  if (params.clientPassword) {
    return `Sign-in credentials:
Login email: ${params.clientEmail}
Temporary password: ${params.clientPassword}

`;
  }
  if (params.isResend) {
    return `Your temporary password was sent when this project was first set up. If you need access, use Forgot password on the login page.

`;
  }
  return '';
}

const SECURITY_HTML = `<p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#6b6560;">
                For your security, sign in and change your password using <strong>Forgot password</strong> on the login page.
              </p>`;

const SECURITY_TEXT =
  'For your security, sign in and change your password using Forgot password on the login page.\n\n';

function buildWelcomeEmail(params: WelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const dueLines = dueItemsForStage(params.stage);
  const contextLines = formatEngagementDueContext(params.stage, params.health, params.createdAt);
  const subject = `Welcome to VCFO Suite — ${params.companyName} project`;

  const contextHtml = contextLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const contextText = contextLines.map((line) => `- ${line}`).join('\n');
  const credentialsHtml = buildCredentialsHtml(params);
  const credentialsText = buildCredentialsText(params);

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F7F6FB;font-family:Manrope,Segoe UI,sans-serif;color:#1A1B22;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6FB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e8e4f2;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:#1A1B22;padding:24px 28px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#A78BFA;">VCFO Suite</p>
              <h1 style="margin:8px 0 0;font-family:Space Grotesk,Georgia,serif;font-weight:400;font-size:26px;color:#F7F6FB;">Your project is ready</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${escapeHtml(params.clientName)},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
                We have set up your <strong>${escapeHtml(params.companyName)}</strong> engagement on VCFO Suite.
                Sign in to track documents, tasks, and upcoming compliance milestones.
              </p>
              <h2 style="margin:0 0 12px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b6560;">Project summary</h2>
              <ul style="padding-left:20px;margin:0 0 24px;font-size:14px;line-height:1.5;">${contextHtml}</ul>
              <h2 style="margin:0 0 12px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#6b6560;">Upcoming milestones (${escapeHtml(params.stage)})</h2>
              ${buildDueListHtml(dueLines)}
              ${credentialsHtml}
              ${SECURITY_HTML}
              <p style="margin:24px 0 0;font-size:14px;line-height:1.6;">
                <a href="${escapeHtml(params.portalUrl)}" style="color:#7C5CFC;font-weight:600;">Open client portal (sign in)</a>
              </p>
              <p style="margin:28px 0 0;font-size:14px;line-height:1.6;">
                Regards,<br/>
                <strong>${escapeHtml(params.managerName)}</strong><br/>
                <a href="mailto:${escapeHtml(params.managerEmail)}" style="color:#1A1B22;">${escapeHtml(params.managerEmail)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Dear ${params.clientName},

Your ${params.companyName} project is now on VCFO Suite.

Project summary:
${contextText}

Upcoming milestones (${params.stage}):
${buildDueListText(dueLines)}

${credentialsText}${SECURITY_TEXT}Client portal (sign in): ${params.portalUrl}

Regards,
${params.managerName}
${params.managerEmail}
`;

  return { subject, html, text };
}

export function resolvePortalUrl(): string {
  return loginUrl();
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<SendEmailResult> {
  const { subject, html, text } = buildWelcomeEmail(params);
  const cc = getProgressCcRecipients(params.engagementProgressCc, {
    excludeTo: params.clientEmail,
  });

  return sendResendEmail({
    purpose: 'welcome',
    to: params.clientEmail,
    cc: cc.length > 0 ? cc : undefined,
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
