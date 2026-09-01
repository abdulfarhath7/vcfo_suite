'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { ClientCard } from '@/components/client/overview/ClientCard';
import { ClientJourneyTrack } from '@/components/client/overview/ClientJourneyTrack';
import type {
  ClientOverviewMilestone,
  ClientOverviewProgress,
} from '@/lib/client-overview';
import { PHASE_FILL, phaseTone } from '@/components/client/overview/client-overview-format';
import { cn } from '@/lib/utils';

/**
 * Progress — ONE card, progressively disclosed.
 *
 * Phase bars summarise; expanding reveals the milestone track that used to be a
 * second card ("Your journey"). Two cards drawing the same dataset was the
 * redundancy this pass removed.
 *
 * The bars are shaped even at zero, so pre-COI the card reads as a journey
 * ahead rather than as four empty rows. Same bar language as the lead
 * dashboard's `LeadPhaseProgress`: quiet `--phase-*` fills on a raised track.
 */
export function ClientPhaseBars({
  progress,
  milestones,
  incorporated,
}: {
  progress: ClientOverviewProgress;
  milestones: ClientOverviewMilestone[];
  incorporated: boolean;
}) {
  const currentIndex = progress.byPhase.findIndex((phase) => phase.pct < 100);
  const [expanded, setExpanded] = useState(false);

  return (
    <ClientCard
      title={incorporated ? 'Where we are' : 'Your path to an incorporated India entity'}
      action={
        <Link
          href="/app/client/incorporation"
          className="text-[11.5px] font-bold text-primary hover:underline"
        >
          Open checklist
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

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
        className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-primary hover:underline"
      >
        {expanded ? 'Hide milestones' : 'See every step'}
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="mt-3 border-t border-border pt-3">
          <ClientJourneyTrack milestones={milestones} />
        </div>
      ) : null}
    </ClientCard>
  );
}
