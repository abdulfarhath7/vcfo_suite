'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { m, useReducedMotion } from 'framer-motion';
import { Megaphone, X } from 'lucide-react';
import { AnnouncementKindChip, formatAnnouncementWhen } from '@/components/announcements/AnnouncementList';
import { useApp } from '@/context/AppContext';
import { useAnnouncements } from '@/lib/use-announcements';
import { useShellAppearance } from '@/lib/use-shell-appearance';
import {
  ANNOUNCEMENT_BELL_SELECTOR,
  ANNOUNCEMENT_BELL_TARGET_SELECTOR,
  ANNOUNCEMENT_GENIE_LAND_EVENT,
  ANNOUNCEMENT_SHOW_EVENT,
  addAnnouncementPopupIds,
  announcementAttribution,
  announcementYmdIst,
  measureGenieDock,
  readAnnouncementIds,
  readAnnouncementPopupIds,
  readDailyAnnouncementSeenIds,
  selectAnnouncementPopups,
  type Announcement,
  type AnnouncementShowDetail,
  type GenieBox,
} from '@/lib/announcements';
import { cn } from '@/lib/utils';

const sessionPopupQueue = new Map<string, Announcement[]>();
const sessionManualIds = new Set<string>();

function mergeSessionQueue(userId: string, incoming: Announcement[]): Announcement[] {
  const prev = sessionPopupQueue.get(userId) ?? [];
  const seen = new Set(prev.map((item) => item.id));
  const next = [...prev];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  sessionPopupQueue.set(userId, next);
  return next;
}

function enqueueManualShow(userId: string, item: Announcement): Announcement[] {
  sessionManualIds.add(item.id);
  const rest = (sessionPopupQueue.get(userId) ?? []).filter((row) => row.id !== item.id);
  const next = [item, ...rest];
  sessionPopupQueue.set(userId, next);
  return next;
}

function shiftSessionQueue(userId: string): Announcement[] {
  const prev = sessionPopupQueue.get(userId) ?? [];
  const gone = prev[0];
  if (gone) sessionManualIds.delete(gone.id);
  const next = prev.slice(1);
  sessionPopupQueue.set(userId, next);
  return next;
}

function readBellBox(): GenieBox {
  const el =
    document.querySelector<HTMLElement>(ANNOUNCEMENT_BELL_TARGET_SELECTOR) ??
    document.querySelector<HTMLElement>(ANNOUNCEMENT_BELL_SELECTOR);
  const to = el?.getBoundingClientRect();
  if (to) return { left: to.left, top: to.top, width: to.width, height: to.height };
  return { left: window.innerWidth - 88, top: 10, width: 28, height: 28 };
}

function AnnouncementGenieCard({
  item,
  replay,
  reduceMotion,
  onParked,
}: {
  item: Announcement;
  replay: boolean;
  reduceMotion: boolean;
  onParked: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [flying, setFlying] = useState(false);
  const message = item.body.trim() || item.title;
  const extraTitle = Boolean(item.title && item.body && item.title !== item.body);

  const finish = useCallback(() => {
    window.dispatchEvent(new Event(ANNOUNCEMENT_GENIE_LAND_EVENT));
    onParked();
  }, [onParked]);

  const park = useCallback(() => {
    if (started.current) return;
    started.current = true;
    if (reduceMotion) {
      finish();
      return;
    }
    const card = cardRef.current;
    if (!card) {
      finish();
      return;
    }
    const from = card.getBoundingClientRect();
    const { from: origin, to } = measureGenieDock(
      { left: from.left, top: from.top, width: from.width, height: from.height },
      readBellBox(),
    );
    setFlying(true);
    card.style.position = 'fixed';
    card.style.left = `${origin.left}px`;
    card.style.top = `${origin.top}px`;
    card.style.width = `${origin.width}px`;
    card.style.height = `${origin.height}px`;
    card.style.margin = '0';
    card.style.zIndex = '101';
    card.style.transform = 'none';
    card.style.overflow = 'hidden';
    card.style.backgroundColor = 'oklch(var(--primary))';
    card.style.borderColor = 'oklch(var(--primary))';
    const animation = card.animate(
      [
        {
          left: `${origin.left}px`,
          top: `${origin.top}px`,
          width: `${origin.width}px`,
          height: `${origin.height}px`,
          borderRadius: '18px',
          opacity: 1,
          offset: 0,
        },
        {
          left: `${origin.left + (to.left - origin.left) * 0.32}px`,
          top: `${origin.top + (to.top - origin.top) * 0.2}px`,
          width: `${origin.width * 0.38}px`,
          height: `${origin.height * 0.58}px`,
          borderRadius: '22px',
          opacity: 1,
          offset: 0.4,
        },
        {
          left: `${to.left}px`,
          top: `${to.top}px`,
          width: `${to.width}px`,
          height: `${to.height}px`,
          borderRadius: `${to.width / 2}px`,
          opacity: 0,
          offset: 1,
        },
      ],
      { duration: 720, easing: 'cubic-bezier(0.42, 0, 0.88, 0.08)', fill: 'forwards' },
    );
    animation.onfinish = () => finish();
  }, [finish, reduceMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        park();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [park]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] grid place-items-center p-4">
      <m.button
        type="button"
        aria-label="Dismiss announcement"
        className="pointer-events-auto absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[6px]"
        initial={{ opacity: reduceMotion ? 1 : 0 }}
        animate={{ opacity: flying ? 0 : 1 }}
        transition={{ duration: reduceMotion ? 0 : flying ? 0.4 : 0.28 }}
        onClick={park}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-live-title"
        className={cn(
          'pointer-events-auto relative w-[min(100vw-2rem,26.5rem)] overflow-hidden rounded-[1.15rem] border border-border/80 bg-background shadow-[0_32px_80px_-28px_oklch(18%_0.06_260_/_0.55)]',
          !reduceMotion && !flying && 'announcement-live-enter',
        )}
      >
        <div className={cn('relative', flying && 'pointer-events-none opacity-0 transition-opacity duration-150')}>
          <div className="h-[3px] w-full bg-primary" />
          <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-light text-primary">
                <Megaphone className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p id="announcement-live-title" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {replay ? 'Announcement' : 'New announcement'}
                </p>
                <div className="mt-1.5">
                  <AnnouncementKindChip kind={item.kind} />
                </div>
              </div>
            </div>
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-raised hover:text-ink"
              aria-label="Close"
              onClick={park}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 pb-6 pt-1">
            {extraTitle ? (
              <p className="mb-2 text-[12px] font-medium text-muted-foreground">{item.title}</p>
            ) : null}
            <p className="text-[17px] font-semibold leading-relaxed tracking-tight text-ink">{message}</p>
            <p className="mt-4 text-[13px] leading-snug text-muted-foreground">
              {announcementAttribution(item)}
              <span className="mx-1.5 text-border">·</span>
              <time dateTime={item.publishedAt}>{formatAnnouncementWhen(item.publishedAt)}</time>
            </p>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-block text-[12px] font-medium text-primary hover:underline"
              >
                Open source
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AnnouncementLivePopup() {
  const { user } = useApp();
  const list = useAnnouncements();
  const osReduce = useReducedMotion();
  const { reduceMotion: prefReduce } = useShellAppearance();
  const reduceMotion = Boolean(osReduce) || prefReduce;
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [gap, setGap] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showNonce, setShowNonce] = useState(0);
  const items = list.data?.announcements ?? [];
  const itemKey = items.map((item) => item.id).join('|');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user?.id || !list.isSuccess) return;
    const poppedIds = readAnnouncementPopupIds(user.id);
    const readIds = readAnnouncementIds(user.id);
    const dailySeenIds = new Set(readDailyAnnouncementSeenIds(user.id, announcementYmdIst()));
    const { queue: incoming, seedIds } = selectAnnouncementPopups({
      items,
      viewerId: user.id,
      poppedIds,
      readIds,
      dailySeenIds,
    });
    addAnnouncementPopupIds(user.id, seedIds);
    setQueue(mergeSessionQueue(user.id, incoming));
  }, [user?.id, list.isSuccess, itemKey, items]);

  useEffect(() => {
    if (!user?.id) return;
    const onShow = (event: Event) => {
      const item = (event as CustomEvent<AnnouncementShowDetail>).detail?.announcement;
      if (!item) return;
      setGap(false);
      setQueue(enqueueManualShow(user.id, item));
      setShowNonce((n) => n + 1);
    };
    window.addEventListener(ANNOUNCEMENT_SHOW_EVENT, onShow);
    return () => window.removeEventListener(ANNOUNCEMENT_SHOW_EVENT, onShow);
  }, [user?.id]);

  const onParked = useCallback(() => {
    if (!user?.id) return;
    const parkedId = sessionPopupQueue.get(user.id)?.[0]?.id;
    setGap(true);
    window.setTimeout(
      () => {
        const front = sessionPopupQueue.get(user.id)?.[0];
        if (front && parkedId && front.id === parkedId) {
          setQueue(shiftSessionQueue(user.id));
        }
        setGap(false);
      },
      reduceMotion ? 60 : 120,
    );
  }, [reduceMotion, user?.id]);

  const current = !gap ? queue[0] : undefined;
  if (!mounted || typeof document === 'undefined' || !current) return null;

  return createPortal(
    <AnnouncementGenieCard
      key={`${current.id}-${showNonce}`}
      item={current}
      replay={sessionManualIds.has(current.id)}
      reduceMotion={reduceMotion}
      onParked={onParked}
    />,
    document.body,
  );
}

/** @deprecated Live popup replaced the once-per-IST-day dialog. */
export const DailyAnnouncementsDialog = AnnouncementLivePopup;
