'use client';

import { ArrowLeftRight } from 'lucide-react';
import { ClientCard } from '@/components/client/overview/ClientCard';
import { cn } from '@/lib/utils';

/**
 * Module 5 — who owns the next move.
 *
 * Reassurance first: when the split is heavily on the firm's side, that is the
 * point. Locked steps are excluded upstream, so this only counts live work.
 */
export function ClientBallInCourt({
  waitingOnClient,
  waitingOnFirm,
}: {
  waitingOnClient: number;
  waitingOnFirm: number;
}) {
  const total = waitingOnClient + waitingOnFirm;
  const clientPct = total === 0 ? 0 : Math.round((waitingOnClient / total) * 100);
  const firmPct = total === 0 ? 0 : 100 - clientPct;

  return (
    <ClientCard title="Whose turn it is" icon={ArrowLeftRight} tone="teal">
      {total === 0 ? (
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Nothing is open on either side right now. We will start the next
          milestone and let you know if we need anything.
        </p>
      ) : (
        <>
          <div className="flex h-3 gap-1 overflow-hidden" role="img" aria-label={`${waitingOnClient} waiting on you, ${waitingOnFirm} waiting on us`}>
            {waitingOnClient > 0 && (
              <span
                className="rounded-full bg-primary transition-[flex-grow] duration-700 ease-out"
                style={{ flex: waitingOnClient }}
              />
            )}
            {waitingOnFirm > 0 && (
              <span
                className="rounded-full bg-[oklch(var(--phase-post))] transition-[flex-grow] duration-700 ease-out"
                style={{ flex: waitingOnFirm }}
              />
            )}
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-4">
            <Split
              swatch="bg-primary"
              count={waitingOnClient}
              pct={clientPct}
              label="Waiting on you"
              emphasise={waitingOnClient > 0}
            />
            <Split
              swatch="bg-[oklch(var(--phase-post))]"
              count={waitingOnFirm}
              pct={firmPct}
              label="Waiting on us"
              emphasise={false}
            />
          </dl>

        </>
      )}
    </ClientCard>
  );
}

function Split({
  swatch,
  count,
  pct,
  label,
  emphasise,
}: {
  swatch: string;
  count: number;
  pct: number;
  label: string;
  emphasise: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
        <span className={cn('h-2 w-2 shrink-0 rounded-sm', swatch)} aria-hidden />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            'serif text-[1.5rem] font-bold leading-none tabular-nums',
            emphasise ? 'text-primary-dark' : 'text-ink',
          )}
        >
          {count}
        </span>
        <span className="mono text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
      </dd>
    </div>
  );
}
