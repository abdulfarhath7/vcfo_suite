'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { m, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { NotificationKindTile } from '@/components/notifications/notification-kind';
import { NOTIFICATION_KIND_LOOK } from '@/components/notifications/notification-kind-look';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { roleNotificationsPath } from '@/lib/auth-routes';
import { useShellAppearance } from '@/hooks/use-shell-appearance';
import { measureGenieDock, type GenieBox } from '@/lib/notifications/genie-dock';
import {
  formatNotificationWhen,
  notificationHrefIsNavigable,
} from '@/lib/notifications/notification-dismiss';
import {
  NOTIFICATION_BELL_SELECTOR,
  NOTIFICATION_BELL_TARGET_SELECTOR,
  NOTIFICATION_GENIE_LAND_EVENT,
  NOTIFICATION_KIND_LABEL,
  NOTIFICATION_SHOW_EVENT,
  addNotificationPopupIds,
  readNotificationPopupIds,
  selectNotificationPopups,
  type NotificationShowDetail,
} from '@/lib/notifications/notification-popup';
import type { AppNotification } from '@/lib/checklist/checklist-notifications';
import { cn } from '@/lib/utils';

const sessionPopupQueue = new Map<string, AppNotification[]>();
const sessionManualIds = new Set<string>();

function mergeSessionQueue(userId: string, incoming: AppNotification[]): AppNotification[] {
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

function enqueueManualShow(userId: string, item: AppNotification): AppNotification[] {
  sessionManualIds.add(item.id);
  const rest = (sessionPopupQueue.get(userId) ?? []).filter((row) => row.id !== item.id);
  const next = [item, ...rest];
  sessionPopupQueue.set(userId, next);
  return next;
}

function shiftSessionQueue(userId: string): AppNotification[] {
  const prev = sessionPopupQueue.get(userId) ?? [];
  const gone = prev[0];
  if (gone) sessionManualIds.delete(gone.id);
  const next = prev.slice(1);
  sessionPopupQueue.set(userId, next);
  return next;
}

/**
 * "Skip all": drop everything behind the card on screen. The front item stays so
 * it can still play its park animation; the normal shift after landing empties the queue.
 * Skipped ids were already recorded as popped when they were queued, so a later poll
 * does not bring them back.
 */
function keepOnlyFront(userId: string): AppNotification[] {
  const prev = sessionPopupQueue.get(userId) ?? [];
  for (const row of prev.slice(1)) sessionManualIds.delete(row.id);
  const next = prev.slice(0, 1);
  sessionPopupQueue.set(userId, next);
  return next;
}

function readBellBox(): GenieBox {
  const el =
    document.querySelector<HTMLElement>(NOTIFICATION_BELL_TARGET_SELECTOR) ??
    document.querySelector<HTMLElement>(NOTIFICATION_BELL_SELECTOR);
  const to = el?.getBoundingClientRect();
  if (to) return { left: to.left, top: to.top, width: to.width, height: to.height };
  return { left: window.innerWidth - 48, top: 10, width: 28, height: 28 };
}

function NotificationGenieCard({
  item,
  replay,
  remaining,
  reduceMotion,
  onParked,
  onSkipAll,
}: {
  item: AppNotification;
  replay: boolean;
  /** Cards still waiting behind this one. */
  remaining: number;
  reduceMotion: boolean;
  onParked: () => void;
  onSkipAll: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [flying, setFlying] = useState(false);
  const message = item.body.trim() || item.title;
  const extraTitle = Boolean(item.title && item.body && item.title !== item.body);
  const canOpen = notificationHrefIsNavigable(item.href);
  const { user } = useApp();
  /* The popup stays the first stop; only this button goes to the full Notifications page. */
  const pageHref = user && user.role !== 'developer' ? roleNotificationsPath(user.role) : null;

  const finish = useCallback(() => {
    window.dispatchEvent(new Event(NOTIFICATION_GENIE_LAND_EVENT));
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
    card.style.backgroundColor = 'oklch(var(--brand))';
    card.style.borderColor = 'oklch(var(--brand))';
    const animation = card.animate(
      [
        {
          left: `${origin.left}px`,
          top: `${origin.top}px`,
          width: `${origin.width}px`,
          height: `${origin.height}px`,
          borderRadius: '6px',
          opacity: 1,
          offset: 0,
        },
        {
          left: `${origin.left + (to.left - origin.left) * 0.32}px`,
          top: `${origin.top + (to.top - origin.top) * 0.2}px`,
          width: `${origin.width * 0.38}px`,
          height: `${origin.height * 0.58}px`,
          borderRadius: '12px',
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

  const skipAll = useCallback(() => {
    if (started.current) return;
    onSkipAll();
    park();
  }, [onSkipAll, park]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (event.shiftKey && remaining > 0) skipAll();
      else park();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [park, remaining, skipAll]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] grid place-items-center p-4">
      <m.button
        type="button"
        aria-label="Dismiss notification"
        className="pointer-events-auto absolute inset-0 cursor-default bg-ink/45"
        initial={{ opacity: reduceMotion ? 1 : 0 }}
        animate={{ opacity: flying ? 0 : 1 }}
        transition={{ duration: reduceMotion ? 0 : flying ? 0.4 : 0.28 }}
        onClick={park}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-live-title"
        className={cn(
          'pointer-events-auto relative w-[min(100vw-2rem,30rem)] overflow-hidden rounded-md border-1.5 border-line bg-surface-raised shadow-dialog',
          !reduceMotion && !flying && 'notification-live-enter',
        )}
      >
        <div className={cn('relative', flying && 'pointer-events-none opacity-0 transition-opacity duration-150')}>
          <div className="flex items-start justify-between gap-3 border-b border-line-soft px-5 pb-3 pt-4">
            <div className="flex min-w-0 items-center gap-3">
              <NotificationKindTile kind={item.kind} size={36} />
              <div className="min-w-0">
                <p id="notification-live-title" className="text-[12.5px] font-medium text-ink-muted">
                  {replay ? 'Notification' : 'New notification'}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Chip fixed tone={NOTIFICATION_KIND_LOOK[item.kind]?.tone}>
                    {NOTIFICATION_KIND_LABEL[item.kind]}
                  </Chip>
                  <time dateTime={item.createdAt} className="text-[12.5px] tabular-nums text-ink-muted">
                    {formatNotificationWhen(item.createdAt)}
                  </time>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              aria-label="Close"
              onClick={park}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 pb-4 pt-4">
            {extraTitle ? <p className="mb-1.5 text-[13px] font-medium text-ink-2">{item.title}</p> : null}
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{message}</p>
            {item.companyName ? (
              <p className="mt-4 border-t border-line-soft pt-3 text-[13px] text-ink-muted">{item.companyName}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3">
            {remaining > 0 ? (
              <>
                <span className="text-[12.5px] text-ink-muted">{remaining} more waiting</span>
                <Button type="button" variant="quiet" size="sm" title="Skip all (Shift+Esc)" onClick={skipAll}>
                  Skip all
                </Button>
              </>
            ) : null}
            <span className="mr-auto" />
            {pageHref ? (
              <Button asChild variant="quiet">
                <Link href={pageHref}>Open page</Link>
              </Button>
            ) : null}
            {canOpen ? (
              <Button asChild variant="outline">
                <Link href={item.href}>Open</Link>
              </Button>
            ) : null}
            <Button type="button" onClick={park}>
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationLivePopup() {
  const { user } = useApp();
  const list = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('notifications_failed');
      const data = (await res.json()) as { notifications?: AppNotification[] };
      return data.notifications ?? [];
    },
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    notifyOnChangeProps: ['data', 'error'],
  });
  const osReduce = useReducedMotion();
  const { reduceMotion: prefReduce } = useShellAppearance();
  const reduceMotion = Boolean(osReduce) || prefReduce;
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const [gap, setGap] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showNonce, setShowNonce] = useState(0);
  const items = list.data;
  const itemKey = items?.map((item) => item.id).join('|') ?? '';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user?.id || !items) return;
    const poppedIds = readNotificationPopupIds(user.id);
    const { queue: incoming, seedIds } = selectNotificationPopups({ items, poppedIds });
    if (poppedIds === null || seedIds.length > 0) {
      addNotificationPopupIds(user.id, seedIds);
    }
    setQueue((prev) => {
      const next = mergeSessionQueue(user.id, incoming);
      if (prev.length === next.length && prev.every((row, i) => row.id === next[i]?.id)) {
        return prev;
      }
      return next;
    });
  }, [user?.id, itemKey, items]);

  useEffect(() => {
    if (!user?.id) return;
    const onShow = (event: Event) => {
      const item = (event as CustomEvent<NotificationShowDetail>).detail?.notification;
      if (!item) return;
      setGap(false);
      setQueue(enqueueManualShow(user.id, item));
      setShowNonce((n) => n + 1);
    };
    window.addEventListener(NOTIFICATION_SHOW_EVENT, onShow);
    return () => window.removeEventListener(NOTIFICATION_SHOW_EVENT, onShow);
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

  const userId = user?.id;
  const onSkipAll = useCallback(() => {
    if (!userId) return;
    setQueue(keepOnlyFront(userId));
  }, [userId]);

  const current = !gap ? queue[0] : undefined;
  if (!mounted || typeof document === 'undefined' || !current) return null;

  return createPortal(
    <NotificationGenieCard
      key={`${current.id}-${showNonce}`}
      item={current}
      replay={sessionManualIds.has(current.id)}
      remaining={Math.max(0, queue.length - 1)}
      reduceMotion={reduceMotion}
      onParked={onParked}
      onSkipAll={onSkipAll}
    />,
    document.body,
  );
}
