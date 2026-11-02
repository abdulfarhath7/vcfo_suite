import 'server-only';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';

/**
 * Bell notifications for date change requests (G-17): the engagement's managers hear about
 * a new request, and the lead who asked hears the decision. Best effort: a failure is logged
 * and never fails the request itself.
 */

export async function notifyWindowRequested(input: {
  engagementId: string;
  requesterName: string;
  toDate: string;
}): Promise<void> {
  try {
    const recipients = await resolveEngagementRecipients(input.engagementId);
    if (!recipients || recipients.managers.length === 0) return;
    await createNotificationsForUsers(
      recipients.managers.map((manager) => ({
        userId: manager.userId,
        kind: 'schedule.window' as const,
        title: `Date change requested by ${input.requesterName}`,
        body: `New end date ${input.toDate}`,
        engagementId: recipients.appId,
        companyName: recipients.companyName,
        href: '/app/manager/approvals',
      })),
    );
  } catch (err) {
    console.error('[work] window request bell failed', err);
  }
}

export async function notifyWindowDecided(input: {
  engagementId: string;
  requesterId: string;
  approved: boolean;
  note: string | null;
}): Promise<void> {
  try {
    const recipients = await resolveEngagementRecipients(input.engagementId);
    if (!recipients) return;
    await createNotificationsForUsers([
      {
        userId: input.requesterId,
        kind: 'schedule.window' as const,
        title: input.approved ? 'Date change approved' : 'Date change not approved',
        body: input.note ?? '',
        engagementId: recipients.appId,
        companyName: recipients.companyName,
        href: '/app/intern/tasks?view=plan',
      },
    ]);
  } catch (err) {
    console.error('[work] window decision bell failed', err);
  }
}
