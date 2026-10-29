'use client';

import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTick } from '@/components/work/use-tick';
import { formatClock, sessionMs, type WorkSessionDto } from '@/lib/work/sessions';
import { cn } from '@/lib/utils';

/**
 * Start or stop a work session (prototype `SessionButton`). The running clock shows the
 * session that is running now; `baseMs` adds earlier time when the caller wants a total.
 */
export function SessionButton({
  running,
  baseMs = 0,
  label,
  busy,
  onToggle,
}: {
  running: WorkSessionDto | null;
  baseMs?: number;
  label: string;
  busy?: boolean;
  onToggle: () => void;
}) {
  const now = useTick(Boolean(running));
  const ms = baseMs + (running ? sessionMs(running, now) : 0);
  return (
    <span className="inline-flex flex-none items-center gap-1.5">
      {ms > 0 ? (
        <span className={cn('text-[12px] tabular-nums', running ? 'font-medium text-brand-text' : 'text-ink-muted')}>
          {formatClock(ms)}
        </span>
      ) : null}
      <Button
        size="icon"
        variant={running ? 'outline' : 'ghost'}
        className="h-control-sm w-control-sm"
        disabled={busy}
        onClick={onToggle}
        aria-label={running ? `Stop session on ${label}` : `Start session on ${label}`}
        title={running ? 'Stop session' : 'Start session'}
      >
        {running ? <Pause className="h-3.5 w-3.5" strokeWidth={1.6} /> : <Play className="h-3.5 w-3.5" strokeWidth={1.6} />}
      </Button>
    </span>
  );
}
