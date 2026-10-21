import { useCallback, useMemo, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@/lib/auth';
import {
  type AppNotification,
  type NotificationKind,
  checklistNotifySuppressKey,
} from '@/lib/checklist/checklist-notifications';
import {
  isPersistedNotificationId,
  mergeNotificationsByCreatedAt,
} from '@/lib/notifications/notification-dismiss';
import { fetchJson } from './fetch-json';
import type { AppProviderStore } from './state';

interface NotificationActionsParams {
  user: AuthUser | null;
  queryClient: QueryClient;
  notifications: AppNotification[];
  setNotifications: AppProviderStore['setNotifications'];
}

/**
 * The notification bell: unread count, mark read, dismiss and restore (optimistic,
 * reconciled by the server), and short-lived suppression of checklist toasts the
 * viewer caused themselves.
 */
export function useNotificationActions({
  user,
  queryClient,
  notifications,
  setNotifications,
}: NotificationActionsParams) {
  const notifySuppressRef = useRef<Map<string, number> | null>(null);
  if (!notifySuppressRef.current) {
    notifySuppressRef.current = new Map();
  }

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const isNotificationSuppressed = useCallback((key: string) => {
    const map = notifySuppressRef.current;
    if (!map) return false;
    const until = map.get(key);
    if (!until) return false;
    if (Date.now() > until) {
      notifySuppressRef.current.delete(key);
      return false;
    }
    return true;
  }, []);

  const suppressChecklistNotification = useCallback(
    (engagementId: string, itemId: string, kind: NotificationKind) => {
      const map = notifySuppressRef.current;
      if (!map) return;
      map.set(
        checklistNotifySuppressKey(engagementId, itemId, kind),
        Date.now() + 4000,
      );
    },
    [],
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    if (user?.id) {
      queryClient.setQueryData(
        ['notifications', user.id, 'history'],
        (old: AppNotification[] | undefined) =>
          old?.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    }
    void fetchJson('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_read', id }),
    }).catch(() => {
      /* optimistic UI; refetch will reconcile */
    });
  }, [queryClient, setNotifications, user?.id]);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void fetchJson('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'mark_all_read' }),
    }).catch(() => {});
  }, [setNotifications]);

  const dismissedIdsRef = useRef(new Set<string>());
  const deleteInflightRef = useRef(new Map<string, Promise<void>>());

  const patchNotificationsCache = useCallback(
    (updater: (prev: AppNotification[]) => AppNotification[]) => {
      if (!user?.id) return;
      queryClient.setQueryData(['notifications', user.id], (old: AppNotification[] | undefined) =>
        updater(old ?? []),
      );
    },
    [queryClient, user?.id],
  );

  const dismissNotifications = useCallback(
    (items: AppNotification[]) => {
      if (items.length === 0) return;
      const idSet = new Set(items.map((n) => n.id));
      for (const id of idSet) dismissedIdsRef.current.add(id);
      setNotifications((prev) => prev.filter((n) => !idSet.has(n.id)));
      patchNotificationsCache((prev) => prev.filter((n) => !idSet.has(n.id)));

      const persistedIds = items.map((n) => n.id).filter(isPersistedNotificationId);
      const request =
        persistedIds.length === 0
          ? Promise.resolve()
          : fetchJson('/api/notifications', {
              method: 'POST',
              body: JSON.stringify({ action: 'dismiss', ids: persistedIds }),
            }).then(() => {
              if (user?.id) {
                void queryClient.invalidateQueries({
                  queryKey: ['notifications', user.id, 'history'],
                });
              }
            });

      const tracked = request.catch(() => {
        for (const id of idSet) dismissedIdsRef.current.delete(id);
        setNotifications((prev) => mergeNotificationsByCreatedAt(prev, items));
        patchNotificationsCache((prev) => mergeNotificationsByCreatedAt(prev, items));
      });
      for (const id of idSet) {
        deleteInflightRef.current.set(
          id,
          tracked.then(() => {
            deleteInflightRef.current.delete(id);
          }),
        );
      }
    },
    [patchNotificationsCache, queryClient, setNotifications, user?.id],
  );

  const restoreNotifications = useCallback(
    (items: AppNotification[]) => {
      if (items.length === 0) return;
      const idSet = new Set(items.map((n) => n.id));
      for (const id of idSet) dismissedIdsRef.current.delete(id);
      const restored = items.map((n) => ({ ...n, dismissedAt: null }));
      setNotifications((prev) => mergeNotificationsByCreatedAt(prev, restored));
      patchNotificationsCache((prev) => mergeNotificationsByCreatedAt(prev, restored));

      const persisted = items.filter((n) => isPersistedNotificationId(n.id));
      if (persisted.length === 0) return;

      void (async () => {
        await Promise.all(
          persisted.map((n) => deleteInflightRef.current.get(n.id) ?? Promise.resolve()),
        );
        try {
          await fetchJson('/api/notifications', {
            method: 'POST',
            body: JSON.stringify({
              action: 'restore',
              ids: persisted.map((n) => n.id),
            }),
          });
          if (user?.id) {
            void queryClient.invalidateQueries({
              queryKey: ['notifications', user.id, 'history'],
            });
          }
        } catch {
          /* optimistic UI; refetch will reconcile */
        }
      })();
    },
    [patchNotificationsCache, queryClient, setNotifications, user?.id],
  );

  return {
    unreadNotificationCount,
    isNotificationSuppressed,
    suppressChecklistNotification,
    markNotificationRead,
    markAllNotificationsRead,
    dismissedIdsRef,
    deleteInflightRef,
    dismissNotifications,
    restoreNotifications,
  };
}

export type NotificationActions = ReturnType<typeof useNotificationActions>;
