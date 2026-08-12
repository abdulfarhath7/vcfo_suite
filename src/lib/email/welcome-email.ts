import { dueItemsForStage, formatEngagementDueContext, type DueLine } from './due-summary';
import { getProgressCcRecipients } from './merge-cc';
import { formatReplyTo, formatFromWithSender, sendResendEmail, type SendResendResult } from './send-resend';
import { loginUrl } from '@/lib/site-url';
import {
  emailCallout,
  emailMetaTable,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '@/lib/email/email-layout';

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

function buildDueListHtml(lines: DueLine[]): string {
  if (!lines.length) {
    return emailParagraph(
      'No checklist items for this phase yet. Your manager will share deadlines in the portal.',
    );
  }
  const items = lines
    .map(
      (line) =>
        `<li style="margin-bottom:10px;"><strong>${escapeHtml(line.title)}</strong><br/><span style="color:#78716c;">${escapeHtml(line.timeline)}</span></li>`,
    )
    .join('');
  return `<ul style="padding-left:20px;margin:0 0 8px;">${items}</ul>`;
}

function buildDueListText(lines: DueLine[]): string {
  if (!lines.length) return '- Review upcoming items in your client portal.';
  return lines.map((line) => `- ${line.title}: ${line.timeline}`).join('\n');
}

function buildCredentialsHtml(params: WelcomeEmailParams): string {
  if (params.clientPassword) {
    return (
      `<p style="margin:18px 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;font-weight:700;">Sign-in credentials</p>` +
      emailMetaTable([
        { label: 'Login email', value: params.clientEmail },
        { label: 'Temporary password', value: params.clientPassword },
      ])
    );
  }
  if (params.isResend) {
    return emailCallout(
      'Your temporary password was sent when this project was first set up. If you need access, use <strong>Forgot password</strong> on the login page.',
    );
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

function buildWelcomeEmail(params: WelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const dueLines = dueItemsForStage(params.stage);
  const contextLines = formatEngagementDueContext(params.stage, params.health, params.createdAt);
  const subject = `Welcome to VCFO Suite — ${params.companyName}`;
  const contextText = contextLines.map((line) => `- ${line}`).join('\n');
  const credentialsHtml = buildCredentialsHtml(params);
  const credentialsText = buildCredentialsText(params);

  const html = renderEmailDocument({
    eyebrow: 'Client portal access',
    title: 'Your project is ready',
    bodyHtml:
      emailParagraph(`Dear ${escapeHtml(params.clientName)},`) +
      emailParagraph(
        `We have set up your <strong>${escapeHtml(params.companyName)}</strong> engagement on VCFO Suite. Sign in to track documents, tasks, and upcoming compliance milestones.`,
      ) +
      `<p style="margin:18px 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;font-weight:700;">Project summary</p>` +
      `<ul style="padding-left:20px;margin:0 0 18px;">${contextLines
        .map((line) => `<li style="margin-bottom:6px;">${escapeHtml(line)}</li>`)
        .join('')}</ul>` +
      `<p style="margin:18px 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#78716c;font-weight:700;">Upcoming milestones (${escapeHtml(params.stage)})</p>` +
      buildDueListHtml(dueLines) +
      credentialsHtml +
      emailParagraph(
        'For your security, sign in and change your password using <strong>Forgot password</strong> on the login page when convenient.',
      ),
    cta: { label: 'Open client portal', href: params.portalUrl },
    signatureHtml: `<p style="margin:0;font-size:14px;line-height:1.6;color:#44403c;">Regards,<br/><strong>${escapeHtml(params.managerName)}</strong><br/><a href="mailto:${escapeHtml(params.managerEmail)}" style="color:#ea580c;text-decoration:none;">${escapeHtml(params.managerEmail)}</a></p>`,
  });

  const text = `Dear ${params.clientName},

Your ${params.companyName} project is now on VCFO Suite.

Project summary:
${contextText}

Upcoming milestones (${params.stage}):
${buildDueListText(dueLines)}

${credentialsText}For your security, sign in and change your password using Forgot password on the login page.

Client portal: ${params.portalUrl}

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
