'use client';

import { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';
import type { Nudge } from '@/lib/ask/nudge';
import { useAskOptional } from './ask-context';
import { AskLinkButton } from './AskLinkButton';

/** C1: the one next thing for the client today, at the top of the panel home. */
export function AskNudgeCard() {
  const ask = useAskOptional();
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const active = Boolean(ask?.enabled && ask.features.C1 && ask.shell === 'client' && !ask.preview && ask.engagementId);
  const engagementId = ask?.engagementId;

  useEffect(() => {
    if (!active || !engagementId) return;
    let cancelled = false;
    fetch(`/api/ask/nudge?${new URLSearchParams({ engagementId })}`)
      .then((res) => (res.ok ? res.json() : { nudge: null }))
      .then((body: { nudge: Nudge | null }) => {
        if (!cancelled) setNudge(body.nudge);
      })
      .catch(() => {
        // A missing nudge is never an error the client needs to see.
      });
    return () => {
      cancelled = true;
    };
  }, [active, engagementId]);

  if (!active || !nudge) return null;
  return (
    <section aria-label="Your next step today" className="relative rounded-[var(--radius)] border border-primary/30 bg-primary-light/50 p-3">
      <button
        type="button"
        aria-label="Dismiss for today"
        onClick={() => {
          setNudge(null);
          void fetch('/api/ask/nudge', { method: 'POST' }).catch(() => undefined);
        }}
        className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="text-[11.5px] font-medium text-muted-foreground">Your next step today</p>
      <p className="pr-8 text-[14px] font-semibold text-foreground">{nudge.title}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        {nudge.effortLabel && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden /> {nudge.effortLabel}
          </span>
        )}
        {nudge.dueLabel && <span>Planned {nudge.dueLabel}</span>}
      </p>
      <div className="mt-2">
        <AskLinkButton link={nudge.link} />
      </div>
    </section>
  );
}
