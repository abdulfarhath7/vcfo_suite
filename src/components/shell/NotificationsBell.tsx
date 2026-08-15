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
        .slice(0, 16),
    [notifications, filter],
  );

  const hasUnread = unreadNotificationCount > 0;
  const emptyCopy =
    filter === "sent"
      ? "No outbound email activity yet."
      : "No received notifications yet.";

  return (
    <DropdownMenu>
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
        className="w-[min(100vw-1.5rem,26rem)] max-h-[min(70vh,480px)] overflow-y-auto p-1.5"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <DropdownMenuLabel className="p-0 text-[11px] font-semibold tracking-tight">
            Notifications
          </DropdownMenuLabel>
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

            return (
              <DropdownMenuItem
                key={n.id}
                asChild
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1.5",
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
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
