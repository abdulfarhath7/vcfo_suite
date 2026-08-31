'use client';

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { ClientCard } from '@/components/client/overview/ClientCard';
import type { ClientOverviewProgress } from '@/lib/client-overview';
import { PHASE_FILL, phaseTone } from '@/components/client/overview/client-overview-format';
import { cn } from '@/lib/utils';

/**
 * Module 4 — the four incorporation phases as horizontal bars.
 *
 * Same bar language as the lead dashboard's `LeadPhaseProgress`: quiet
 * `--phase-*` fills on a raised track, with the colour key spelled out below.
 */
export function ClientPhaseBars({ progress }: { progress: ClientOverviewProgress }) {
  const currentIndex = progress.byPhase.findIndex((phase) => phase.pct < 100);

  return (
    <ClientCard
      title="Where we are"
      icon={TrendingUp}
      tone="success"
      action={
        <Link
          href="/app/client/incorporation"
          className="text-[11.5px] font-bold text-primary hover:underline"
        >
          See every step
        </Link>
      }
    >
      <ol className="space-y-2.5">
        {progress.byPhase.map((phase, index) => {
          const tone = phaseTone(phase.colorKey);
          const isCurrent = index === currentIndex;
          const isDone = phase.pct >= 100;

          return (
            <li key={phase.id}>
              <div className="mb-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px]">
                <b
                  className={cn(
                    'min-w-0 truncate font-extrabold',
                    isDone || isCurrent ? 'text-ink' : 'text-muted-foreground',
                  )}
                >
                  {phase.label}
                </b>
                {isCurrent && (
                  <span
                    className={cn(
                      'inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
                      tone.soft,
                      tone.label,
                    )}
                  >
                    In progress
                  </span>
                )}
                {isDone && (
                  <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-success-light px-2 py-0.5 text-[10.5px] font-extrabold text-success-text">
                    Complete
                  </span>
                )}
                <span className="mono ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {phase.done}/{phase.total}
                </span>
              </div>

              <div
                className="client-bar-track"
                role="img"
                aria-label={`${phase.label}: ${phase.pct}% complete`}
              >
                <i
                  className="client-bar-fill"
                  style={{ width: `${phase.pct}%`, background: PHASE_FILL[phase.colorKey] }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] font-bold">
        {progress.byPhase.map((phase) => (
          <span key={phase.id} className="inline-flex items-center gap-1.5">
            <i
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: PHASE_FILL[phase.colorKey] }}
              aria-hidden
            />
            <span className={phaseTone(phase.colorKey).label}>{phase.label}</span>
          </span>
        ))}
      </div>
    </ClientCard>
  );
}
