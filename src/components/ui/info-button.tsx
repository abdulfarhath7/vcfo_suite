'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { PopoverCard } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * A small "i" button that opens an explanation in a pop-over card on click
 * (owner request 2026-11-11: explanations stay out of the way until asked
 * for). Use it in a card head's `right` slot or beside a field label. The
 * pop-over closes on Escape or a click outside.
 */
export function InfoButton({
  title,
  label,
  children,
  className,
  align = 'end',
}: {
  /** Shown as the pop-over's title bar. */
  title?: ReactNode;
  /** Accessible name of the button, e.g. "About GST Registration". */
  label: string;
  children: ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <PopoverCard
      align={align}
      width={340}
      title={title}
      label={label}
      trigger={
        <button
          type="button"
          aria-label={label}
          className={cn(
            'inline-grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-full border border-line text-ink-muted transition-colors hover:border-brand hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Info className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </button>
      }
    >
      <div className="grid gap-2 px-4 py-3 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
    </PopoverCard>
  );
}
