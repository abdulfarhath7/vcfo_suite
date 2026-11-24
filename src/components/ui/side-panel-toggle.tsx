'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const KEY = 'vcfo.side-panel.open';

function storageKey(userId: string | null | undefined): string {
  return userId ? `${KEY}:${userId}` : KEY;
}

/**
 * GL-05: whether the step progress panel is open. Open by default for a new user; then the last
 * choice of each user is kept (per user, in this browser), so it stays after a page change and a
 * new sign-in on the same device.
 */
export function useSidePanelOpen(userId: string | null | undefined): [boolean, () => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey(userId));
      if (saved === '0') setOpen(false);
      if (saved === '1') setOpen(true);
    } catch {
      /* No storage: the panel starts open. */
    }
  }, [userId]);
  const toggle = useCallback(() => {
    setOpen((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(storageKey(userId), next ? '1' : '0');
      } catch {
        /* No storage: the choice lasts for this page only. */
      }
      return next;
    });
  }, [userId]);
  return [open, toggle];
}

/**
 * GL-05: the side panel with its handle. The handle is a small round button sitting on the
 * panel card's inner edge (the edge that faces the form), vertically centred on the card, so it
 * reads as part of the card. One push hides the panel and gives its width to the form; the handle
 * then waits as a slim round button at the panel's edge so the next push brings it back. Desktop
 * only: below 1024px the panel always shows, stacked under the form, and the handle is hidden.
 * `side` says where the panel sits (the Manager and Admin step pages keep their list on the left).
 */
export function SidePanelFrame({
  open,
  onToggle,
  side = 'right',
  className,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  side?: 'left' | 'right';
  className?: string;
  children: ReactNode;
}) {
  const closeIcon = side === 'right' ? ChevronRight : ChevronLeft;
  const openIcon = side === 'right' ? ChevronLeft : ChevronRight;
  const Icon = open ? closeIcon : openIcon;
  return (
    <div className={cn('relative min-w-0', className)}>
      <div className={cn(!open && 'lg:hidden')}>{children}</div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Hide the progress panel' : 'Show the progress panel'}
        title={open ? 'Hide the progress panel' : 'Show the progress panel'}
        className={cn(
          'hidden h-7 w-7 place-items-center rounded-full border border-line bg-surface-raised text-ink-muted shadow-sm transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring lg:grid',
          open
            ? cn('absolute z-10 top-[min(50%,14rem)] -translate-y-1/2', side === 'right' ? '-left-3.5' : '-right-3.5')
            : 'lg:sticky lg:top-[calc(var(--shell-sticky-top)+0.75rem)]',
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
