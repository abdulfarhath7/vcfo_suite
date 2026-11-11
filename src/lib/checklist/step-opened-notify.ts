import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getItem } from '@/data/checklist';
import { getEngagementById, patchChecklistItem } from '@/db/repositories/engagements';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { ANNOUNCED_ON_OPEN_STEP_IDS, shouldAnnounceStepOpened } from '@/lib/checklist/step-opened';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { stepPathForRole } from '@/lib/projects/project-step-path';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';

/**
 * DR-03: after any step change, tell every client user once that Proposed directors is open and
 * theirs to fill. The leads get the same news with a prompt to send the email: GL-07 sends no
 * automatic client email, so the Lead sends it from the step's "Send email" button.
 * Never throws: a failed notice must not fail the save that caused it.
 */
export async function announceOpenedSteps(ctx: AuthContext, engagementId: string): Promise<void> {
  try {
    const engagement = await getEngagementById(ctx, engagementDbId(engagementId));
    if (!engagement) return;
    const state = (engagement.checklistState ?? {}) as Record<string, ChecklistItemStateSlice | undefined>;
    for (const itemId of ANNOUNCED_ON_OPEN_STEP_IDS) {
      if (!shouldAnnounceStepOpened(itemId, state)) continue;
      // Stamp first: two saves at once then race on the stamp, not on the notice.
      await patchChecklistItem(ctx, engagementId, itemId, { openedNotifiedAt: new Date().toISOString() });

      const recipients = await resolveEngagementRecipients(engagement.id);
      if (!recipients) continue;
      const title = getItem(itemId)?.title ?? itemId;
      const project = { id: recipients.appId, slug: recipients.slug };
      const company = recipients.companyName;
      const clients = recipients.clients.length ? recipients.clients : recipients.client ? [recipients.client] : [];
      const leads = recipients.leads.length ? recipients.leads : recipients.lead ? [recipients.lead] : [];
      const seen = new Set<string>();
      const once = (userId: string | undefined) => !!userId && !seen.has(userId) && (seen.add(userId), true);
      const clientHref = stepPathForRole('client', project, itemId);
      const leadHref = stepPathForRole('intern', project, itemId);
      await createNotificationsForUsers([
        ...clients.filter((c) => once(c.userId)).map((c) => ({
          userId: c.userId,
          kind: 'checklist.unlock' as const,
          title: `${title} is open`,
          body: `Please fill the details of each proposed director for ${company}. Open the step to start.`,
          engagementId: recipients.appId,
          companyName: company,
          itemId,
          href: clientHref,
        })),
        ...leads.filter((l) => once(l.userId)).map((l) => ({
          userId: l.userId,
          kind: 'checklist.unlock' as const,
          title: `${title} is open for the client`,
          body: `The client was told to fill ${title} for ${company}. Send them the email from the step if they need a reminder.`,
          engagementId: recipients.appId,
          companyName: company,
          itemId,
          href: leadHref,
        })),
      ]);
      await recordAuditEvent(ctx, {
        engagementId,
        action: 'checklist.step_opened_notified',
        summary: `The client was told that ${title} is open`,
        metadata: { itemId },
      });
    }
  } catch (err) {
    console.error('[notify] step-opened notice failed', err);
  }
}
