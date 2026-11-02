'use client';

/**
 * CONTRACT (used by the console top bar — keep the signature):
 *   useConsoleUpdates() → { unread, annUnread, openNotes(anchor), openAnns(anchor) }
 *   unread    = unread notifications in the bell inbox (live: AppContext unreadNotificationCount)
 *   annUnread = announcements not yet read by this person in this browser (live megaphone)
 *   openNotes / openAnns open the Notifications / Announcements pop-over anchored at the clicked
 *   button (prototype #mx-bell / #mx-annb; pages/updates/pops.tsx).
 *
 * It also publishes the nav badges (useUpdatesBadges: notes, anns, regulatory) and puts the
 * latest announcements in the Ctrl K palette, so every seat gets them from the top bar alone.
 * The live cards (new notification / announcement pop-ups) are mounted by ConsoleAsk.
 */
import { useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { requestAnnouncementPopup } from '@/lib/notifications/announcements';
import { useAnnouncements } from '@/hooks/use-announcements';
import { useConsole, useConsoleBadge, useConsolePalette, type PaletteItem } from './runtime';
import { AnnsPop, NotesPop } from './pages/updates/pops';
import { useAnnouncementReads, useRegulatoryPending } from './pages/updates/data';
import { annStripe, dLabel, istDay, istToday } from './pages/updates/model';
import './css/96-updates.css';

export interface ConsoleUpdates {
  unread: number;
  annUnread: number;
  openNotes: (anchor?: Element | null) => void;
  openAnns: (anchor?: Element | null) => void;
}

/** The counts behind the bell, the megaphone and the Updates badges (same queries as the pop-overs). */
function useUpdatesCounts() {
  const { user, unreadNotificationCount } = useApp();
  const anns = useAnnouncements();
  const { readIds } = useAnnouncementReads(user?.id);
  const pending = useRegulatoryPending(user?.role);
  const items = anns.data?.announcements;
  const annUnread = useMemo(() => (items ?? []).filter((a) => !readIds.has(a.id)).length, [items, readIds]);
  return { notes: unreadNotificationCount, anns: annUnread, regulatory: pending.data ?? 0, items };
}

/** Publishes the sidebar badges: notes (unread notifications), anns (unread announcements), regulatory (waiting for review). */
export function useUpdatesBadges() {
  const c = useUpdatesCounts();
  useConsoleBadge('notes', c.notes, 'hot');
  useConsoleBadge('anns', c.anns, '');
  useConsoleBadge('regulatory', c.regulatory, 'hot');
  return c;
}

export function useConsoleUpdates(): ConsoleUpdates {
  const { openPop, go, base } = useConsole();
  const c = useUpdatesBadges();

  const palette = useMemo<PaletteItem[]>(() => {
    const today = istToday(Date.now());
    return (c.items ?? []).slice(0, 30).map((a) => ({
      id: `ann:${a.id}`,
      label: a.title,
      kind: `Announcement · ${dLabel(istDay(a.publishedAt) ?? today, today)}`,
      sw: annStripe(a.kind),
      go: () => {
        go(`${base}/announcements`);
        requestAnnouncementPopup(a);
      },
    }));
  }, [c.items, go, base]);
  useConsolePalette('updates-announcements', palette);

  const openNotes = useCallback((anchor?: Element | null) => openPop(anchor ?? null, <NotesPop />, { cls: 'mx-wide', kind: 'notes' }), [openPop]);
  const openAnns = useCallback((anchor?: Element | null) => openPop(anchor ?? null, <AnnsPop />, { cls: 'mx-wide', kind: 'anns' }), [openPop]);
  return { unread: c.notes, annUnread: c.anns, openNotes, openAnns };
}
