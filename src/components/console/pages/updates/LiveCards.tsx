'use client';

/**
 * Live cards — the console form of the old shell's NotificationLivePopup and
 * AnnouncementLivePopup (mounted once, from ConsoleAsk, on every page):
 *
 *  - a new received notification, or a new announcement by someone else,
 *    pops up once as a card, one at a time ("N more waiting", Skip all,
 *    Shift+Esc), and closes into its top-bar button (the "genie"), which
 *    pulses; reduced motion skips the flight;
 *  - a click on a row in the bell, the megaphone or the boards reopens it
 *    (requestNotificationPopup / requestAnnouncementPopup events);
 *  - the same selection rules and the same "already shown" storage as live
 *    (vcfo.notifications.popup.{userId}, vcfo.announcements.popup.{userId}),
 *    so nothing replays when a person moves between the old and new views.
 * A card never marks anything read (live). Its button opens the item's page
 * inside this seat.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { useAnnouncements } from '@/hooks/use-announcements';
import { measureGenieDock, type GenieBox } from '@/lib/notifications/genie-dock';
import type { AppNotification } from '@/lib/checklist/checklist-notifications';
import {
  NOTIFICATION_GENIE_LAND_EVENT,
  NOTIFICATION_KIND_LABEL,
  NOTIFICATION_SHOW_EVENT,
  addNotificationPopupIds,
  readNotificationPopupIds,
  selectNotificationPopups,
  type NotificationShowDetail,
} from '@/lib/notifications/notification-popup';
import {
  ANNOUNCEMENT_GENIE_LAND_EVENT,
  ANNOUNCEMENT_SHOW_EVENT,
  addAnnouncementPopupIds,
  announcementYmdIst,
  readAnnouncementIds,
  readAnnouncementPopupIds,
  readDailyAnnouncementSeenIds,
  selectAnnouncementPopups,
  type Announcement,
  type AnnouncementShowDetail,
} from '@/lib/notifications/announcements';
import { useConsole } from '../../runtime';
import { Btn, GoArrow, Icon } from '../../ui';
import { AnnKind, annFrom } from './bits';
import { consoleHref, isExternalHref, noteMeta, openLabel, whenLabel } from './model';

/* ---------------------------------------------------------------- session queues (survive page changes) */

function makeQueue<T extends { id: string }>() {
  const q = new Map<string, T[]>();
  const manual = new Set<string>();
  return {
    manual,
    merge(user: string, incoming: T[]): T[] {
      const prev = q.get(user) ?? [];
      const seen = new Set(prev.map((x) => x.id));
      const next = [...prev];
      for (const x of incoming) {
        if (seen.has(x.id)) continue;
        seen.add(x.id);
        next.push(x);
      }
      q.set(user, next);
      return next;
    },
    show(user: string, item: T): T[] {
      manual.add(item.id);
      const next = [item, ...(q.get(user) ?? []).filter((x) => x.id !== item.id)];
      q.set(user, next);
      return next;
    },
    shift(user: string, id: string): T[] | null {
      const prev = q.get(user) ?? [];
      if (prev[0]?.id !== id) return null;
      manual.delete(id);
      const next = prev.slice(1);
      q.set(user, next);
      return next;
    },
    keepFront(user: string): T[] {
      const prev = q.get(user) ?? [];
      prev.slice(1).forEach((x) => manual.delete(x.id));
      const next = prev.slice(0, 1);
      q.set(user, next);
      return next;
    },
  };
}
const NOTES = makeQueue<AppNotification>();
const ANNS = makeQueue<Announcement>();

const same = <T extends { id: string }>(a: T[], b: T[]) => a.length === b.length && a.every((x, i) => x.id === b[i]?.id);

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** The top-bar button a card closes into (Frame renders it with this label). */
function dockButton(kind: 'note' | 'ann'): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.mx-top .ib[aria-label="${kind === 'note' ? 'Notifications' : 'Announcements'}"]`);
}

/* ---------------------------------------------------------------- one card */

type Live = { kind: 'note'; item: AppNotification } | { kind: 'ann'; item: Announcement };

function LiveCard({ live, replay, remaining, onParked, onSkipAll }: { live: Live; replay: boolean; remaining: number; onParked: () => void; onSkipAll: () => void }) {
  const { go, base } = useConsole();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const started = useRef(false);
  const [shown, setShown] = useState(false);
  const [flying, setFlying] = useState(false);
  const note = live.kind === 'note';

  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(r);
  }, []);

  const finish = useCallback(() => {
    window.dispatchEvent(new Event(note ? NOTIFICATION_GENIE_LAND_EVENT : ANNOUNCEMENT_GENIE_LAND_EVENT));
    const dock = dockButton(live.kind);
    if (dock) {
      dock.classList.add('upd-catch');
      window.setTimeout(() => dock.classList.remove('upd-catch'), 560);
    }
    onParked();
  }, [note, live.kind, onParked]);

  const park = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const card = ref.current;
    if (reducedMotion() || !card || typeof card.animate !== 'function') {
      finish();
      return;
    }
    const r = card.getBoundingClientRect();
    const d = dockButton(live.kind)?.getBoundingClientRect();
    const dock: GenieBox = d ? { left: d.left, top: d.top, width: d.width, height: d.height } : { left: window.innerWidth - 120, top: 14, width: 40, height: 40 };
    const { from, to } = measureGenieDock({ left: r.left, top: r.top, width: r.width, height: r.height }, dock);
    setFlying(true);
    Object.assign(card.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, margin: '0', transform: 'none' });
    const anim = card.animate(
      [
        { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: '20px', opacity: 1, offset: 0 },
        { left: `${from.left + (to.left - from.left) * 0.32}px`, top: `${from.top + (to.top - from.top) * 0.2}px`, width: `${from.width * 0.38}px`, height: `${from.height * 0.58}px`, borderRadius: '22px', opacity: 1, offset: 0.4 },
        { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: `${to.width / 2}px`, opacity: 0, offset: 1 },
      ],
      { duration: 720, easing: 'cubic-bezier(0.42, 0, 0.88, 0.08)', fill: 'forwards' },
    );
    anim.onfinish = () => finish();
  }, [finish, live.kind]);

  const skipAll = useCallback(() => {
    if (started.current) return;
    onSkipAll();
    park();
  }, [onSkipAll, park]);

  // Esc closes the card first (before the console's own Esc handling); Shift+Esc skips the queue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.shiftKey && remaining > 0) skipAll();
      else park();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [park, remaining, skipAll]);

  const item = live.item;
  const message = item.body.trim() || item.title;
  const extraTitle = Boolean(item.title && item.body.trim() && item.title !== item.body.trim());
  const href = note ? consoleHref(live.item.href, base) : null;
  const noun = note ? 'notification' : 'announcement';

  return (
    <div className={'upd-live' + (shown && !flying ? ' show' : '')} role="presentation">
      <button type="button" className="upd-lscrim" tabIndex={-1} aria-label={`Dismiss ${noun}`} onClick={park} />
      <div ref={ref} className={'upd-lcard' + (flying ? ' fly' : '')} role="dialog" aria-modal="true" aria-labelledby="upd-live-t">
        <div className="upd-lin">
          <div className="upd-lh">
            <span className="mx-ni" title={note ? noteMeta(live.item.kind).what : 'Announcement'}>
              <Icon name={note ? noteMeta(live.item.kind).icon : 'mega'} />
            </span>
            <div className="mx-dt">
              <span className="eyebrow" id="upd-live-t">
                {replay ? (note ? 'Notification' : 'Announcement') : note ? 'New notification' : 'New announcement'}
              </span>
              <span className="mx-chips">
                {live.kind === 'note' ? <span className="pill mut">{NOTIFICATION_KIND_LABEL[live.item.kind] ?? 'Update'}</span> : <AnnKind kind={live.item.kind} />}
              </span>
            </div>
            <button ref={closeRef} type="button" className="ib x" aria-label="Close" onClick={park}>
              <Icon name="x" />
            </button>
          </div>
          <div className="upd-lb">
            {extraTitle ? <span className="small">{item.title}</span> : null}
            <p className="upd-lmsg">{message}</p>
            <span className="small">
              {live.kind === 'note'
                ? [live.item.companyName, whenLabel(live.item.createdAt, Date.now())].filter(Boolean).join(' · ')
                : `${annFrom(live.item)} · ${whenLabel(live.item.publishedAt, Date.now())}`}
            </span>
          </div>
          <div className="upd-lf">
            {href ? (
              <Btn
                cls="pri sm"
                ico="ne"
                onClick={() => {
                  if (isExternalHref(href)) window.open(href, '_blank', 'noopener,noreferrer');
                  else go(href);
                  park();
                }}
              >
                {openLabel(href)}
              </Btn>
            ) : null}
            {live.kind === 'ann' && live.item.sourceUrl ? (
              <a className="btn sm" href={live.item.sourceUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="ext" />
                Open source
              </a>
            ) : null}
            {live.kind === 'ann' ? (
              <>
                <span className="sp" />
                <GoArrow
                  label="All announcements"
                  onClick={() => {
                    go(`${base}/announcements`);
                    park();
                  }}
                />
              </>
            ) : null}
          </div>
          {remaining > 0 ? (
            <div className="upd-lq">
              <span className="small">{`${remaining} more ${noun}${remaining === 1 ? '' : 's'} waiting`}</span>
              <button type="button" className="link" title="Skip all (Shift+Esc)" onClick={skipAll}>
                Skip all
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- host */

export function UpdatesLive() {
  const { user } = useApp();
  const uid = user?.id;
  // The inbox query AppContext also reads (same key and shape); undefined until it has loaded.
  const notes = useQuery({
    queryKey: ['notifications', uid],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('notifications_failed');
      return ((await res.json()) as { notifications?: AppNotification[] }).notifications ?? [];
    },
    enabled: Boolean(uid),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    notifyOnChangeProps: ['data', 'error'],
  });
  const anns = useAnnouncements();
  const [noteQ, setNoteQ] = useState<AppNotification[]>([]);
  const [annQ, setAnnQ] = useState<Announcement[]>([]);
  const [prefer, setPrefer] = useState<'note' | 'ann'>('note');
  const [gap, setGap] = useState(false);
  const [nonce, setNonce] = useState(0);
  const noteItems = notes.data;
  const annItems = anns.data?.announcements;

  useEffect(() => {
    if (!uid || !noteItems) return;
    const popped = readNotificationPopupIds(uid);
    const { queue, seedIds } = selectNotificationPopups({ items: noteItems, poppedIds: popped });
    if (popped === null || seedIds.length > 0) addNotificationPopupIds(uid, seedIds);
    const next = NOTES.merge(uid, queue);
    setNoteQ((prev) => (same(prev, next) ? prev : next));
  }, [uid, noteItems]);

  useEffect(() => {
    if (!uid || !annItems) return;
    const popped = readAnnouncementPopupIds(uid);
    const { queue, seedIds } = selectAnnouncementPopups({
      items: annItems,
      viewerId: uid,
      poppedIds: popped,
      readIds: readAnnouncementIds(uid),
      dailySeenIds: new Set(readDailyAnnouncementSeenIds(uid, announcementYmdIst())),
    });
    if (popped === null || seedIds.length > 0) addAnnouncementPopupIds(uid, seedIds);
    const next = ANNS.merge(uid, queue);
    setAnnQ((prev) => (same(prev, next) ? prev : next));
  }, [uid, annItems]);

  useEffect(() => {
    if (!uid) return;
    const onNote = (e: Event) => {
      const item = (e as CustomEvent<NotificationShowDetail>).detail?.notification;
      if (!item) return;
      setGap(false);
      setPrefer('note');
      setNoteQ(NOTES.show(uid, item));
      setNonce((n) => n + 1);
    };
    const onAnn = (e: Event) => {
      const item = (e as CustomEvent<AnnouncementShowDetail>).detail?.announcement;
      if (!item) return;
      setGap(false);
      setPrefer('ann');
      setAnnQ(ANNS.show(uid, item));
      setNonce((n) => n + 1);
    };
    window.addEventListener(NOTIFICATION_SHOW_EVENT, onNote);
    window.addEventListener(ANNOUNCEMENT_SHOW_EVENT, onAnn);
    return () => {
      window.removeEventListener(NOTIFICATION_SHOW_EVENT, onNote);
      window.removeEventListener(ANNOUNCEMENT_SHOW_EVENT, onAnn);
    };
  }, [uid]);

  let live: Live | null = null;
  if (!gap) {
    if (prefer === 'ann' && annQ[0]) live = { kind: 'ann', item: annQ[0] };
    else if (noteQ[0]) live = { kind: 'note', item: noteQ[0] };
    else if (annQ[0]) live = { kind: 'ann', item: annQ[0] };
  }

  const onParked = useCallback(() => {
    if (!uid || !live) return;
    const { kind, item } = live;
    setGap(true);
    window.setTimeout(
      () => {
        if (kind === 'note') {
          const next = NOTES.shift(uid, item.id);
          if (next) setNoteQ(next);
        } else {
          const next = ANNS.shift(uid, item.id);
          if (next) setAnnQ(next);
          setPrefer('note');
        }
        setGap(false);
      },
      reducedMotion() ? 60 : 120,
    );
  }, [uid, live]);

  const onSkipAll = useCallback(() => {
    if (!uid || !live) return;
    if (live.kind === 'note') setNoteQ(NOTES.keepFront(uid));
    else setAnnQ(ANNS.keepFront(uid));
  }, [uid, live]);

  if (!live) return null;
  const queue = live.kind === 'note' ? noteQ : annQ;
  return (
    <LiveCard
      key={`${live.kind}-${live.item.id}-${nonce}`}
      live={live}
      replay={(live.kind === 'note' ? NOTES : ANNS).manual.has(live.item.id)}
      remaining={Math.max(0, queue.length - 1)}
      onParked={onParked}
      onSkipAll={onSkipAll}
    />
  );
}
