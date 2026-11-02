'use client';

import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One id for every A2 toast, so a new one replaces the last instead of stacking. */
const UNDO_TOAST_ID = 'vcfo-undo';

/**
 * A2 dark toast (VCFO Spectrum B-16): one line on the navy fill, an optional Undo, and a close
 * button, through the app's one `react-hot-toast` Toaster. One at a time, 5 seconds. Use it after
 * an action that can be taken back ("Marked done", "3 tasks reassigned"). For "Saved" and
 * "Uploaded" use the white `toastSaved` instead.
 *
 *   toastUndo('All marked read', () => restore());
 */
export function toastUndo(text: string, onUndo?: () => void, { duration = 5000 }: { duration?: number } = {}): string {
  return toast.custom(
    (t) => (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-auto flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-md bg-side px-4 py-2.5 text-[13.5px] text-white shadow-float',
          t.visible ? 'opacity-100' : 'opacity-0',
          'transition-opacity duration-150 motion-reduce:transition-none',
        )}
      >
        <span className="min-w-0 truncate">{text}</span>
        {onUndo ? (
          <button
            type="button"
            className="flex-none rounded-sm font-medium text-white underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
          className="grid h-6 w-6 flex-none place-items-center rounded-sm text-side-ink hover:bg-white/[.12]"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
        </button>
      </div>
    ),
    { id: UNDO_TOAST_ID, duration, position: 'bottom-left' },
  );
}
