'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AccentButton } from '@/components/noir';
import { useApp } from '@/context/AppContext';
import { useAnnouncements } from '@/lib/use-announcements';
import { uniqueCatalogCirculars } from '@/lib/announcement-portals';
import {
  announcementAttribution,
  announcementYmdIst,
  announcementsForDailyPopup,
  hasDailyAnnouncementSeen,
  readAnnouncementIds,
  roleAnnouncementsPath,
  writeAnnouncementReadIds,
  writeDailyAnnouncementSeen,
  type Announcement,
} from '@/lib/announcements';
import { AnnouncementKindChip } from '@/components/announcements/AnnouncementList';
import { useShellAppearance } from '@/lib/use-shell-appearance';
import { cn } from '@/lib/utils';

export function DailyAnnouncementsDialog() {
  const { user } = useApp();
  const list = useAnnouncements();
  const osReduce = useReducedMotion();
  const { reduceMotion: prefReduce } = useShellAppearance();
  const reduceMotion = Boolean(osReduce) || prefReduce;
  const decided = useRef(false);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Announcement[]>([]);

  const items = list.data?.announcements ?? [];
  const todayYmd = announcementYmdIst();
  const readIds = useMemo(
    () => (user?.id ? readAnnouncementIds(user.id) : new Set<string>()),
    [user?.id, items],
  );
  const popupItems = useMemo(
    () => announcementsForDailyPopup(items, readIds),
    [items, readIds],
  );
  const circulars = useMemo(() => uniqueCatalogCirculars(), []);
  const boardHref = user ? `${roleAnnouncementsPath(user.role)}#official-portals` : '/';

  useEffect(() => {
    if (decided.current || !user?.id) return;
    if (!list.isSuccess) return;
    decided.current = true;
    if (hasDailyAnnouncementSeen(user.id, todayYmd)) return;
    if (popupItems.length === 0) return;
    setShown(popupItems);
    setOpen(true);
  }, [user?.id, list.isSuccess, popupItems, todayYmd]);

  const dismiss = () => {
    if (user?.id) {
      const ids = shown.map((item) => item.id);
      writeDailyAnnouncementSeen(user.id, todayYmd, ids);
      const next = new Set(readAnnouncementIds(user.id));
      for (const id of ids) next.add(id);
      writeAnnouncementReadIds(user.id, next);
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent
        className={cn(
          'flex max-h-[min(86vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg',
          reduceMotion && 'duration-0 data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100',
        )}
      >
        <DialogHeader className="space-y-1.5 border-b border-border px-6 py-5 text-left">
          <DialogTitle className="text-[15px] font-extrabold tracking-tight">Today&apos;s announcements</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed">
            Firm news for this morning. Close once you&apos;ve read it — it won&apos;t return until tomorrow.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="divide-y divide-border">
            {shown.map((item) => {
              const message = item.body.trim() || item.title;
              return (
                <article key={item.id} className="py-3 first:pt-0">
                  <AnnouncementKindChip kind={item.kind} />
                  <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-ink">{message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {announcementAttribution(item)}
                  </p>
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
                    >
                      Open source <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>

          {circulars.length > 0 ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                Official circulars
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                HTML listing pages — open in a new tab. We do not scrape them.
              </p>
              <ul className="mt-2 space-y-1.5">
                {circulars.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                    >
                      {link.label}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
              <Link href={boardHref} className="mt-3 inline-block text-[12px] font-extrabold text-primary hover:underline">
                All portals & circulars
              </Link>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end">
          <AccentButton type="button" onClick={dismiss}>
            Got it
          </AccentButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
