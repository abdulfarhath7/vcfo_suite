'use client';

import type { ShareStatus } from '@/lib/receivables/share-filters';
import { DSO_WINDOW_DAYS, compactInr, type SheetKpis } from '@/lib/receivables/kpis';
import { cn } from '@/lib/utils';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The sheet's headline numbers as six small cards in one row (17 Nov 2026), in place of the large
 * home card: open, overdue, due in 7 days, collected this month, DSO and promises. Each card has a
 * small label, the value and a note; amounts are short (₹1.20 Cr) and the table keeps the full
 * figures. A card that maps to a status filter sets it when clicked; its `title` says how it is
 * worked out.
 */
export function SheetSummary({ kpis, onStatus }: { kpis: SheetKpis; onStatus: (s: ShareStatus) => void }) {
  const items: Array<{ label: string; value: string; note?: string; tone?: 'bad' | 'good'; status?: ShareStatus; how: string }> = [
    { label: 'Open', value: compactInr(kpis.openInr), note: plural(kpis.openCount, 'invoice'), status: 'open', how: 'Every open invoice in the draft and its open balance in rupees.' },
    {
      label: 'Overdue',
      value: compactInr(kpis.overdueInr),
      note: kpis.overdueCount ? `${plural(kpis.overdueCount, 'invoice')} · oldest ${kpis.oldestOverdueDays}d` : 'nothing overdue',
      tone: kpis.overdueCount ? 'bad' : undefined,
      status: 'overdue',
      how: 'Open invoices past their due date.',
    },
    { label: 'Due in 7 days', value: compactInr(kpis.dueSoonInr), note: kpis.dueSoonCount ? plural(kpis.dueSoonCount, 'invoice') : 'none due', status: 'due_soon', how: 'Open invoices due today or in the next seven days.' },
    {
      label: 'Collected this month',
      value: compactInr(kpis.collectedMonthInr),
      tone: kpis.collectedMonthInr > 0 ? 'good' : undefined,
      note: kpis.collectedMonthCount ? plural(kpis.collectedMonthCount, 'receipt') : 'no receipts yet',
      status: 'received',
      how: 'Invoices marked received with a paid-on date in this month.',
    },
    {
      label: 'DSO',
      value: kpis.dsoDays === null ? '—' : `${kpis.dsoDays} days`,
      note: `last ${DSO_WINDOW_DAYS} days`,
      how: `Days sales outstanding: the open balance divided by the amount billed in the last ${DSO_WINDOW_DAYS} days, times ${DSO_WINDOW_DAYS}.`,
    },
    {
      label: 'Promises',
      value: String(kpis.promisesWeekCount),
      note: kpis.promisesBrokenCount ? `${kpis.promisesBrokenCount} broken` : 'this week',
      tone: kpis.promisesBrokenCount ? 'bad' : undefined,
      how: 'Open invoices with a promised payment date in the next seven days. Broken: the date has passed and the invoice is still open.',
    },
  ];
  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => {
        const inner = (
          <>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-ink-muted">
              {it.label}
              {it.tone === 'bad' ? <span aria-hidden className="size-1.5 rounded-full bg-danger" /> : null}
            </span>
            <span className={cn('text-[18px] font-semibold leading-6 tabular-nums', it.tone === 'bad' ? 'text-danger' : it.tone === 'good' ? 'text-positive' : 'text-ink')}>{it.value}</span>
            <span className="truncate text-[11.5px] text-ink-muted">{it.note ?? '\u00a0'}</span>
          </>
        );
        const card = 'flex min-w-0 flex-col gap-0.5 rounded-md border border-line bg-surface-raised px-3 py-2 text-left';
        return it.status ? (
          <button key={it.label} type="button" title={it.how} onClick={() => onStatus(it.status!)} className={cn(card, 'transition-colors hover:border-line-strong hover:bg-hover')}>
            {inner}
          </button>
        ) : (
          <div key={it.label} title={it.how} className={card}>
            {inner}
          </div>
        );
      })}
    </section>
  );
}
