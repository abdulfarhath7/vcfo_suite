"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  notificationDirection,
  type NotificationDirection,
} from "@/lib/checklist-notifications";
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

export function NotificationsBell() {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();

  const [filter, setFilter] = useState<NotificationDirection>("received");

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

  const filtered = useMemo(
    () =>
      notifications
        .filter((n) => notificationDirection(n.kind) === filter)
        .slice(0, 12),
    [notifications, filter],
  );

  const hasUnread = unreadNotificationCount > 0;
  const emptyCopy =
    filter === "sent"
      ? "No sent notifications yet. When you email a client or project lead, it will show up here."
      : "No received notifications yet. Updates from submissions, reviews, deliveries, and shared docs appear here.";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "relative flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-orange-50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/35 sm:min-h-9 sm:min-w-9",
          hasUnread && "bg-orange-50/70 text-orange-600 hover:bg-orange-50",
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
            hasUnread && "fill-orange-200/40",
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
      <DropdownMenuContent align="end" className="w-80 max-h-[min(70vh,420px)] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-xs font-semibold">Notifications</DropdownMenuLabel>
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
        </div>

        <div
          className="mx-2 mb-1.5 grid grid-cols-2 gap-1 rounded-lg bg-raised/70 p-1"
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
                  "rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors",
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
                    unread > 0 ? "text-orange-600" : "text-text-tertiary",
                  )}
                >
                  {count}
                  {unread > 0 ? ` · ${unread}` : ""}
                </span>
              </button>
            );
          })}
        </div>

        <DropdownMenuSeparator />
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyCopy}</p>
        ) : (
          filtered.map((n) => (
            <DropdownMenuItem key={n.id} asChild className={cn("cursor-pointer", !n.read && "bg-raised/60")}>
              <Link
                href={n.href === "#" ? "#" : n.href}
                onClick={() => markNotificationRead(n.id)}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <span className="text-xs font-medium text-foreground line-clamp-1">{n.title}</span>
                <span className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</span>
                <span className="text-[10px] text-text-tertiary mt-0.5">
                  {[n.companyName, formatWhen(n.createdAt)].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
