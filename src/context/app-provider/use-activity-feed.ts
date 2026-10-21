import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { Engagement, ActivityEvent } from '@/data/engagements';
import type { AuthUser } from '@/lib/auth';
import type { EngagementChecklistState } from '@/lib/projects/engagements-db';
import { toastSuccess } from '@/lib/toast-errors';
import {
  type AppNotification,
  type NotificationKind,
  checklistNotifySuppressKey,
  diffChecklistForNotifications,
} from '@/lib/checklist/checklist-notifications';
import { checklistItemLabel } from '@/lib/audit/audit-log';
import { fetchJson } from './fetch-json';
import type { AppProviderStore } from './state';
import type { NotificationActions } from './use-notifications';

type ActivityFeedParams = {
  user: AuthUser | null;
  queryClient: QueryClient;
} & Pick<AppProviderStore, 'setActivity' | 'setNotifications'> &
  Pick<NotificationActions, 'isNotificationSuppressed'>;

/**
 * The activity feed (optimistic rows reconciled with the server) and the
 * checklist diff that turns other people's changes into toasts, activity rows
 * and notifications.
 */
export function useActivityFeed({
  user,
  queryClient,
  setActivity,
  setNotifications,
  isNotificationSuppressed,
}: ActivityFeedParams) {
  const pushActivity = useCallback((ev: Omit<ActivityEvent, 'id' | 'at'>) => {
    const optimistic: ActivityEvent = {
      id: `a${Date.now()}`,
      at: 'Just now',
      ...ev,
    };
    setActivity((prev) => [optimistic, ...prev]);
    void fetchJson<{ activity: ActivityEvent }>('/api/activity', {
      method: 'POST',
      body: JSON.stringify(ev),
    })
      .then((data) => {
        setActivity((prev) => {
          const withoutOptimistic = prev.filter((a) => a.id !== optimistic.id);
          return [data.activity, ...withoutOptimistic];
        });
        void queryClient.invalidateQueries({ queryKey: ['activity', user?.id] });
      })
      .catch(() => {
        /* keep optimistic row */
      });
  }, [setActivity, queryClient, user?.id]);

  const ingestChecklistNotificationDrafts = useCallback(
    (engagement: Engagement, drafts: ReturnType<typeof diffChecklistForNotifications>) => {
      if (!user || drafts.length === 0) return;

      /** Server fan-out owns persistence for these; client only toasts + refreshes the bell. */
      const serverOwnedKinds: ReadonlySet<NotificationKind> = new Set([
        'checklist.deliver',
        'checklist.submit',
        'checklist.review',
        'checklist.unlock',
        'docs.share',
        'request.created',
        'request.uploaded',
      ]);

      const fresh: AppNotification[] = [];
      let sawServerOwned = false;
      for (const draft of drafts) {
        const suppressKey = checklistNotifySuppressKey(
          draft.engagementId,
          draft.itemId ?? '_',
          draft.kind,
        );
        if (isNotificationSuppressed(suppressKey)) continue;

        toastSuccess(draft.title, draft.body);

        const verb =
          draft.kind === 'checklist.deliver'
            ? 'delivered'
            : draft.kind === 'checklist.submit'
              ? 'submitted'
              : draft.kind === 'checklist.review'
                ? 'reviewed'
                : draft.kind === 'checklist.unlock'
                  ? 'unlocked fields on'
                  : draft.kind === 'request.created'
                    ? 'requested a document for'
                    : draft.kind === 'request.uploaded'
                      ? 'uploaded'
                      : 'shared documents for';
        pushActivity({
          actor: engagement.companyName,
          verb,
          target: draft.itemId ? checklistItemLabel(draft.itemId) : draft.body,
          engagementId: engagement.id,
        });

        if (serverOwnedKinds.has(draft.kind)) {
          sawServerOwned = true;
          continue;
        }

        fresh.push({
          ...draft,
          id: `n${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }

      if (sawServerOwned) {
        void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      }

      if (fresh.length === 0) return;
      setNotifications((prev) => [...fresh, ...prev].slice(0, 80));
      void fetchJson<{ notifications: AppNotification[] }>('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          notifications: fresh.map(({ id: _id, read: _read, createdAt: _c, ...rest }) => rest),
        }),
      })
        .then((data) => {
          setNotifications((prev) => {
            const withoutOptimistic = prev.filter((n) => !fresh.some((f) => f.id === n.id));
            return [...data.notifications, ...withoutOptimistic].slice(0, 80);
          });
          void queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
        })
        .catch(() => {});
    },
    [user, isNotificationSuppressed, pushActivity, setNotifications, queryClient],
  );

  const handleChecklistStateDiff = useCallback(
    (engagement: Engagement, prev: EngagementChecklistState | undefined, next: EngagementChecklistState) => {
      if (!user || prev === undefined) return;
      const drafts = diffChecklistForNotifications(prev, next, {
        engagement,
        viewerRole: user.role,
        viewerUserId: user.id,
      });
      ingestChecklistNotificationDrafts(engagement, drafts);
    },
    [user, ingestChecklistNotificationDrafts],
  );

  return {
    pushActivity,
    handleChecklistStateDiff,
  };
}

export type ActivityFeed = ReturnType<typeof useActivityFeed>;
