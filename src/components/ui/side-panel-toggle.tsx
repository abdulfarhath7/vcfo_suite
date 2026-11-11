'use client';

import { useCallback, useEffect, useState } from 'react';
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
 * GL-05: the handle on the left edge of the side panel. One push closes the panel and gives its
 * width to the form; the handle stays at the right edge so the next push opens it again. Desktop
 * only: below 1024px the panel already stacks under the form.
 */
export function SidePanelHandle({ open, onToggle, className }: { open: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? 'Hide the progress panel' : 'Show the progress panel'}
      title={open ? 'Hide the progress panel' : 'Show the progress panel'}
      className={cn(
        'hidden h-16 w-6 flex-none items-center justify-center self-start rounded-md border-1.5 border-line bg-surface-raised text-ink-muted shadow-sm transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring lg:inline-flex',
        className,
      )}
    >
      {open ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
    </button>
  );
}
