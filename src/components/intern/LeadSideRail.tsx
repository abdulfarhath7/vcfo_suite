'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Check, Clock } from 'lucide-react';
import type { ComplianceFiling } from '@/data/compliance';
import { DashDonut, DashLegendRow, DashSection } from '@/components/dash/DashSection';
import { InternWorkDenseRow } from '@/components/intern/InternWorkRow';
import { formatDueLabel, internWaitingItems, ymdFromIsoInIst, type InternWorkItem } from '@/lib/intern-work';

/* The donut is a status chart, so it wears the status tokens: positive for filed,
   warning for due soon, danger for overdue, and the neutral line-strong for the
   rest. Every segment is named in the legend beside it. */
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
      <DashSection icon={Check} title="Compliance health">
        <div className="flex min-w-0 items-center gap-3">
          <DashDonut
            segments={[
              { n: filed, color: 'oklch(var(--positive))' },
              { n: dueSoon, color: 'oklch(var(--warning))' },
              { n: overdue, color: 'oklch(var(--danger))' },
              { n: upcoming, color: 'oklch(var(--line-strong))' },
            ]}
            centerLabel={filed + dueSoon + overdue + upcoming}
            centerCaption="filings"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <DashLegendRow swatchClassName="bg-positive" label="Filed" count={filed} />
            <DashLegendRow swatchClassName="bg-warning" label="Due soon" count={dueSoon} />
            <DashLegendRow swatchClassName="bg-danger" label="Overdue" count={overdue} />
            <DashLegendRow swatchClassName="bg-line-strong" label="Upcoming" count={upcoming} />
          </div>
        </div>
        {nextFilings.map((f) => (
          <Link
            key={f.id}
            href="/app/intern/compliances/calendar"
            className="mt-2.5 flex min-w-0 items-center gap-2.5"
          >
            <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-sunken text-[12px] font-semibold tabular-nums text-ink">
              {(ymdFromIsoInIst(f.nextDue) ?? f.nextDue).slice(8, 10)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-ink">{f.filing}</span>
              <span className="text-[11px] text-ink-muted">{f.authority} · {formatDueLabel(f.nextDue, now)}</span>
            </span>
          </Link>
        ))}
      </DashSection>

      <section className="surface overflow-hidden" data-intern-waiting-on>
        <div className="flex min-w-0 items-center gap-2.5 px-4 pt-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-sunken text-warning">
            <Clock className="h-3.5 w-3.5" aria-hidden />
          </span>
          <h2 className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-ink">Waiting on</h2>
        </div>
        <div className="px-4 pb-3 pt-2.5">
          {waiting.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">Nobody is blocking you.</p>
          ) : (
            waiting.map((item) => (
              <div key={item.id} className="border-t border-line py-2.5 first:border-0 first:pt-0">
                <InternWorkDenseRow item={item} showCompany />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
