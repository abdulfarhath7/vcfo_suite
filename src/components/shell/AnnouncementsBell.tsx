"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m, useReducedMotion } from "framer-motion";
import { Megaphone, Plus, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAnnouncements } from "@/lib/use-announcements";
import {
  ANNOUNCEMENT_GENIE_LAND_EVENT,
  ANNOUNCEMENT_READ_EVENT,
  announcementMatchesFilter,
  canWriteAnnouncements,
  readAnnouncementIds,
  requestAnnouncementPopup,
  roleAnnouncementsPath,
  writeAnnouncementReadIds,
  type AnnouncementListFilter,
} from "@/lib/announcements";
import { AnnouncementComposeForm } from "@/components/announcements/AnnouncementCompose";
import { AnnouncementRow } from "@/components/announcements/AnnouncementList";
import { cn } from "@/lib/utils";
import { SegmentedPicker } from "@/components/admin/SegmentedPicker";

const FILTER_TABS: Array<{ id: AnnouncementListFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "important", label: "Important" },
  { id: "general", label: "General" },
];

export function AnnouncementsBell() {
  const { user } = useApp();
  const list = useAnnouncements();
  const canWrite = canWriteAnnouncements(user?.role);
  const [readTick, setReadTick] = useState(0);
  const [filter, setFilter] = useState<AnnouncementListFilter>("all");
  const [catching, setCatching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const osReduce = useReducedMotion();

  useEffect(() => {
    const sync = () => setReadTick((n) => n + 1);
    window.addEventListener(ANNOUNCEMENT_READ_EVENT, sync);
    const land = () => {
      sync();
      setCatching(true);
      window.setTimeout(() => setCatching(false), 480);
    };
    window.addEventListener(ANNOUNCEMENT_GENIE_LAND_EVENT, land);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ANNOUNCEMENT_READ_EVENT, sync);
      window.removeEventListener(ANNOUNCEMENT_GENIE_LAND_EVENT, land);
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
  const visible = useMemo(
    () => items.filter((item) => announcementMatchesFilter(item.kind, filter)).slice(0, 16),
    [items, filter],
  );

  const markOne = (id: string) => {
    if (!user?.id) return;
    const next = new Set(readIds);
    next.add(id);
    writeAnnouncementReadIds(user.id, next);
    setReadTick((n) => n + 1);
  };

  const openRow = (item: (typeof items)[number]) => {
    markOne(item.id);
    requestAnnouncementPopup(item);
    setMenuOpen(false);
  };

  const emptyCopy =
    filter === "important"
      ? "No important announcements."
      : filter === "general"
        ? "No general announcements."
        : "No announcements yet.";

  return (
    <DropdownMenu
      modal={false}
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (!open) setComposing(false);
      }}
    >
      <DropdownMenuTrigger
        data-announcements-bell=""
        className={cn(
          "relative flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-h-9 sm:min-w-9",
          unread > 0 && "bg-primary-light text-primary hover:bg-primary-light",
          catching && "bg-primary-light text-primary",
        )}
        aria-label={unread > 0 ? `Announcements, ${unread} unread` : "Announcements"}
      >
        {catching ? (
          <span className="pointer-events-none absolute inset-1 rounded-lg bg-primary/20" aria-hidden />
        ) : null}
        <m.span
          data-announcements-bell-target=""
          className="relative inline-flex"
          animate={catching && !osReduce ? { scale: [1, 1.38, 0.94, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <Megaphone
            className={cn("h-[18px] w-[18px] shrink-0", unread > 0 && "fill-primary/20")}
            strokeWidth={unread > 0 ? 2.25 : 2}
            aria-hidden
          />
        </m.span>
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
        className="flex w-[min(100vw-1.5rem,24rem)] max-h-[min(82vh,640px)] flex-col overflow-hidden rounded-[var(--radius-md)] border border-border bg-panel p-0 text-foreground shadow-[0_12px_40px_-18px_oklch(22%_0.04_260_/_0.38)]"
      >
        <div className="flex items-start justify-between gap-3 px-3.5 pt-3 pb-2">
          <p className="text-[13px] font-bold leading-tight tracking-tight text-ink">
            Announcements
            {unread > 0 ? (
              <span className="ml-1.5 font-medium text-muted-foreground">· {unread} new</span>
            ) : null}
          </p>
          {canWrite ? (
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-primary hover:text-primary-dark"
              aria-expanded={composing}
              onPointerDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setComposing((open) => !open);
              }}
            >
              {composing ? (
                <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              )}
              {composing ? "Close" : "New announcement"}
            </button>
          ) : null}
        </div>

        {composing && canWrite ? (
          <AnnouncementComposeForm
            compact
            idPrefix="bell-ann"
            onClose={() => setComposing(false)}
          />
        ) : null}

        <SegmentedPicker
          value={filter}
          options={FILTER_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
          onChange={(next) => setFilter(next)}
          ariaLabel="Filter announcements"
          size="sm"
          className="mx-3 mb-2.5"
        />

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
          {visible.length === 0 ? (
            <p className="px-3.5 py-8 text-center text-[12px] text-muted-foreground">{emptyCopy}</p>
          ) : (
            <div className="divide-y divide-border">
              {visible.map((item) => {
                const isUnread = !readIds.has(item.id);
                return (
                  <AnnouncementRow
                    key={item.id}
                    item={item}
                    unread={isUnread}
                    compact
                    showSource={false}
                    onActivate={() => openRow(item)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2.5">
          <Link
            href={boardHref}
            className="text-[12px] font-semibold text-primary hover:underline"
          >
            View all announcements →
          </Link>
          <span className="text-[11px] text-muted-foreground">Esc to close</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
