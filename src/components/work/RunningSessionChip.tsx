'use client';

import { Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTick } from '@/components/work/use-tick';
import { useRunningSession, useSessionToggle } from '@/components/work/use-work';
import { formatClock, sessionMs } from '@/lib/work/sessions';
import { errorMessage, toastError } from '@/lib/toast-errors';

/**
 * The caller's running work session, in the Work page head: one per person, so it is
 * always clear what the clock is on. The title opens the task drawer; Stop ends it.
 */
export function RunningSessionChip({
  titleFor,
  onOpen,
}: {
  titleFor: (itemKey: string) => string | null;
  onOpen: (itemKey: string) => void;
}) {
  const query = useRunningSession();
  const toggle = useSessionToggle();
  const running = query.data ?? null;
  const now = useTick(Boolean(running));
  if (!running) return null;
  const title = titleFor(running.itemKey) ?? 'Work session';
  return (
    <span className="inline-flex h-control-md max-w-full items-center gap-2 rounded-md border-1.5 border-brand-line bg-brand-soft pl-3 pr-1 text-[13px] text-brand-text">
      <i className="h-2 w-2 flex-none animate-pulse rounded-full bg-brand" aria-hidden />
      <button type="button" className="min-w-0 truncate font-medium hover:underline" onClick={() => onOpen(running.itemKey)} title={title}>
        {title}
      </button>
      <span className="flex-none tabular-nums">{formatClock(sessionMs(running, now))}</span>
      <Button
        size="icon"
        variant="quiet"
        className="h-7 w-7 text-brand-text"
        aria-label={`Stop session on ${title}`}
        disabled={toggle.isPending}
        onClick={() =>
          toggle.mutate(
            { key: running.itemKey, running },
            { onError: (err) => toastError("Couldn't stop the session", errorMessage(err)) },
          )
        }
      >
        <Pause className="h-3.5 w-3.5" strokeWidth={1.6} />
      </Button>
    </span>
  );
}
