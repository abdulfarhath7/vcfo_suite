import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { AssignmentError, assignLeadTask } from '@/db/repositories/work-assignments';
import { emailParagraph, escapeHtml, renderEmailDocument } from '@/lib/email/email-layout';
import { formatReplyTo, sendEmail } from '@/lib/email/send-email';
import { INTERN_TASKS_PATH } from '@/lib/intern/intern-work';
import { siteUrl } from '@/lib/site-url';

/**
 * The manager's "Assign task" (G-12), behind `POST /api/tasks` with a `leadId`. The task is
 * stored first; the bell row, the email and the audit event follow and never undo it.
 */

export const assignTaskSchema = z.object({
  engagementId: z.string().trim().min(1, 'Pick a company').max(120),
  leadId: z.string().trim().min(1, 'Pick a project lead').max(120),
  title: z.string().trim().min(1, 'Write a title').max(200, 'Title is too long'),
  description: z.string().trim().max(4000, 'Description is too long').nullish(),
  deadline: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid deadline')
    .nullish(),
});

export type AssignTaskBody = z.infer<typeof assignTaskSchema>;

function dayMonth(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export async function handleAssignTask(ctx: AuthContext, body: AssignTaskBody): Promise<Response> {
  try {
    // A bare date is due at the end of that day in India.
    const deadline = body.deadline
      ? body.deadline.length === 10
        ? `${body.deadline}T23:59:00+05:30`
        : body.deadline
      : null;
    const { task, lead, companyName, engagementDbId } = await assignLeadTask(ctx, {
      engagementId: body.engagementId,
      leadId: body.leadId,
      title: body.title,
      description: body.description,
      deadline,
    });

    const due = body.deadline ? ` · due ${dayMonth(body.deadline)}` : '';
    await createNotificationsForUsers([
      {
        userId: lead.profileId,
        kind: 'team.assigned',
        title: `${companyName}: new task from ${ctx.name}`,
        body: `${body.title}${due}`,
        engagementId: task.engagementId,
        companyName,
        itemId: `task:${task.id}`,
        href: INTERN_TASKS_PATH,
      },
    ]).catch((err) => console.error('[tasks/assign] bell failed', err));

    const href = `${siteUrl()}${INTERN_TASKS_PATH}`;
    await sendEmail({
      to: lead.email,
      replyTo: formatReplyTo({ name: ctx.name, email: ctx.email }),
      subject: `${companyName}: new task · ${body.title}`,
      html: renderEmailDocument({
        eyebrow: companyName,
        title: body.title,
        bodyHtml:
          emailParagraph(`${escapeHtml(ctx.name)} assigned you a task${escapeHtml(due)}.`) +
          (body.description ? emailParagraph(escapeHtml(body.description).replace(/\n/g, '<br />')) : ''),
        cta: { label: 'Open my work', href },
      }),
      text: `${ctx.name} assigned you a task${due}: ${body.title}${
        body.description ? `\n\n${body.description}` : ''
      }\n\nOpen: ${href}`,
      purpose: 'tasks.assigned',
    }).catch((err) => console.error('[tasks/assign] email failed', err));

    await recordAuditEvent(ctx, {
      engagementId: engagementDbId,
      action: 'task.assigned',
      summary: `Assigned a task to ${lead.name}: ${body.title}`,
      metadata: { taskId: task.id, leadProfileId: lead.profileId, deadline: body.deadline ?? null },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    if (err instanceof AssignmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[tasks/assign] failed', err);
    return NextResponse.json({ error: 'Could not assign the task' }, { status: 500 });
  }
}
