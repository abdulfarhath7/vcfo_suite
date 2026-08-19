"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getToastVariantStyle } from "@/components/ui/hot-toast";
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
} from "@/lib/notification-dismiss";
import { toast } from "@/lib/toast-errors";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60_000) return "Just now";
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

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

export function NotificationsBell() {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotifications,
    restoreNotifications,
  } = useApp();

  const [filter, setFilter] = useState<NotificationDirection>("received");
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const [exitingRows, setExitingRows] = useState<AppNotification[]>([]);
  const [exitDelayMsById, setExitDelayMsById] = useState<Record<string, number>>({});
  const exitTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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
    dismissWithUndo([item], "Notification deleted");
  };

  const handleClearTab = () => {
    const batch = mergeNotificationsByCreatedAt(
      tabItems,
      exitingRows.filter((n) => notificationDirection(n.kind) === filter),
    );
    dismissWithUndo(
      batch,
      batch.length === 1
        ? "Notification deleted"
        : `Cleared ${batch.length} ${filter} notifications`,
    );
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          "relative flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-9 sm:min-w-9",
          hasUnread && "bg-primary-light text-primary hover:bg-primary-light",
        )}
        aria-label={
          hasUnread
            ? `View notifications, ${unreadNotificationCount} unread`
            : "View notifications"
        }
      >
        <Bell
          className={cn(
            "h-[18px] w-[18px] shrink-0",
            hasUnread && "fill-primary/25",
          )}
          strokeWidth={hasUnread ? 2.25 : 2}
          aria-hidden
        />
        {hasUnread && (
          <span
            className="absolute top-1 right-1 min-w-[15px] h-[15px] px-0.5 flex items-center justify-center rounded-full bg-role text-[9px] font-semibold text-role-foreground leading-none ring-2 ring-panel"
            aria-hidden
          >
            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-1.5rem,26rem)] max-h-[min(70vh,480px)] overflow-x-hidden overflow-y-auto p-1.5"
        onPointerDownOutside={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("[data-notification-undo-toast]")) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          const target = event.target;
          if (target instanceof Element && target.closest("[data-notification-undo-toast]")) {
            event.preventDefault();
          }
        }}
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <DropdownMenuLabel className="p-0 text-[11px] font-semibold tracking-tight">
            Notifications
          </DropdownMenuLabel>
          <div className="flex items-center gap-2">
            {hasUnread && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  markAllNotificationsRead();
                }}
              >
                <CheckCheck className="h-3 w-3" aria-hidden />
                Mark all read
              </button>
            )}
            {tabCount > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                aria-label={`Clear all ${filter} notifications`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClearTab();
                }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <div
          className="mx-1 mb-1 grid grid-cols-2 gap-0.5 rounded-md bg-raised/70 p-0.5"
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFilter(tab.id);
                }}
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

        <DropdownMenuSeparator className="my-1" />
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            {emptyCopy}
          </p>
        ) : (
          filtered.map((n) => {
            const isOutbound =
              n.kind === "email.sent" ||
              n.kind === "email.skipped" ||
              n.kind === "email.failed";
            const statusDot =
              n.kind === "email.sent"
                ? "bg-success"
                : n.kind === "email.skipped"
                  ? "bg-warning"
                  : n.kind === "email.failed"
                    ? "bg-danger"
                    : null;
            const meta = [
              isOutbound ? n.body : null,
              n.companyName || null,
              formatWhen(n.createdAt),
            ]
              .filter(Boolean)
              .join(" · ");
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
                <div
                  className={cn(
                    "flex min-w-0",
                    exiting && "pointer-events-none",
                  )}
                >
                  <DropdownMenuItem
                    asChild
                    className={cn(
                      "min-w-0 flex-1 cursor-pointer rounded-md px-2 py-1.5",
                      !n.read && "bg-raised/50",
                    )}
                  >
                    <Link
                      href={n.href === "#" ? "#" : n.href}
                      onClick={() => markNotificationRead(n.id)}
                      className="flex min-w-0 items-start gap-2"
                    >
                      {statusDot ? (
                        <span
                          className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", statusDot)}
                          aria-hidden
                        />
                      ) : (
                        <span
                          className={cn(
                            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                            n.read ? "bg-border" : "bg-primary",
                          )}
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium leading-snug text-foreground">
                          {n.title}
                        </span>
                        {!isOutbound && n.body ? (
                          <span className="mt-0.5 block truncate text-[10.5px] leading-snug text-muted-foreground">
                            {n.body}
                          </span>
                        ) : null}
                        {meta ? (
                          <span className="mt-0.5 block truncate text-[10px] leading-snug text-text-tertiary">
                            {meta}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                  <button
                    type="button"
                    className="mt-0.5 mr-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    aria-label={`Delete notification: ${n.title}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteOne(n);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
