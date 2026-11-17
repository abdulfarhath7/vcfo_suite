import { daysBetweenIso, monthStart } from './dates';
import type { SheetInvoice } from './model';

/**
 * RECEIVABLES COLLECTIONS — received on time against received late (owner, 17 Nov 2026). Pure; the
 * Collections tab builds everything it shows from this.
 *
 * Rules:
 *  - On time: received (`paidOn`) on or before the due date. Late: after it, by `daysLate` days.
 *  - Still open, late: not received and past its due date on `today`. Counted apart; it enters the
 *    "% on time" only when `countOpenLate` is on.
 *  - Short-paid: an INR invoice where what arrived (all part payments plus the final receipt) and
 *    the TDS deducted together fall more than ₹1 short of what was invoiced. Foreign invoices are
 *    left out, since a gap there is an exchange difference, not a short payment.
 *  - Invoiced amount: the open balance at receipt plus earlier part payments (a part payment lowers
 *    the open balance and adds to `partPaid`; the final receipt leaves the balance as it was).
 *  - Period: received invoices are picked by their received date; open late ones always count.
 */

export type CollectionsPeriod = 'month' | 'quarter' | 'fy' | 'all';

export type CollectionRow = {
  id: string;
  clientName: string;
  invoiceNo: string | null;
  partnerId: string | null;
  dueDate: string;
  paidOn: string | null;
  /** Positive: days late; negative: days early; null while open. */
  daysLate: number | null;
  invoicedInr: number;
  receivedInr: number | null;
  tdsInr: number;
  result: 'on_time' | 'late' | 'open_late';
  shortPaid: boolean;
};

export type Tally = { onTime: number; late: number; onTimeInr: number; lateInr: number; avgDaysLate: number | null };

export type CollectionsReport = {
  rows: CollectionRow[];
  totals: Tally & { openLate: number; openLateInr: number; shortPaid: number; shortPaidInr: number; onTimePct: number | null };
  byMonth: Array<{ month: string } & Tally>;
  byPartner: Array<{ partnerId: string | null } & Tally>;
  byClient: Array<{ clientName: string } & Tally>;
};

/** The first day of the period that holds `today` (India's financial year starts on 1 April). */
export function periodStart(period: CollectionsPeriod, today: string): string | null {
  if (period === 'all') return null;
  if (period === 'month') return monthStart(today);
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (period === 'quarter') {
    const qm = m - ((m - 1) % 3);
    return `${y}-${String(qm).padStart(2, '0')}-01`;
  }
  return m >= 4 ? `${y}-04-01` : `${y - 1}-04-01`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function tally(rows: CollectionRow[]): Tally {
  const onTime = rows.filter((r) => r.result === 'on_time');
  const late = rows.filter((r) => r.result === 'late');
  const sum = (list: CollectionRow[]) => round2(list.reduce((a, r) => a + (r.receivedInr ?? r.invoicedInr), 0));
  return {
    onTime: onTime.length,
    late: late.length,
    onTimeInr: sum(onTime),
    lateInr: sum(late),
    avgDaysLate: late.length ? Math.round(late.reduce((a, r) => a + (r.daysLate ?? 0), 0) / late.length) : null,
  };
}

function groupBy<K extends string>(rows: CollectionRow[], key: (r: CollectionRow) => K): Map<K, CollectionRow[]> {
  const map = new Map<K, CollectionRow[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}

export function collectionsReport(
  invoices: SheetInvoice[],
  opts: { today: string; period: CollectionsPeriod; partnerId?: string | null; client?: string | null; countOpenLate?: boolean },
): CollectionsReport {
  const from = periodStart(opts.period, opts.today);
  const rows: CollectionRow[] = [];
  for (const inv of invoices) {
    if (opts.partnerId !== undefined && opts.partnerId !== null && (inv.partnerId ?? '') !== opts.partnerId) continue;
    if (opts.client && inv.clientName !== opts.client) continue;
    const invoiced = round2(inv.amountInr + (inv.partPaid ?? 0));
    const tds = inv.tdsInr ?? 0;
    if (inv.status === 'received' && inv.paidOn) {
      if (from && inv.paidOn < from) continue;
      const received = round2((inv.paidAmount ?? inv.amountInr) + (inv.partPaid ?? 0));
      const daysLate = daysBetweenIso(inv.dueDate, inv.paidOn);
      const foreign = (inv.currency ?? 'INR').toUpperCase() !== 'INR';
      rows.push({
        id: inv.id,
        clientName: inv.clientName,
        invoiceNo: inv.invoiceNo,
        partnerId: inv.partnerId,
        dueDate: inv.dueDate,
        paidOn: inv.paidOn,
        daysLate,
        invoicedInr: invoiced,
        receivedInr: received,
        tdsInr: tds,
        result: daysLate > 0 ? 'late' : 'on_time',
        shortPaid: !foreign && received + tds < invoiced - 1,
      });
    } else if (inv.status === 'open' && inv.dueDate < opts.today) {
      rows.push({
        id: inv.id,
        clientName: inv.clientName,
        invoiceNo: inv.invoiceNo,
        partnerId: inv.partnerId,
        dueDate: inv.dueDate,
        paidOn: null,
        daysLate: daysBetweenIso(inv.dueDate, opts.today),
        invoicedInr: invoiced,
        receivedInr: null,
        tdsInr: tds,
        result: 'open_late',
        shortPaid: false,
      });
    }
  }
  rows.sort((a, b) => (b.paidOn ?? opts.today).localeCompare(a.paidOn ?? opts.today) || a.clientName.localeCompare(b.clientName));

  const received = rows.filter((r) => r.result !== 'open_late');
  const openLate = rows.filter((r) => r.result === 'open_late');
  const short = received.filter((r) => r.shortPaid);
  const t = tally(received);
  const denominator = t.onTime + t.late + (opts.countOpenLate ? openLate.length : 0);
  return {
    rows,
    totals: {
      ...t,
      openLate: openLate.length,
      openLateInr: round2(openLate.reduce((a, r) => a + r.invoicedInr, 0)),
      shortPaid: short.length,
      shortPaidInr: round2(short.reduce((a, r) => a + (r.invoicedInr - (r.receivedInr ?? 0) - r.tdsInr), 0)),
      onTimePct: denominator ? Math.round((t.onTime / denominator) * 100) : null,
    },
    byMonth: [...groupBy(received, (r) => monthStart(r.paidOn!)).entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, list]) => ({ month, ...tally(list) })),
    byPartner: [...groupBy(received, (r) => (r.partnerId ?? '') as string).entries()].map(([pid, list]) => ({ partnerId: pid || null, ...tally(list) })),
    byClient: [...groupBy(received, (r) => r.clientName).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([clientName, list]) => ({ clientName, ...tally(list) })),
  };
}
