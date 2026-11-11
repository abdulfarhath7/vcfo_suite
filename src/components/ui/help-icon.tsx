'use client';

import { useId, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';

/**
 * GL-04: the one help icon for every form. A small (i) right after a field label opens the help
 * text when the pointer is on it, when it has keyboard focus, and on a tap; it closes when the
 * pointer leaves, on Escape and on a tap outside. A screen reader reads the help text as the
 * icon's description. The visible "Why this?" text is gone.
 */
export function HelpIcon({ text, title, className }: { text: string; title?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const descId = useId();
  const show = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          // Not named after the field, so the field's own label still finds only its input.
          aria-label="More information"
          aria-describedby={descId}
          className={
            className ??
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40'
          }
          onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
          onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
          onFocus={show}
          onBlur={hide}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </Popover.Trigger>
      <span id={descId} className="sr-only">
        {text}
      </span>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={show}
          onPointerLeave={hide}
          className="z-50 max-w-[280px] rounded-[var(--radius-md)] border border-line bg-popover p-3 text-popover-foreground shadow-lg"
        >
          {title ? <p className="text-[12px] font-semibold">{title}</p> : null}
          <p className={`${title ? 'mt-0.5 ' : ''}whitespace-pre-line text-[12.5px] text-ink-muted`}>{text}</p>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
