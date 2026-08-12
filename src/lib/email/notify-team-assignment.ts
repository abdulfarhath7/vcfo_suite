import 'server-only';

import {
  emailMetaTable,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '@/lib/email/email-layout';
import {
  formatFromWithSender,
  formatReplyTo,
  sendResendEmail,
  type SendEmailResult,
} from '@/lib/email/send-resend';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import {
  emptyEmailDispatch,
  pushEmailSubject,
  type EmailDispatchResult,
} from '@/lib/email/email-dispatch';
import { adminProjectPath, internEngagementPath } from '@/lib/project-step-path';
import { siteUrl } from '@/lib/site-url';

export type TeamRoleLabel = 'project manager' | 'project lead';

export type TeamAssignmentParty = {
  userId: string;
  email: string;
  name: string;
};

function absolute(path: string): string {
  if (path.startsWith('http')) return path;
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function workspaceHref(
  role: TeamRoleLabel,
  project: { id: string; slug?: string | null },
): string {
  if (role === 'project lead') return absolute(internEngagementPath(project));
  return absolute(adminProjectPath(project));
}

function buildAssignedEmail(input: {
  role: TeamRoleLabel;
  companyName: string;
  assigneeName: string;
  actorName: string;
  href: string;
}): { subject: string; html: string; text: string } {
  const roleTitle = input.role === 'project lead' ? 'Project lead' : 'Project manager';
  return {
    subject: `You’ve been assigned to ${input.companyName}`,
    html: renderEmailDocument({
      eyebrow: 'Team assignment',
      title: `You’re on ${input.companyName}`,
      bodyHtml:
        emailParagraph(`Hi ${escapeHtml(input.assigneeName)},`) +
        emailParagraph(
          `<strong>${escapeHtml(input.actorName)}</strong> assigned you as <strong>${escapeHtml(input.role)}</strong> on this project.`,
        ) +
        emailMetaTable([
          { label: 'Project', value: input.companyName },
          { label: 'Your role', value: roleTitle },
        ]) +
        emailParagraph('Open the workspace to review the checklist, team, and next milestones.'),
      cta: { label: 'Open project', href: input.href },
    }),
    text: `Hi ${input.assigneeName},\n\n${input.actorName} assigned you as ${input.role} on ${input.companyName}.\n\nOpen: ${input.href}\n`,
  };
}

function buildRemovedEmail(input: {
  role: TeamRoleLabel;
  companyName: string;
  assigneeName: string;
  actorName: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `You’ve been removed from ${input.companyName}`,
    html: renderEmailDocument({
      eyebrow: 'Team update',
      title: `Assignment ended on ${input.companyName}`,
      bodyHtml:
        emailParagraph(`Hi ${escapeHtml(input.assigneeName)},`) +
        emailParagraph(
          `<strong>${escapeHtml(input.actorName)}</strong> removed you as <strong>${escapeHtml(input.role)}</strong> from this project.`,
        ) +
        emailParagraph(
          'You will no longer receive project updates for this engagement. Contact your firm admin if this was unexpected.',
        ),
    }),
    text: `Hi ${input.assigneeName},\n\n${input.actorName} removed you as ${input.role} from ${input.companyName}.\n`,
  };
}

function record(
  email: EmailDispatchResult,
  to: string,
  result: SendEmailResult,
  subject?: string,
): void {
  email.attempted += 1;
  if (result.ok) {
    email.sent.push(to);
    pushEmailSubject(email, subject);
  } else if (result.skipped) {
    email.skipped.push(to);
    pushEmailSubject(email, subject);
  } else {
    email.failed.push(to);
    pushEmailSubject(email, subject);
  }
}

/**
 * Notify a person they were added to / removed from a project team.
 * Also creates an in-app notification on their dashboard.
 */
export async function notifyTeamAssignment(input: {
  engagementAppId: string;
  engagementSlug?: string | null;
  companyName: string;
  role: TeamRoleLabel;
  party: TeamAssignmentParty;
  action: 'assigned' | 'removed';
  actor: { userId: string; name: string; email?: string | null };
}): Promise<EmailDispatchResult> {
  const email = emptyEmailDispatch();
  if (!input.party.email?.trim()) return email;
  if (input.party.userId === input.actor.userId) return email;

  const project = { id: input.engagementAppId, slug: input.engagementSlug };
  const href = workspaceHref(input.role, project);
  const copy =
    input.action === 'assigned'
      ? buildAssignedEmail({
          role: input.role,
          companyName: input.companyName,
          assigneeName: input.party.name,
          actorName: input.actor.name,
          href,
        })
      : buildRemovedEmail({
          role: input.role,
          companyName: input.companyName,
          assigneeName: input.party.name,
          actorName: input.actor.name,
        });

  try {
    const result = await sendResendEmail({
      purpose: `team.${input.action}.${input.role === 'project lead' ? 'lead' : 'manager'}`,
      to: input.party.email,
      from: formatFromWithSender({ name: input.actor.name }),
      replyTo: formatReplyTo({
        name: input.actor.name,
        email: input.actor.email,
      }),
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
    });
    record(email, input.party.email, result, copy.subject);
  } catch (err) {
    console.error('[notify-team] send failed', err);
    email.attempted += 1;
    email.failed.push(input.party.email);
  }

  try {
    await createNotificationsForUsers([
      {
        userId: input.party.userId,
        kind: input.action === 'assigned' ? 'team.assigned' : 'team.removed',
        title:
          input.action === 'assigned'
            ? `Assigned as ${input.role}`
            : `Removed as ${input.role}`,
        body:
          input.action === 'assigned'
            ? `${input.actor.name} added you to ${input.companyName}.`
            : `${input.actor.name} removed you from ${input.companyName}.`,
        engagementId: input.engagementAppId,
        companyName: input.companyName,
        href: input.action === 'assigned' ? href : '#',
      },
    ]);
  } catch (err) {
    console.error('[notify-team] notification failed', err);
  }

  return email;
}

export async function notifyTeamAssignments(input: {
  engagementAppId: string;
  engagementSlug?: string | null;
  companyName: string;
  actor: { userId: string; name: string; email?: string | null };
  assigned?: Array<{ role: TeamRoleLabel; party: TeamAssignmentParty }>;
  removed?: Array<{ role: TeamRoleLabel; party: TeamAssignmentParty }>;
}): Promise<EmailDispatchResult> {
  const merged = emptyEmailDispatch();
  for (const row of input.assigned ?? []) {
    const part = await notifyTeamAssignment({
      ...input,
      role: row.role,
      party: row.party,
      action: 'assigned',
    });
    merged.attempted += part.attempted;
    merged.sent.push(...part.sent);
    merged.skipped.push(...part.skipped);
    merged.failed.push(...part.failed);
    if (!merged.subjects) merged.subjects = [];
    merged.subjects.push(...(part.subjects ?? []));
  }
  for (const row of input.removed ?? []) {
    const part = await notifyTeamAssignment({
      ...input,
      role: row.role,
      party: row.party,
      action: 'removed',
    });
    merged.attempted += part.attempted;
    merged.sent.push(...part.sent);
    merged.skipped.push(...part.skipped);
    merged.failed.push(...part.failed);
    if (!merged.subjects) merged.subjects = [];
    merged.subjects.push(...(part.subjects ?? []));
  }
  merged.sent = [...new Set(merged.sent)];
  merged.skipped = [...new Set(merged.skipped)];
  merged.failed = [...new Set(merged.failed)];
  merged.subjects = [...new Set(merged.subjects ?? [])];
  return merged;
}
