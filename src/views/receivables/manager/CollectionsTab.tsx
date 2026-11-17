'use client';

import { useMemo, useState } from 'react';
import { FilterSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { collectionsReport, type CollectionRow, type CollectionsPeriod, type Tally } from '@/lib/receivables/collections';
import { monthLong, sheetDate } from '@/lib/receivables/dates';
import { compactInr } from '@/lib/receivables/kpis';
import type { ManagerSheetDto } from '@/lib/receivables/wire';
import { cn } from '@/lib/utils';
import { inr } from '../format';

/**
 * The Collections tab (owner, 17 Nov 2026): invoices received on time against received late, from
 * the received date and amount entered at Mark received. Five cards (on time, late, still open and
 * late, average days late, short-paid), filters (period by received date, partner, client, and
 * whether open late invoices count in the on-time share), a bar per month received, a table by
 * client partner and by client, and the list of received invoices with how early or late each was.
 * Everything is worked out in the browser from the sheet already loaded
 * (src/lib/receivables/collections.ts).
 */

const PERIODS: Array<{ value: CollectionsPeriod; label: string }> = [
  { value: 'fy', label: 'This financial year' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

const TH = 'whitespace-nowrap border-b border-line bg-surface-sunken px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-[.04em] text-ink-muted';
const TD = 'h-10 border-t border-line-soft px-3 py-1 align-middle text-[13px]';
const pct = (t: Tally) => (t.onTime + t.late ? `${Math.round((t.onTime / (t.onTime + t.late)) * 100)}%` : '—');

export function CollectionsTab({ data, today }: { data: ManagerSheetDto; today: string }) {
  const [period, setPeriod] = useState<CollectionsPeriod>('fy');
  const [partnerId, setPartnerId] = useState<string>('all');
  const [client, setClient] = useState<string>('all');
  const [countOpenLate, setCountOpenLate] = useState(false);
  const [show, setShow] = useState<'all' | 'late' | 'short'>('all');
  const report = useMemo(
    () =>
      collectionsReport(data.invoices, {
        today,
        period,
        partnerId: partnerId === 'all' ? null : partnerId === 'none' ? '' : partnerId,
        client: client === 'all' ? null : client,
        countOpenLate,
      }),
    [data.invoices, today, period, partnerId, client, countOpenLate],
  );
  const partnerName = (id: string | null) => (id ? (data.partners.find((p) => p.id === id)?.name ?? 'A removed partner') : 'No partner');
  const clients = useMemo(() => [...new Set(data.invoices.map((i) => i.clientName))].sort((a, b) => a.localeCompare(b)), [data.invoices]);
  const t = report.totals;
  const received = t.onTime + t.late;
  const rows = report.rows.filter((r) => (show === 'late' ? r.result !== 'on_time' : show === 'short' ? r.shortPaid : true));

  const cards: Array<{ label: string; value: string; note: string; tone?: 'good' | 'bad' }> = [
    { label: 'On time', value: `${t.onTime} · ${compactInr(t.onTimeInr)}`, note: received ? `${Math.round((t.onTime / received) * 100)}% of received` : 'nothing received', tone: 'good' },
    { label: 'Late', value: `${t.late} · ${compactInr(t.lateInr)}`, note: received ? `${Math.round((t.late / received) * 100)}% of received` : 'nothing received', tone: t.late ? 'bad' : undefined },
    { label: 'Still open, late', value: `${t.openLate} · ${compactInr(t.openLateInr)}`, note: 'past due today', tone: t.openLate ? 'bad' : undefined },
    { label: 'Avg days late', value: t.avgDaysLate === null ? '—' : `${t.avgDaysLate} days`, note: 'late ones only' },
    { label: 'Short-paid', value: `${t.shortPaid} · ${compactInr(t.shortPaidInr)}`, note: 'received less than invoiced', tone: t.shortPaid ? 'bad' : undefined },
  ];

  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Collections summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col gap-0.5 rounded-md border border-line bg-surface-raised px-3 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-ink-muted">
              {c.label}
              {c.tone === 'bad' ? <span aria-hidden className="size-1.5 rounded-full bg-danger" /> : null}
            </span>
            <span className={cn('text-[18px] font-semibold leading-6 tabular-nums', c.tone === 'bad' ? 'text-danger' : c.tone === 'good' ? 'text-positive' : 'text-ink')}>{c.value}</span>
            <span className="truncate text-[11.5px] text-ink-muted">{c.note}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <FilterSelect className="!h-7 !text-[12.5px]" aria-label="Period (by received date)" value={period} onChange={(e) => setPeriod(e.target.value as CollectionsPeriod)} options={PERIODS} />
        <FilterSelect
          className="!h-7 !text-[12.5px]"
          aria-label="Client partner"
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
          options={[{ value: 'all', label: 'All partners' }, ...data.partners.map((p) => ({ value: p.id, label: p.name })), { value: 'none', label: 'No partner' }]}
        />
        <FilterSelect className="!h-7 !text-[12.5px]" aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)} options={[{ value: 'all', label: 'All clients' }, ...clients.map((c) => ({ value: c, label: c }))]} />
        <span className="inline-flex items-center gap-2">
          <Switch size="sm" id="rcv-col-openlate" checked={countOpenLate} onCheckedChange={setCountOpenLate} />
          <label htmlFor="rcv-col-openlate" className="cursor-pointer text-ink-2">
            Count open late invoices in % on time
          </label>
        </span>
        <span className="ml-auto text-ink-muted">{`On time: ${t.onTimePct === null ? '—' : `${t.onTimePct}%`}`}</span>
      </div>

      <section aria-label="By month received" className="rounded-md border border-line bg-surface-raised p-3">
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[.04em] text-ink-muted">On time vs late, by month received</h3>
        {report.byMonth.length ? (
          <ul className="flex flex-col gap-1.5">
            {report.byMonth.map((m) => {
              const n = m.onTime + m.late;
              return (
                <li key={m.month} className="grid grid-cols-[110px_minmax(0,1fr)_170px] items-center gap-3 text-[12.5px]">
                  <span className="text-ink-2">{monthLong(m.month)}</span>
                  <span className="flex h-3 overflow-hidden rounded-sm bg-surface-sunken" role="img" aria-label={`${m.onTime} on time, ${m.late} late`}>
                    <span className="bg-positive" style={{ width: `${n ? (m.onTime / n) * 100 : 0}%` }} />
                    <span className="bg-danger" style={{ width: `${n ? (m.late / n) * 100 : 0}%` }} />
                  </span>
                  <span className="tabular-nums text-ink-muted">{`${m.onTime} on time · ${m.late} late`}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-muted">Nothing received in this period.</p>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <TallyTable title="By client partner" rows={report.byPartner.map((p) => ({ key: p.partnerId ?? 'none', name: partnerName(p.partnerId), ...p })).sort((a, b) => a.name.localeCompare(b.name))} />
        <TallyTable title="By client" rows={report.byClient.map((c) => ({ key: c.clientName, name: c.clientName, ...c }))} />
      </div>

      <section aria-label="Received invoices" className="overflow-hidden rounded-md border border-line bg-surface-raised">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <h3 className="text-[12px] font-semibold uppercase tracking-[.04em] text-ink-muted">Invoices</h3>
          <span className="flex-1" />
          {(['all', 'late', 'short'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={show === k}
              onClick={() => setShow(k)}
              className={cn('h-7 rounded-md border px-2.5 text-[12.5px]', show === k ? 'border-brand bg-brand-soft text-ink' : 'border-line text-ink-2 hover:bg-hover')}
            >
              {k === 'all' ? 'All' : k === 'late' ? 'Late only' : 'Short-paid'}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={TH}>Client</th>
                <th className={TH}>Invoice no.</th>
                <th className={TH}>Partner</th>
                <th className={TH}>Due</th>
                <th className={TH}>Received</th>
                <th className={cn(TH, 'text-right')}>Days</th>
                <th className={cn(TH, 'text-right')}>Invoiced ₹</th>
                <th className={cn(TH, 'text-right')}>Received ₹</th>
                <th className={TH}>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <InvoiceRow key={r.id} r={r} partner={partnerName(r.partnerId)} />
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9} className={cn(TD, 'text-center text-ink-muted')}>
                    Nothing to show for these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TallyTable({ title, rows }: { title: string; rows: Array<{ key: string; name: string } & Tally> }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-md border border-line bg-surface-raised">
      <h3 className="border-b border-line px-3 py-2 text-[12px] font-semibold uppercase tracking-[.04em] text-ink-muted">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={TH}>Name</th>
              <th className={cn(TH, 'text-right')}>On time</th>
              <th className={cn(TH, 'text-right')}>Late</th>
              <th className={cn(TH, 'text-right')}>% on time</th>
              <th className={cn(TH, 'text-right')}>Avg late</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className={cn(TD, 'max-w-[220px] truncate font-medium')} title={r.name}>
                  {r.name}
                </td>
                <td className={cn(TD, 'text-right tabular-nums text-positive')}>{r.onTime}</td>
                <td className={cn(TD, 'text-right tabular-nums', r.late ? 'text-danger' : 'text-ink-muted')}>{r.late}</td>
                <td className={cn(TD, 'text-right tabular-nums')}>{pct(r)}</td>
                <td className={cn(TD, 'text-right tabular-nums text-ink-muted')}>{r.avgDaysLate === null ? '—' : `${r.avgDaysLate}d`}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className={cn(TD, 'text-center text-ink-muted')}>
                  Nothing received in this period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InvoiceRow({ r, partner }: { r: CollectionRow; partner: string }) {
  const days = r.daysLate === null ? '—' : r.daysLate > 0 ? `${r.daysLate} late` : r.daysLate < 0 ? `${-r.daysLate} early` : 'on the day';
  const result =
    r.result === 'open_late' ? { text: 'Open, late', dot: 'bg-danger' } : r.shortPaid ? { text: r.result === 'late' ? 'Late · short' : 'Short-paid', dot: 'bg-warning' } : r.result === 'late' ? { text: 'Late', dot: 'bg-danger' } : { text: 'On time', dot: 'bg-positive' };
  return (
    <tr>
      <td className={cn(TD, 'max-w-[200px] truncate font-medium')} title={r.clientName}>
        {r.clientName}
      </td>
      <td className={cn(TD, 'font-mono text-[12px]')}>{r.invoiceNo ?? '—'}</td>
      <td className={cn(TD, 'max-w-[140px] truncate text-ink-2')}>{partner}</td>
      <td className={cn(TD, 'tabular-nums')}>{sheetDate(r.dueDate)}</td>
      <td className={cn(TD, 'tabular-nums')}>{r.paidOn ? sheetDate(r.paidOn) : <span className="text-ink-muted">not yet</span>}</td>
      <td className={cn(TD, 'text-right tabular-nums', r.daysLate !== null && r.daysLate > 0 ? 'text-danger' : 'text-ink-2')}>{days}</td>
      <td className={cn(TD, 'text-right font-mono text-[12.5px]')}>{inr(r.invoicedInr)}</td>
      <td className={cn(TD, 'text-right font-mono text-[12.5px]', r.shortPaid && 'text-warning-text')} title={r.tdsInr ? `TDS ₹${inr(r.tdsInr)} counts as paid` : undefined}>
        {r.receivedInr === null ? '—' : inr(r.receivedInr)}
      </td>
      <td className={TD}>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden className={cn('size-2 rounded-full', result.dot)} />
          {result.text}
        </span>
      </td>
    </tr>
  );
}
