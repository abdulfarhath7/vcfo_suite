'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Check, Clock } from 'lucide-react';
import type { ComplianceFiling } from '@/data/compliance';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { internKindChipLabel, internToneBadge, KIND_TONE } from '@/components/intern/intern-tones';
import { formatDueLabel, internWaitingItems, type InternWorkItem } from '@/lib/intern-work';
import { cn } from '@/lib/utils';

function Donut({
  filed,
  dueSoon,
  overdue,
  upcoming,
}: {
  filed: number;
  dueSoon: number;
  overdue: number;
  upcoming: number;
}) {
  const total = Math.max(1, filed + dueSoon + overdue + upcoming);
  const c = 2 * Math.PI * 15.9;
  const segs = [
    { n: filed, color: 'oklch(var(--success))' },
    { n: dueSoon, color: 'oklch(var(--accent-cyan))' },
    { n: overdue, color: 'oklch(var(--danger))' },
    { n: upcoming, color: 'oklch(var(--primary-light))' },
  ];
  let offset = c * 0.25;
  return (
    <svg width="106" height="106" viewBox="0 0 42 42" className="shrink-0" aria-hidden>
      {segs.map((seg, i) => {
        const dash = (seg.n / total) * c;
        const el = (
          <circle
            key={i}
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke={seg.color}
            strokeWidth="6.4"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        );
        offset -= dash;
        return el;
      })}
      <text x="21" y="20.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="oklch(var(--ink))" fontFamily="var(--font-serif)">
        {filed + dueSoon + overdue + upcoming}
      </text>
      <text x="21" y="27.5" textAnchor="middle" fontSize="4.2" fill="oklch(var(--muted-foreground))" fontFamily="var(--font-sans)">
        filings
      </text>
    </svg>
  );
}

export function LeadSideRail({
  items,
  filings,
  now,
}: {
  items: InternWorkItem[];
  filings: ComplianceFiling[];
  now: Date;
}) {
  const waiting = internWaitingItems(items).slice(0, 5);
  const filed = filings.filter((f) => f.status === 'filed').length;
  const overdue = filings.filter((f) => f.status === 'overdue').length;
  const dueSoon = filings.filter((f) => f.status === 'upcoming' || f.status === 'in-progress').length;
  const upcoming = Math.max(0, filings.length - filed - overdue - dueSoon);
  const nextFilings = useMemo(
    () =>
      [...filings]
        .filter((f) => f.status !== 'filed')
        .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
        .slice(0, 2),
    [filings],
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="surface overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 pt-3.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-success text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">Compliance health</h2>
          <span className="ml-auto text-[11.5px] font-semibold text-text-tertiary">all companies</span>
        </div>
        <div className="px-4 pb-4 pt-3">
          <div className="flex items-center gap-4">
            <Donut filed={filed} dueSoon={dueSoon} overdue={overdue} upcoming={upcoming} />
            <div className="flex flex-col gap-1.5 text-[12px] font-bold text-muted-foreground">
              <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-success" />Filed · {filed}</span>
              <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-accent-cyan" />Due soon · {dueSoon}</span>
              <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-danger" />Overdue · {overdue}</span>
              <span><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-primary-light outline outline-1 outline-primary" />Upcoming · {upcoming}</span>
            </div>
          </div>
          {nextFilings.map((f) => (
            <Link
              key={f.id}
              href="/app/intern/compliance"
              className="mt-2.5 flex items-center gap-2.5"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-[11px] font-extrabold text-ink">
                {f.nextDue.slice(8, 10)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-ink">{f.filing}</span>
                <span className="text-[11px] text-muted-foreground">{f.authority} · {formatDueLabel(f.nextDue, now)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 pt-3.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-sky text-white">
            <Clock className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">Waiting on</h2>
        </div>
        <div className="px-4 pb-4 pt-3">
          {waiting.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">Nobody is blocking you.</p>
          ) : (
            waiting.map((item) => (
              <div key={item.id} className="flex items-start gap-2 border-t border-border py-2 first:border-0 first:pt-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-ink">{item.title}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">{item.companyName}</span>
                    <span
                      className={cn(
                        'ml-auto inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
                        internToneBadge(KIND_TONE[item.kind] ?? 'sky'),
                      )}
                    >
                      {internKindChipLabel(item.kind)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end">
                  {item.ageLabel ? (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10.5px] font-extrabold', internToneBadge(item.kind === 'waiting-manager' ? 'danger' : 'info'))}>
                      {item.ageLabel}
                    </span>
                  ) : null}
                  <InternWorkCtaButton item={item} />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
