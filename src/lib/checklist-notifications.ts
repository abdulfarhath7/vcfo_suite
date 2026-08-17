import { getItem } from '@/data/checklist';
import type { Role } from '@/lib/auth';
import type { EngagementChecklistState } from '@/lib/engagements-db';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import {
  adminProjectStepPath,
  internEngagementStepPath,
} from '@/lib/project-step-path';
import type { Engagement } from '@/data/engagements';

export type NotificationKind =
  | 'checklist.deliver'
  | 'checklist.submit'
  | 'checklist.review'
  | 'checklist.unlock'
  | 'docs.share'
  | 'request.created'
  | 'request.uploaded'
  | 'team.assigned'
  | 'team.removed'
  | 'email.sent'
  | 'email.skipped'
  | 'email.failed';

/** Outbound email confirmations vs inbound process updates. */
export type NotificationDirection = 'sent' | 'received';

export function notificationDirection(kind: NotificationKind): NotificationDirection {
  if (kind === 'email.sent' || kind === 'email.skipped' || kind === 'email.failed') {
    return 'sent';
  }
  return 'received';
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  engagementId: string;
  companyName: string;
  itemId?: string;
  href: string;
  createdAt: string;
  read: boolean;
}

export type NotificationDraft = Omit<AppNotification, 'id' | 'read' | 'createdAt'>;

function itemTitle(itemId: string): string {
  return getItem(itemId)?.title ?? itemId;
}

function notificationHref(
  role: Role,
  engagement: Pick<Engagement, 'id' | 'slug'>,
  itemId: string,
  kind: NotificationKind,
): string {
  if (role === 'client') {
    if (kind === 'docs.share') return '/app/client/incorporation';
    return '/app/client/incorporation';
  }
  if (role === 'intern') {
    if (kind === 'request.uploaded' || kind === 'request.created') {
      return '/app/intern/requests';
    }
    return internEngagementStepPath(engagement, itemId);
  }
  return adminProjectStepPath(engagement, itemId, role);
}

function sharedDocsGrew(
  prev?: ChecklistItemStateSlice,
  next?: ChecklistItemStateSlice,
): boolean {
  const prevLen = prev?.sharedIncorpDraftDocs?.length ?? 0;
  const nextLen = next?.sharedIncorpDraftDocs?.length ?? 0;
  return nextLen > prevLen;
}

export function diffChecklistForNotifications(
  prev: EngagementChecklistState | undefined,
  next: EngagementChecklistState,
  ctx: {
    engagement: Pick<Engagement, 'id' | 'slug' | 'companyName'>;
    viewerRole: Role;
    viewerUserId: string;
  },
): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  const itemIds = new Set([
    ...Object.keys(prev ?? {}),
    ...Object.keys(next),
  ]);

  for (const itemId of itemIds) {
    const prevItem = prev?.[itemId];
    const nextItem = next[itemId];
    if (!nextItem) continue;

    const engagementId = ctx.engagement.id;
    const companyName = ctx.engagement.companyName;
    const title = itemTitle(itemId);
    const href = notificationHref(ctx.viewerRole, ctx.engagement, itemId, 'checklist.deliver');

    if (
      ctx.viewerRole === 'client' &&
      !prevItem?.deliveredToClientAt?.trim() &&
      nextItem.deliveredToClientAt?.trim()
    ) {
      out.push({
        kind: 'checklist.deliver',
        title: 'New from your VCFO team',
        body: `${title} is ready on your portal.`,
        engagementId,
        companyName,
        itemId,
        href,
      });
    }

    if (ctx.viewerRole === 'client') {
      const bulkShared =
        !prevItem?.incorpDraftsSharedAt?.trim() && Boolean(nextItem.incorpDraftsSharedAt?.trim());
      const partialShare = sharedDocsGrew(prevItem, nextItem) && !bulkShared;
      if (bulkShared || partialShare) {
        out.push({
          kind: 'docs.share',
          title: bulkShared ? 'Incorporation drafts shared' : 'New draft available',
          body: bulkShared
            ? 'All draft incorporation forms are on your portal for download and upload.'
            : `A new incorporation draft for ${title} is available to download.`,
          engagementId,
          companyName,
          itemId,
          href: '/app/client/incorporation',
        });
      }
    }

    if (
      (ctx.viewerRole === 'admin' ||
        ctx.viewerRole === 'manager' ||
        ctx.viewerRole === 'intern') &&
      !prevItem?.clientSubmittedAt?.trim() &&
      nextItem.clientSubmittedAt?.trim()
    ) {
      const leadRequest = nextItem.reviewSource === 'lead_manager_request';
      out.push({
        kind: 'checklist.submit',
        title: leadRequest ? 'Manager approval requested' : 'Client submission',
        body: leadRequest
          ? `${companyName}: ${title} is waiting for your approval.`
          : `${companyName} submitted ${title} for review.`,
        engagementId,
        companyName,
        itemId,
        href: notificationHref(ctx.viewerRole, ctx.engagement, itemId, 'checklist.submit'),
      });
    }

    if (
      ctx.viewerRole === 'client' &&
      prevItem?.reviewStatus !== nextItem.reviewStatus &&
      (nextItem.reviewStatus === 'accepted' || nextItem.reviewStatus === 'rejected') &&
      nextItem.reviewedBy !== ctx.viewerUserId
    ) {
      const accepted = nextItem.reviewStatus === 'accepted';
      out.push({
        kind: 'checklist.review',
        title: accepted ? 'Submission accepted' : 'Corrections requested',
        body: accepted
          ? `${title} was approved by your engagement team.`
          : nextItem.rejectionNote?.trim()
            ? `${title}: ${nextItem.rejectionNote.trim()}`
            : `${title} needs updates — check the milestone for details.`,
        engagementId,
        companyName,
        itemId,
        href: '/app/client/incorporation',
      });
    }
  }

  return out;
}

/** Stable key for suppressing duplicate realtime toasts after a local mutation. */
export function checklistNotifySuppressKey(
  engagementId: string,
  itemId: string,
  kind: NotificationKind,
): string {
  return `${engagementId}:${itemId}:${kind}`;
}
