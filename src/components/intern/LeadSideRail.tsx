'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Check, Clock } from 'lucide-react';
import type { ComplianceFiling } from '@/data/compliance';
import { InternWorkDenseRow } from '@/components/intern/InternWorkRow';
import { formatDueLabel, internWaitingItems, ymdFromIsoInIst, type InternWorkItem } from '@/lib/intern-work';

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
    <div className="flex flex-col gap-3">
      <section className="surface overflow-hidden">
        <div className="flex min-w-0 items-center gap-2.5 px-4 pt-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
          <h2 className="min-w-0 truncate text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">
            Compliance health
          </h2>
        </div>
        <div className="px-4 pb-3 pt-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Donut filed={filed} dueSoon={dueSoon} overdue={overdue} upcoming={upcoming} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[12px] font-bold text-muted-foreground">
              <span className="min-w-0 truncate"><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-success" />Filed · {filed}</span>
              <span className="min-w-0 truncate"><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-accent-cyan" />Due soon · {dueSoon}</span>
              <span className="min-w-0 truncate"><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-danger" />Overdue · {overdue}</span>
              <span className="min-w-0 truncate"><i className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-primary-light outline outline-1 outline-primary" />Upcoming · {upcoming}</span>
            </div>
          </div>
          {nextFilings.map((f) => (
            <Link
              key={f.id}
              href="/app/intern/compliance"
              className="mt-2.5 flex min-w-0 items-center gap-2.5"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-[11px] font-extrabold tabular-nums text-ink">
                {(ymdFromIsoInIst(f.nextDue) ?? f.nextDue).slice(8, 10)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-ink">{f.filing}</span>
                <span className="text-[11px] text-muted-foreground">{f.authority} · {formatDueLabel(f.nextDue, now)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="surface overflow-hidden" data-intern-waiting-on>
        <div className="flex min-w-0 items-center gap-2.5 px-4 pt-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-sky text-white">
            <Clock className="h-3.5 w-3.5" />
          </span>
          <h2 className="min-w-0 truncate text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">Waiting on</h2>
        </div>
        <div className="px-4 pb-3 pt-2.5">
          {waiting.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">Nobody is blocking you.</p>
          ) : (
            waiting.map((item) => (
              <div key={item.id} className="border-t border-border py-2.5 first:border-0 first:pt-0">
                <InternWorkDenseRow item={item} showCompany />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
