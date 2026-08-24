"use client";

import Link from "next/link";
import { ArrowUpRight, Trash2 } from "lucide-react";
import type { AppNotification } from "@/lib/checklist-notifications";
import {
  formatNotificationWhen,
  notificationHrefIsNavigable,
} from "@/lib/notification-dismiss";
import { cn } from "@/lib/utils";

function statusDotClass(kind: AppNotification["kind"]): string | null {
  if (kind === "email.sent") return "bg-success";
  if (kind === "email.skipped") return "bg-warning";
  if (kind === "email.failed") return "bg-danger";
  return null;
}

export function notificationMetaLine(item: AppNotification, now?: Date): string {
  const isOutbound =
    item.kind === "email.sent" ||
    item.kind === "email.skipped" ||
    item.kind === "email.failed";
  return [
    isOutbound ? item.body : null,
    item.companyName || null,
    formatNotificationWhen(item.createdAt, now),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function NotificationItem({
  item,
  expanded,
  onOpen,
  onDismiss,
  showOpenLink,
  exiting,
}: {
  item: AppNotification;
  expanded?: boolean;
  onOpen: () => void;
  onDismiss?: () => void;
  showOpenLink?: boolean;
  exiting?: boolean;
}) {
  const isOutbound =
    item.kind === "email.sent" ||
    item.kind === "email.skipped" ||
    item.kind === "email.failed";
  const dot = statusDotClass(item.kind);
  const meta = notificationMetaLine(item);
  const canOpen = showOpenLink && notificationHrefIsNavigable(item.href);
  const dismissed = Boolean(item.dismissedAt);

  return (
    <div
      className={cn("unread-edge flex min-w-0", exiting && "pointer-events-none")}
      data-unread={item.read ? "false" : "true"}
    >
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full min-w-0 items-start gap-2 rounded-none px-2 py-1.5 text-left hover:bg-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {dot ? (
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="block min-w-0 truncate text-[12px] font-medium leading-snug text-foreground">
                {item.title}
              </span>
              {dismissed ? (
                <span className="shrink-0 text-[10px] font-medium text-text-tertiary">Cleared</span>
              ) : null}
            </span>
            {!isOutbound && item.body ? (
              <span
                className={cn(
                  "mt-0.5 block text-[10.5px] leading-snug text-muted-foreground",
                  expanded ? "whitespace-pre-wrap break-words" : "truncate",
                )}
              >
                {item.body}
              </span>
            ) : null}
            {isOutbound && expanded && item.body ? (
              <span className="mt-0.5 block whitespace-pre-wrap break-words text-[10.5px] leading-snug text-muted-foreground">
                {item.body}
              </span>
            ) : null}
            {meta ? (
              <span className="mt-0.5 block truncate text-[10px] leading-snug text-text-tertiary">
                {meta}
              </span>
            ) : null}
          </span>
        </button>
        {expanded && canOpen ? (
          <Link
            href={item.href}
            className="mb-1.5 ml-2 inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:text-primary-dark"
          >
            Open
            <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          </Link>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="mt-0.5 mr-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-primary-light hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label={`Clear from inbox: ${item.title}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
