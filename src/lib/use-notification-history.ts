"use client";

import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { AppNotification } from '@/lib/checklist-notifications';

export function notificationHistoryQueryKey(userId: string) {
  return ['notifications', userId, 'history'] as const;
}

export function useNotificationHistory() {
  const { user } = useApp();
  return useQuery({
    queryKey: notificationHistoryQueryKey(user?.id ?? ''),
    queryFn: async () => {
      const res = await fetch('/api/notifications?history=1');
      if (!res.ok) {
        throw new Error('Could not load notification history');
      }
      const data = (await res.json()) as { notifications: AppNotification[] };
      return data.notifications;
    },
    enabled: Boolean(user?.id),
    staleTime: 15_000,
  });
}
