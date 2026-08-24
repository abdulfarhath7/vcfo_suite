"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { m, useReducedMotion } from "framer-motion";
import { Bell, CheckCheck, History } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getToastVariantStyle } from "@/components/ui/hot-toast";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import {
  notificationDirection,
  notificationsInDirection,
  type AppNotification,
  type NotificationDirection,
} from "@/lib/checklist-notifications";
import {
  NOTIFICATION_ROW_EXIT_MS,
  NOTIFICATION_ROW_EXIT_STAGGER_MS,
  NOTIFICATION_UNDO_TOAST_MS,
  mergeNotificationsByCreatedAt,
  notificationsMatchingClearScope,
  type NotificationClearScope,
} from "@/lib/notification-dismiss";
import { roleNotificationsPath } from "@/lib/auth-routes";
import {
  NOTIFICATION_GENIE_LAND_EVENT,
  requestNotificationPopup,
} from "@/lib/notification-popup";
import { toast } from "@/lib/toast-errors";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ id: NotificationDirection; label: string }> = [
  { id: "received", label: "Received" },
  { id: "sent", label: "Sent" },
];

const UNDO_TOAST_ID = "notification-undo";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function offerUndoToast(message: string, onUndo: () => void) {
  toast.custom(
    (t) => (
      <div
        data-notification-undo-toast=""
        role="status"
        className="flex items-center gap-3"
        style={{
          ...getToastVariantStyle("default"),
          padding: "8px 12px",
          maxWidth: "280px",
        }}
      >
        <span className="min-w-0 text-[12px] leading-snug text-foreground">{message}</span>
        <button
          type="button"
          className="shrink-0 rounded px-1.5 py-0.5 text-[12px] font-semibold text-primary hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => {
            onUndo();
            toast.dismiss(t.id);
          }}
        >
          Undo
        </button>
      </div>
    ),
    {
      id: UNDO_TOAST_ID,
      duration: NOTIFICATION_UNDO_TOAST_MS,
      position: "top-right",
    },
  );
}

function clearCopy(scope: NotificationClearScope, count: number, filter: NotificationDirection): string {
  if (count === 1) return "Notification cleared";
  if (scope === "today") return `Cleared ${count} from today`;
  if (scope === "week") return `Cleared ${count} from this week`;
  return `Cleared ${count} ${filter} notifications`;
}

export function NotificationsBell() {
  const {
    user,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotifications,
    restoreNotifications,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationDirection>("received");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const [exitingRows, setExitingRows] = useState<AppNotification[]>([]);
  const [exitDelayMsById, setExitDelayMsById] = useState<Record<string, number>>({});
  const [catching, setCatching] = useState(false);
  const exitTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const osReduce = useReducedMotion();

  useEffect(() => {
    const land = () => {
      setCatching(true);
      window.setTimeout(() => setCatching(false), 480);
    };
    window.addEventListener(NOTIFICATION_GENIE_LAND_EVENT, land);
    return () => window.removeEventListener(NOTIFICATION_GENIE_LAND_EVENT, land);
  }, []);

  const historyHref = user ? roleNotificationsPath(user.role) : "/";

  const counts = useMemo(() => {
    let received = 0;
    let sent = 0;
    let receivedUnread = 0;
    let sentUnread = 0;
    for (const n of notifications) {
      if (notificationDirection(n.kind) === "sent") {
        sent += 1;
        if (!n.read) sentUnread += 1;
      } else {
        received += 1;
        if (!n.read) receivedUnread += 1;
      }
    }
    return { received, sent, receivedUnread, sentUnread };
  }, [notifications]);

  const tabItems = useMemo(
    () => notificationsInDirection(notifications, filter),
    [notifications, filter],
  );

  const filtered = useMemo(() => {
    const ghosts = exitingRows.filter((n) => notificationDirection(n.kind) === filter);
    return mergeNotificationsByCreatedAt(tabItems, ghosts).slice(0, 16);
  }, [tabItems, exitingRows, filter]);

  const tabCount = filter === "sent" ? counts.sent : counts.received;
  const hasUnread = unreadNotificationCount > 0;
  const emptyCopy =
    filter === "sent"
      ? "No outbound email activity yet."
      : "No received notifications yet.";

  const now = useMemo(() => new Date(), [notifications, filter, open]);
  const todayCount = notificationsMatchingClearScope(tabItems, "today", now).length;
  const weekCount = notificationsMatchingClearScope(tabItems, "week", now).length;

  const finishExit = (items: AppNotification[]) => {
    const ids = new Set(items.map((n) => n.id));
    for (const id of ids) {
      const timer = exitTimersRef.current.get(id);
      if (timer !== undefined) clearTimeout(timer);
      exitTimersRef.current.delete(id);
    }
    setExitingIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setExitingRows((prev) => prev.filter((n) => !ids.has(n.id)));
    setExitDelayMsById((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        delete next[id];
      });
      return next;
    });
  };

  const scheduleFinishExit = (items: AppNotification[], staggerMs: number) => {
    const reduced = prefersReducedMotion();
    items.forEach((item, index) => {
      const prev = exitTimersRef.current.get(item.id);
      if (prev !== undefined) clearTimeout(prev);
      const delay = reduced ? 0 : NOTIFICATION_ROW_EXIT_MS + index * staggerMs;
      const timer = setTimeout(() => {
        exitTimersRef.current.delete(item.id);
        setExitingIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
        setExitingRows((rows) => rows.filter((n) => n.id !== item.id));
        setExitDelayMsById((current) => {
          if (!(item.id in current)) return current;
          const next = { ...current };
          delete next[item.id];
          return next;
        });
      }, delay);
      exitTimersRef.current.set(item.id, timer);
    });
  };

  const cancelExit = (items: AppNotification[]) => {
    finishExit(items);
    restoreNotifications(items);
  };

  const dismissWithUndo = (items: AppNotification[], message: string) => {
    if (items.length === 0) return;
    const reduced = prefersReducedMotion();
    const staggerMs = reduced || items.length === 1 ? 0 : NOTIFICATION_ROW_EXIT_STAGGER_MS;

    if (reduced) {
      dismissNotifications(items);
      offerUndoToast(message, () => restoreNotifications(items));
      return;
    }

    setExitingIds((prev) => {
      const next = new Set(prev);
      items.forEach((n) => next.add(n.id));
      return next;
    });
    setExitingRows((prev) => mergeNotificationsByCreatedAt(prev, items));
    setExitDelayMsById((prev) => {
      const next = { ...prev };
      items.forEach((n, index) => {
        next[n.id] = index * staggerMs;
      });
      return next;
    });
    dismissNotifications(items);
    offerUndoToast(message, () => cancelExit(items));
    scheduleFinishExit(items, staggerMs);
  };

  const handleDeleteOne = (item: AppNotification) => {
    dismissWithUndo([item], "Notification cleared");
  };

  const handleClearScope = (scope: NotificationClearScope) => {
    const batch = notificationsMatchingClearScope(
      mergeNotificationsByCreatedAt(
        tabItems,
        exitingRows.filter((n) => notificationDirection(n.kind) === filter),
      ),
      scope,
      new Date(),
    );
    dismissWithUndo(batch, clearCopy(scope, batch.length, filter));
  };

  const guardOutside = (event: { target: EventTarget | null; preventDefault: () => void }) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-notification-undo-toast]")) {
      event.preventDefault();
    }
  };

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelectedId(null);
      }}
    >
      <PopoverTrigger
        data-notifications-bell=""
        className={cn(
          "relative flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-9 sm:min-w-9",
          hasUnread && "bg-primary-light text-primary hover:bg-primary-light",
          catching && "bg-primary-light text-primary",
        )}
        aria-label={
          hasUnread
            ? `View notifications, ${unreadNotificationCount} unread`
            : "View notifications"
        }
      >
        {catching ? (
          <span className="pointer-events-none absolute inset-1 rounded-lg bg-primary/20" aria-hidden />
        ) : null}
        <m.span
          data-notifications-bell-target=""
          className="relative inline-flex"
          animate={catching && !osReduce ? { scale: [1, 1.38, 0.94, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <Bell
            className={cn(
              "h-[18px] w-[18px] shrink-0",
              hasUnread && "fill-primary/25",
            )}
            strokeWidth={hasUnread ? 2.25 : 2}
            aria-hidden
          />
        </m.span>
        {hasUnread && (
          <span
            className="absolute top-1 right-1 min-w-[15px] h-[15px] px-0.5 flex items-center justify-center rounded-full bg-role text-[9px] font-semibold text-role-foreground leading-none ring-2 ring-panel"
            aria-hidden
          >
            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="flex w-[min(100vw-1.5rem,26rem)] max-h-[min(74vh,520px)] flex-col overflow-hidden rounded-[var(--radius-md)] border border-border bg-panel p-0 text-foreground shadow-[0_12px_40px_-18px_oklch(22%_0.04_260_/_0.38)]"
        onPointerDownOutside={guardOutside}
        onInteractOutside={guardOutside}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1.5">
          <p className="p-0 text-[13px] font-bold leading-tight tracking-tight text-ink">
            Notifications
          </p>
          {hasUnread && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              onClick={() => markAllNotificationsRead()}
            >
              <CheckCheck className="h-3 w-3" aria-hidden />
              Mark all read
            </button>
          )}
        </div>

        <div
          className="mx-2 mb-1 grid grid-cols-2 gap-0.5 rounded-md bg-raised/70 p-0.5"
          role="tablist"
          aria-label="Filter notifications"
        >
          {FILTERS.map((tab) => {
            const active = filter === tab.id;
            const count = tab.id === "sent" ? counts.sent : counts.received;
            const unread =
              tab.id === "sent" ? counts.sentUnread : counts.receivedUnread;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "rounded px-2 py-1 text-[10.5px] font-medium transition-colors",
                  active
                    ? "bg-panel text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
                <span
                  className={cn(
                    "ml-1 tabular-nums",
                    unread > 0 ? "text-primary" : "text-text-tertiary",
                  )}
                >
                  {count}
                  {unread > 0 ? ` · ${unread}` : ""}
                </span>
              </button>
            );
          })}
        </div>

        {tabCount > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 pb-2 text-[10px]">
            {todayCount > 0 && (
              <button
                type="button"
                className="font-medium text-muted-foreground hover:text-primary"
                onClick={() => handleClearScope("today")}
              >
                Clear today
              </button>
            )}
            {weekCount > 0 && (
              <button
                type="button"
                className="font-medium text-muted-foreground hover:text-primary"
                onClick={() => handleClearScope("week")}
              >
                Clear this week
              </button>
            )}
            <button
              type="button"
              className="font-medium text-muted-foreground hover:text-primary"
              aria-label={`Clear all ${filter} notifications`}
              onClick={() => handleClearScope("all")}
            >
              Clear all
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto border-t border-border px-1 py-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-[11px] text-muted-foreground">
              {emptyCopy}
            </p>
          ) : (
            filtered.map((n) => {
              const exiting = exitingIds.has(n.id);
              const exitDelayMs = exiting ? (exitDelayMsById[n.id] ?? 0) : 0;

              return (
                <div
                  key={n.id}
                  className={cn(
                    "transition-[transform,opacity] ease motion-reduce:transition-none",
                    exiting
                      ? "translate-x-full opacity-0"
                      : "translate-x-0 opacity-100",
                  )}
                  style={{
                    transitionDuration: `${NOTIFICATION_ROW_EXIT_MS}ms`,
                    transitionDelay: `${exitDelayMs}ms`,
                  }}
                >
                  <NotificationItem
                    item={n}
                    expanded={selectedId === n.id}
                    exiting={exiting}
                    showOpenLink
                    onOpen={() => {
                      markNotificationRead(n.id);
                      if (notificationDirection(n.kind) === "received") {
                        requestNotificationPopup(n);
                        setOpen(false);
                        return;
                      }
                      setSelectedId((current) => (current === n.id ? null : n.id));
                    }}
                    onDismiss={() => handleDeleteOne(n)}
                  />
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border px-3 py-2">
          <Link
            href={historyHref}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-primary-dark"
            onClick={() => setOpen(false)}
          >
            <History className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Notification history
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
