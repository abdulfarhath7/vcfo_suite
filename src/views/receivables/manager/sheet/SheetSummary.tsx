'use client';

import type { ShareStatus } from '@/lib/receivables/share-filters';
import { DSO_WINDOW_DAYS, compactInr, type SheetKpis } from '@/lib/receivables/kpis';
import { cn } from '@/lib/utils';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The sheet's headline numbers as one thin strip (compact layout, 17 Nov 2026), in place of the
 * large home card: open, overdue, due in 7 days, collected this month, DSO and promises. Amounts
 * are short (₹1.20 Cr); the table keeps the full figures. A number that maps to a status filter
 * sets it when clicked. Each item's `title` says how it is worked out.
 */
export function SheetSummary({ kpis, onStatus }: { kpis: SheetKpis; onStatus: (s: ShareStatus) => void }) {
  const items: Array<{ label: string; value: string; note?: string; tone?: 'bad' | 'good'; status?: ShareStatus; how: string }> = [
    { label: 'Open', value: compactInr(kpis.openInr), note: plural(kpis.openCount, 'invoice'), status: 'open', how: 'Every open invoice in the draft and its open balance in rupees.' },
    {
      label: 'Overdue',
      value: compactInr(kpis.overdueInr),
      note: kpis.overdueCount ? `${kpis.overdueCount} · oldest ${plural(kpis.oldestOverdueDays, 'day')}` : undefined,
      tone: kpis.overdueCount ? 'bad' : undefined,
      status: 'overdue',
      how: 'Open invoices past their due date.',
    },
    { label: 'Due 7d', value: compactInr(kpis.dueSoonInr), note: kpis.dueSoonCount ? String(kpis.dueSoonCount) : undefined, status: 'due_soon', how: 'Open invoices due today or in the next seven days.' },
    {
      label: 'Collected this month',
      value: compactInr(kpis.collectedMonthInr),
      tone: kpis.collectedMonthInr > 0 ? 'good' : undefined,
      status: 'received',
      how: 'Invoices marked received with a paid-on date in this month.',
    },
    {
      label: 'DSO',
      value: kpis.dsoDays === null ? '—' : `${kpis.dsoDays} days`,
      how: `Days sales outstanding: the open balance divided by the amount billed in the last ${DSO_WINDOW_DAYS} days, times ${DSO_WINDOW_DAYS}.`,
    },
    {
      label: 'Promises this week',
      value: String(kpis.promisesWeekCount),
      note: kpis.promisesBrokenCount ? `${kpis.promisesBrokenCount} broken` : undefined,
      tone: kpis.promisesBrokenCount ? 'bad' : undefined,
      how: 'Open invoices with a promised payment date in the next seven days. Broken: the date has passed and the invoice is still open.',
    },
  ];
  return (
    <section aria-label="Summary" className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-md border border-line bg-surface-raised px-2 py-1 text-[12.5px]">
      {items.map((it, i) => {
        const inner = (
          <>
            <span className="text-ink-muted">{it.label}</span>
            <b className={cn('font-semibold tabular-nums', it.tone === 'bad' ? 'text-danger' : it.tone === 'good' ? 'text-positive' : 'text-ink')}>{it.value}</b>
            {it.note ? <span className="text-ink-muted">{`(${it.note})`}</span> : null}
          </>
        );
        return (
          <span key={it.label} className="flex items-center">
            {i ? <span aria-hidden className="mx-1 h-3 w-px bg-line" /> : null}
            {it.status ? (
              <button type="button" title={it.how} onClick={() => onStatus(it.status!)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover">
                {inner}
              </button>
            ) : (
              <span title={it.how} className="inline-flex items-center gap-1 px-1.5 py-0.5">
                {inner}
              </span>
            )}
          </span>
        );
      })}
    </section>
  );
}
