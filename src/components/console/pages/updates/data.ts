'use client';

/**
 * Updates — the data the bell, the megaphone and the three pages share.
 * Every read is the live tool's own query (same keys, same shapes), so the
 * counts agree with the old views and with each other:
 *   notifications   useApp() (inbox, 4 s head poll) + ['notifications', id, 'history']
 *   announcements   useAnnouncements() (4 s head poll) + the reader's own read
 *                   marks in this browser (live: vcfo.announcements.read.{userId})
 *   regulatory      ['regulatory-updates', tab] and ['regulatory-updates', 'pending-count']
 */
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { ANNOUNCEMENT_READ_EVENT, readAnnouncementIds, writeAnnouncementReadIds } from '@/lib/notifications/announcements';
import { isPersistedNotificationId } from '@/lib/notifications/notification-dismiss';
import { canSeeRegulatory, needsPolling, type RegUpdate, type ReviewStatus } from './model';

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(body?.error || fallback);
  return body as T;
}

/* ---------------------------------------------------------------- announcements read in this browser */

export function useAnnouncementReads(userId: string | undefined) {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!userId) {
      setReadIds(new Set());
      return;
    }
    const sync = () => setReadIds(readAnnouncementIds(userId));
    sync();
    window.addEventListener(ANNOUNCEMENT_READ_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ANNOUNCEMENT_READ_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [userId]);
  const markRead = useCallback(
    (ids: string[]) => {
      if (!userId || ids.length === 0) return;
      const next = readAnnouncementIds(userId);
      ids.forEach((id) => next.add(id));
      writeAnnouncementReadIds(userId, next);
    },
    [userId],
  );
  return { readIds, markRead };
}

/* ---------------------------------------------------------------- notifications back to unread */

/** Mark unread (reader) and Undo of Mark all read; the inbox and history refetch after. */
export function useMarkUnread() {
  const { user } = useApp();
  const qc = useQueryClient();
  return useCallback(
    async (ids: string[]) => {
      const persisted = ids.filter(isPersistedNotificationId);
      if (!persisted.length) return;
      await readJson(
        await fetch('/api/notifications/unread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: persisted.slice(0, 80) }),
        }),
        'Could not mark them unread',
      );
      await qc.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
    [qc, user?.id],
  );
}

/* ---------------------------------------------------------------- regulatory review queue */

export function useRegulatoryPending(role: string | undefined) {
  return useQuery({
    queryKey: ['regulatory-updates', 'pending-count'],
    queryFn: async () =>
      readJson<{ updates: unknown[] }>(await fetch('/api/regulatory-updates?status=pending'), 'Could not load the review queue').then((r) => r.updates.length),
    enabled: canSeeRegulatory(role),
    staleTime: 60_000,
  });
}

export function useRegulatoryList(tab: ReviewStatus, role: string | undefined) {
  return useQuery({
    queryKey: ['regulatory-updates', tab],
    queryFn: async () => readJson<{ canDecide: boolean; updates: RegUpdate[] }>(await fetch(`/api/regulatory-updates?status=${tab}`), 'Could not load the updates'),
    enabled: canSeeRegulatory(role),
    refetchInterval: (q) => (needsPolling(q.state.data?.updates) ? 5000 : false),
  });
}

/* ---------------------------------------------------------------- the person's own channels */

export interface OwnChannels {
  email: string;
  phoneE164: string;
  whatsappOptIn: boolean;
}

export function useOwnChannels() {
  return useQuery({
    queryKey: ['updates', 'own-channels'],
    queryFn: async (): Promise<OwnChannels> => {
      const body = await readJson<{ profile: { email: string; phoneE164?: string | null; whatsappOptIn?: boolean } }>(
        await fetch('/api/account/profile'),
        'Could not load your profile',
      );
      return { email: body.profile.email, phoneE164: body.profile.phoneE164 ?? '', whatsappOptIn: Boolean(body.profile.whatsappOptIn) };
    },
    staleTime: 5 * 60_000,
  });
}
