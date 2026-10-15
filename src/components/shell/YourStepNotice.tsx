'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'vcfo.your-step';
/** How long the card stays up untouched; hovering or focusing it holds it open. */
const AUTO_HIDE_MS = 12_000;

/**
 * One message at the side when this person arrives and the next step is
 * theirs. It slides in above the floating Ask button, never pushes the page
 * down, and leaves on its own after a short while. It stays down after it has
 * been seen, until a different step becomes theirs or they sign in again.
 */
export function YourStepNotice({
  stepKey,
  stepTitle,
  href,
}: {
  stepKey: string;
  stepTitle: string;
  href: string;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [held, setHeld] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!stepKey) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === stepKey) return;
    } catch {
      // Private mode still shows the message for this visit.
    }
    setOpen(true);
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [stepKey]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, stepKey);
    } catch {
      // The message simply closes for this visit.
    }
    setOpen(false);
  }, [stepKey]);

  useEffect(() => {
    if (!open || held) return;
    timer.current = setTimeout(dismiss, AUTO_HIDE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, held, dismiss]);

  if (!open) return null;

  return (
    <div
      role="status"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className={cn(
        'fixed inset-x-3 bottom-20 z-40 flex items-center gap-3 rounded-md border border-border border-l-[3px] border-l-primary bg-panel px-4 py-3 shadow-lg transition-all duration-200 ease-out motion-reduce:transition-none sm:inset-x-auto sm:right-5 sm:w-[340px]',
        shown ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Your step right now</p>
        <p className="mt-0.5 truncate text-[13.5px] font-semibold text-foreground">{stepTitle}</p>
      </div>
      <Link
        href={href}
        onClick={dismiss}
        className="inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary-dark"
      >
        Open
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
