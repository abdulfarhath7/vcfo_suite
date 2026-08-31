'use client';

import { Flag } from 'lucide-react';
import { Mono } from '@/components/noir';
import { ClientCard } from '@/components/client/overview/ClientCard';
import { JourneyNode } from '@/components/incorporation/JourneyNode';
import { journeyStations, type ClientOverviewMilestone } from '@/lib/client-overview';
import { formatClientDate, phaseTone } from '@/components/client/overview/client-overview-format';
import { cn } from '@/lib/utils';

/**
 * Module 6 — read-only milestone track.
 *
 * At-a-glance only: the interactive, gated flowchart stays on Incorporation.
 * Node kinds come straight from `gateActiveCatalog`, so a locked station shows
 * the lock glyph and its "opens after…" copy, never a way in.
 */
export function ClientJourneyTrack({ milestones }: { milestones: ClientOverviewMilestone[] }) {
  const stations = journeyStations(milestones);
  if (stations.length === 0) return null;

  return (
    <ClientCard title="Your journey" icon={Flag} tone="sky">
      <ol className="relative pt-0.5">
        <span className="client-rail-line" aria-hidden />
        {stations.map((station) => {
          const tone = phaseTone(station.colorKey);
          const done = station.kind === 'done';
          const active = station.kind === 'active' || station.kind === 'waiting';

          return (
            <li key={station.id} className="relative flex gap-3.5 pb-4 last:pb-0">
              <JourneyNode kind={station.kind} size="sm" className="mt-0.5 h-[30px] w-[30px]" />

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-[12.5px] leading-snug',
                    done && 'font-bold text-ink',
                    active && 'font-extrabold text-ink',
                    !done && !active && 'font-medium text-muted-foreground',
                  )}
                >
                  {station.label}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[9.5px] font-extrabold uppercase tracking-wide',
                      tone.soft,
                      tone.label,
                    )}
                  >
                    {STATION_STATE[station.kind]}
                  </span>
                  {done && station.completedOn && (
                    <Mono className="text-[10.5px] tabular-nums text-muted-foreground">
                      {formatClientDate(station.completedOn)}
                    </Mono>
                  )}
                  {station.kind === 'active' && (
                    <span className="text-[10.5px] font-bold text-primary-dark">Your turn</span>
                  )}
                  {station.kind === 'waiting' && (
                    <span className="text-[10.5px] font-bold text-muted-foreground">
                      With your VCFO team
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </ClientCard>
  );
}

/** Client-facing wording for each gate kind — never "access denied". */
const STATION_STATE: Record<ClientOverviewMilestone['kind'], string> = {
  done: 'Complete',
  active: 'In progress',
  waiting: 'In progress',
  locked: 'Upcoming',
};
