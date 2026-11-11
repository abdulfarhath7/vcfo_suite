import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { checklistStateForViewer, getEngagementById, patchChecklistItem } from '@/db/repositories/engagements';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { getItem } from '@/data/checklist';
import { ASSIGNABLE_FILL_STEP_IDS } from '@/lib/incorporation/pre-inc-direct-flow';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { stepPathForRole } from '@/lib/projects/project-step-path';

/**
 * DR-04: hand a client-owned step to the project lead, or back to the client. The client keeps
 * edit access either way (the change list's proposal), so after "Assign to Lead" both can fill it.
 */
export async function assignStepFill(ctx: AuthContext, engagementId: string, itemId: string, to: 'lead' | 'client') {
  if (!ASSIGNABLE_FILL_STEP_IDS.has(itemId)) throw new Error('step_not_assignable');
  const engagement = await getEngagementById(ctx, engagementDbId(engagementId));
  if (!engagement) throw new Error('Engagement not found or not permitted');

  const state = await patchChecklistItem(ctx, engagementId, itemId, { fillAssignedTo: to });
  const title = getItem(itemId)?.title ?? itemId;
  await recordAuditEvent(ctx, {
    engagementId,
    action: to === 'lead' ? 'checklist.assigned_to_lead' : 'checklist.assigned_to_client',
    summary: `${ctx.name || 'A manager'} assigned ${title} to the ${to === 'lead' ? 'project lead' : 'client'}`,
    metadata: { itemId, to },
  });

  if (to === 'lead') {
    const recipients = await resolveEngagementRecipients(engagement.id);
    const leads = recipients ? (recipients.leads.length ? recipients.leads : recipients.lead ? [recipients.lead] : []) : [];
    const project = { id: engagementId, slug: engagement.slug ?? undefined };
    await createNotificationsForUsers(
      leads
        .filter((lead) => lead.userId && lead.userId !== ctx.userId)
        .map((lead) => ({
          userId: lead.userId,
          kind: 'team.assigned' as const,
          title: `${title}: assigned to you`,
          body: `${ctx.name || 'Your manager'} asked you to fill ${title} for ${engagement.companyName}.`,
          engagementId,
          companyName: engagement.companyName,
          itemId,
          href: stepPathForRole('intern', project, itemId),
          actorId: ctx.userId,
          actorName: ctx.name,
        })),
    ).catch(() => []);
  }
  return checklistStateForViewer(ctx, state);
}
