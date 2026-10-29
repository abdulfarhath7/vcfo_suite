'use client';

import toast from 'react-hot-toast';
import { Check, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A1 kinds: what the status tile shows. */
export type SavedToastKind = 'saved' | 'filed' | 'uploaded';

// M-28 (A1): every kind is a success, so each gets the 22px green status tile with a tick.
const KIND: Record<SavedToastKind, { Icon: LucideIcon; tile: string }> = {
  saved: { Icon: Check, tile: 'bg-positive-soft text-positive' },
  filed: { Icon: Check, tile: 'bg-positive-soft text-positive' },
  uploaded: { Icon: Check, tile: 'bg-positive-soft text-positive' },
};

export interface SavedToastOptions {
  kind?: SavedToastKind;
  /** A second line under the title: "GSTR-3B is ready". */
  sub?: string;
  /** A small outline Undo button. */
  onUndo?: () => void;
  /** One small action, for example "View". */
  action?: { label: string; onClick: () => void };
  /** Milliseconds on screen. 5000 by default. */
  duration?: number;
  /** A stable id replaces an earlier toast with the same id instead of stacking. */
  id?: string;
}

const SMALL_BUTTON =
  'inline-flex h-control-sm flex-none items-center rounded-md border-1.5 border-line-strong bg-surface-raised px-2.5 text-[13px] font-medium text-ink hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25';

/**
 * A1 white toast (VCFO Spectrum B-16) through the app's one `react-hot-toast` Toaster: a status
 * tile, the title, an optional second line, and optional Undo and action buttons. Use it for
 * "Saved", "Filed" and "Uploaded". Returns the toast id.
 *
 *   toastSaved('Filing saved', { kind: 'filed', sub: 'GSTR-3B is ready' });
 */
export function toastSaved(text: string, { kind = 'saved', sub, onUndo, action, duration = 5000, id }: SavedToastOptions = {}): string {
  const k = KIND[kind];
  return toast.custom(
    (t) => (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-auto flex w-[380px] max-w-[calc(100vw-32px)] items-start gap-2.5 rounded-md border-1.5 border-line bg-surface-raised p-3.5 text-ink shadow-float',
          t.visible ? 'opacity-100' : 'opacity-0',
          'transition-opacity duration-150 motion-reduce:transition-none',
        )}
      >
        <span className={cn('grid h-[22px] w-[22px] flex-none place-items-center rounded-mark', k.tile)} aria-hidden>
          <k.Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <b className="text-[14px] font-medium leading-[22px]">{text}</b>
          {sub ? <span className="text-[13px] leading-[19px] text-ink-2">{sub}</span> : null}
        </span>
        {action ? (
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              action.onClick();
              toast.dismiss(t.id);
            }}
          >
            {action.label}
          </button>
        ) : null}
        {onUndo ? (
          <button
            type="button"
            className={SMALL_BUTTON}
            onClick={() => {
              onUndo();
              toast.dismiss(t.id);
            }}
          >
            Undo
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => toast.dismiss(t.id)}
          className="grid h-[30px] w-6 flex-none place-items-center rounded-mark text-ink-muted hover:bg-ink/[.06] hover:text-ink"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
        </button>
      </div>
    ),
    { id, duration, position: 'bottom-left' },
  );
}
