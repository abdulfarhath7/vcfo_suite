"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, ExternalLink, Megaphone, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncements } from "@/lib/use-announcements";
import {
  ANNOUNCEMENT_READ_EVENT,
  announcementAttribution,
  canWriteAnnouncements,
  readAnnouncementIds,
  roleAnnouncementsPath,
  writeAnnouncementReadIds,
  type AnnouncementKind,
} from "@/lib/announcements";
import { AnnouncementKindChip, AnnouncementKindPicker } from "@/components/announcements/AnnouncementList";
import { toastError, toastSuccess } from "@/lib/toast-errors";
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

export function AnnouncementsBell() {
  const { user } = useApp();
  const queryClient = useQueryClient();
  const list = useAnnouncements();
  const canWrite = canWriteAnnouncements(user?.role);
  const [readTick, setReadTick] = useState(0);
  const [composing, setComposing] = useState(false);
  const [kind, setKind] = useState<AnnouncementKind>("general");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const sync = () => setReadTick((n) => n + 1);
    window.addEventListener(ANNOUNCEMENT_READ_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ANNOUNCEMENT_READ_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const items = list.data?.announcements ?? [];
  const readIds = useMemo(
    () => (user?.id ? readAnnouncementIds(user.id) : new Set<string>()),
    [user?.id, items, readTick],
  );
  const unread = items.filter((item) => !readIds.has(item.id)).length;
  const boardHref = user ? roleAnnouncementsPath(user.role) : "/";

  const markAllRead = () => {
    if (!user?.id) return;
    writeAnnouncementReadIds(user.id, items.map((item) => item.id));
    setReadTick((n) => n + 1);
  };

  const markOne = (id: string) => {
    if (!user?.id) return;
    const next = new Set(readIds);
    next.add(id);
    writeAnnouncementReadIds(user.id, next);
    setReadTick((n) => n + 1);
  };

  const post = async () => {
    setPosting(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          body: message,
          sourceUrl: link.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string; announcement?: { id: string } };
      if (!res.ok) throw new Error(data.error ?? "create_failed");
      if (user?.id && data.announcement?.id) {
        const next = new Set(readAnnouncementIds(user.id));
        next.add(data.announcement.id);
        writeAnnouncementReadIds(user.id, next);
      }
      setMessage("");
      setLink("");
      setKind("general");
      setComposing(false);
      toastSuccess("Announcement posted");
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
    } catch (err) {
      toastError("Could not post", err instanceof Error ? err.message : "Try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          "relative flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-9 sm:min-w-9",
          unread > 0 && "bg-primary-light text-primary hover:bg-primary-light",
        )}
        aria-label={unread > 0 ? `Announcements, ${unread} unread` : "Announcements"}
      >
        <Megaphone
          className={cn("h-[18px] w-[18px] shrink-0", unread > 0 && "fill-primary/20")}
          strokeWidth={unread > 0 ? 2.25 : 2}
          aria-hidden
        />
        {unread > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[15px] h-[15px] px-0.5 flex items-center justify-center rounded-full bg-role text-[9px] font-semibold text-role-foreground leading-none ring-2 ring-panel"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-1.5rem,26rem)] max-h-[min(74vh,520px)] overflow-x-hidden overflow-y-auto p-1.5"
      >
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <DropdownMenuLabel className="p-0 text-[11px] font-semibold tracking-tight">
            Announcements
            {unread > 0 ? (
              <span className="ml-1.5 font-medium tabular-nums text-primary">{unread}</span>
            ) : null}
          </DropdownMenuLabel>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  markAllRead();
                }}
              >
                <CheckCheck className="h-3 w-3" aria-hidden />
                Mark all as read
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary-dark"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setComposing((v) => !v);
                }}
              >
                <Plus className="h-3 w-3" />
                New announcement
              </button>
            )}
          </div>
        </div>

        {composing && canWrite ? (
          <div
            className="mx-1 mb-2 space-y-2 rounded-lg border border-border bg-raised/40 p-2.5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div>
              <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">Type</p>
              <AnnouncementKindPicker value={kind} onChange={setKind} />
            </div>
            <div>
              <Label htmlFor="ann-msg" className="text-[10px] text-muted-foreground">
                Message
              </Label>
              <Textarea
                id="ann-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 min-h-[72px] text-[12.5px]"
                placeholder="Finance Act update, circular, or process note"
                maxLength={8000}
              />
            </div>
            <div>
              <Label htmlFor="ann-src" className="text-[10px] text-muted-foreground">
                Source link <span className="font-normal">(optional)</span>
              </Label>
              <Input
                id="ann-src"
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="mt-1 h-8 text-[12px]"
                placeholder="https://"
              />
            </div>
            <button
              type="button"
              disabled={posting || !message.trim()}
              onClick={() => void post()}
              className="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        ) : null}

        <DropdownMenuSeparator className="my-1" />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground">
            No announcements yet.
          </p>
        ) : (
          items.slice(0, 16).map((item) => {
            const isUnread = !readIds.has(item.id);
            const messageText = item.body.trim() || item.title;
            return (
              <article
                key={item.id}
                className={cn("rounded-md px-2 py-2.5", isUnread && "bg-raised/50")}
              >
                <div className="flex items-start justify-between gap-2">
                  <AnnouncementKindChip kind={item.kind} />
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                      onClick={() => markOne(item.id)}
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-foreground">{messageText}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {announcementAttribution(item)}
                  <span className="mx-1 text-border">·</span>
                  {formatWhen(item.publishedAt)}
                </p>
                {isUnread ? (
                  <button
                    type="button"
                    className="mt-1 text-[10px] font-semibold text-primary"
                    onClick={(e) => {
                      e.preventDefault();
                      markOne(item.id);
                    }}
                  >
                    Mark as read
                  </button>
                ) : null}
              </article>
            );
          })
        )}
        <div className="px-2 pb-1 pt-1">
          <Link
            href={boardHref}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Open announcements
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
