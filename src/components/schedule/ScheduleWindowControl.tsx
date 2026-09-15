'use client';

import { useState } from 'react';
import { CalendarRange, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NoirDatePicker } from '@/components/noir/NoirDatePicker';
import { formatWindow, isValidWindowRange } from '@/lib/schedule-windows';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

type WindowValue = { from: string; to: string } | null | undefined;

/**
 * Manager control for one date window — a quiet mono trigger showing the
 * current dates (or "Set window"), opening a from/to picker with Save and
 * Clear. Callers render it only for roles that may write
 * (`canSetScheduleWindows`); the repository enforces the same rule.
 *
 * No colour: an unset window is normal, not an error state.
 */
export function ScheduleWindowControl({
  value,
  label,
  onSave,
  className,
  align = 'start',
}: {
  value: WindowValue;
  /** What the window covers, for the popover heading and the toast. */
  label: string;
  /** `null` clears. Resolves once persisted; throw to keep the popover open. */
  onSave: (window: { from: string; to: string } | null) => Promise<void>;
  className?: string;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value?.from ?? '');
  const [to, setTo] = useState(value?.to ?? '');
  const [busy, setBusy] = useState(false);
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const reset = () => {
    setFrom(value?.from ?? '');
    setTo(value?.to ?? '');
  };
  const valid = isValidWindowRange(from, to);

  const commit = async (next: { from: string; to: string } | null) => {
    setBusy(true);
    try {
      await onSave(next);
      toastSuccess(next ? `${label} window saved` : `${label} window cleared`, next ? formatWindow(next) : undefined, {
        id: `schedule-window:${label}`,
      });
      setOpen(false);
    } catch (err) {
      toastError('Could not save window', errorMessage(err, 'Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 font-mono text-[11px] tabular-nums text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground',
            value && 'border-solid',
            className,
          )}
          aria-label={`${label} window`}
        >
          <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {value ? formatWindow(value) : 'Set window'}
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[19rem] p-3">
        <p className="mb-2 text-[12px] font-semibold text-foreground">{label} window</p>
        <div className="grid grid-cols-1 gap-2">
          <div className="text-[11px] text-muted-foreground">
            <span id={`window-from-label-${slug}`}>From</span>
            <NoirDatePicker id={`window-from-${slug}`} value={from} onChange={setFrom} className="mt-1" />
          </div>
          <div className="text-[11px] text-muted-foreground">
            <span id={`window-to-label-${slug}`}>To</span>
            <NoirDatePicker id={`window-to-${slug}`} value={to} onChange={setTo} className="mt-1" />
          </div>
        </div>
        {from && to && !valid ? (
          <p className="mt-1.5 text-[11px] text-danger">The end date must not be before the start.</p>
        ) : null}
        <div className="mt-3 flex items-center justify-end gap-2">
          {value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void commit(null)}
              className="mr-auto cursor-pointer text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !valid}
            onClick={() => void commit({ from, to })}
            className="cursor-pointer bg-blue-600 text-white hover:bg-blue-600/90"
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Read-only counterpart for leads and clients: the dates as quiet mono metadata, or nothing. */
export function ScheduleWindowMeta({
  value,
  className,
}: {
  value: WindowValue;
  className?: string;
}) {
  if (!value) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted-foreground',
        className,
      )}
    >
      <CalendarRange className="h-3 w-3 shrink-0" aria-hidden />
      {formatWindow(value)}
    </span>
  );
}
