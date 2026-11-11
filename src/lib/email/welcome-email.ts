import { dueItemsForStage, formatEngagementDueContext, type DueLine } from './due-summary';
import { getProgressCcRecipients } from './merge-cc';
import { formatReplyTo, formatFromWithSender, sendEmail, type SendEmailResult } from '@/lib/email/send-email';
import { loginUrl } from '@/lib/site-url';
import {
  emailCallout,
  emailInk,
  emailLabel,
  emailLink,
  emailMetaTable,
  emailMuted,
  emailParagraph,
  emailSignature,
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
  /** C-899: the invitee's set-password link (seven days); used in place of a temporary password. */
  setPasswordUrl?: string;
  /** Resend from project detail — password not available. */
  isResend?: boolean;
  /** Engagement-specific CC (merged with RESEND_PROGRESS_CC; excludes primary recipient). */
  engagementProgressCc?: string[];
}


function buildDueListHtml(lines: DueLine[]): string {
  if (!lines.length) {
    return emailParagraph(
      'No checklist items for this phase yet. Your manager will share deadlines in the portal.',
    );
  }
  const items = lines
    .map(
      (line) =>
        `<li style="margin-bottom:10px;">${emailInk(escapeHtml(line.title))}<br/>${emailMuted(escapeHtml(line.timeline), 13)}</li>`,
    )
    .join('');
  return `<ul style="padding-left:20px;margin:0 0 8px;">${items}</ul>`;
}

function buildDueListText(lines: DueLine[]): string {
  if (!lines.length) return '- Review upcoming items in your client portal.';
  return lines.map((line) => `- ${line.title}: ${line.timeline}`).join('\n');
}

function buildCredentialsHtml(params: WelcomeEmailParams): string {
  if (params.setPasswordUrl) {
    return (
      emailLabel('Sign-in') +
      emailMetaTable([{ label: 'Login email', value: params.clientEmail }]) +
      emailParagraph(`${emailLink(params.setPasswordUrl, 'Set your password')}. The link works for 7 days.`)
    );
  }
  if (params.clientPassword) {
    return (
      emailLabel('Sign-in credentials') +
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
  if (params.setPasswordUrl) {
    return `Sign-in:
Login email: ${params.clientEmail}
Set your password: ${params.setPasswordUrl} (works for 7 days)

`;
  }
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
      emailLabel('Project summary') +
      `<ul style="padding-left:20px;margin:0 0 18px;">${contextLines
        .map((line) => `<li style="margin-bottom:6px;">${escapeHtml(line)}</li>`)
        .join('')}</ul>` +
      emailLabel(`Upcoming milestones (${params.stage})`) +
      buildDueListHtml(dueLines) +
      credentialsHtml +
      emailParagraph(
        'For your security, sign in and change your password using <strong>Forgot password</strong> on the login page when convenient.',
      ),
    cta: { label: 'Open client portal', href: params.portalUrl },
    signatureHtml: emailSignature(params.managerName, params.managerEmail),
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

  return sendEmail({
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
