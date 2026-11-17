import { describe, expect, it } from 'vitest';
import { collectionsReport, periodStart } from './collections';
import type { SheetInvoice } from './model';

const inv = (p: Partial<SheetInvoice> & { id: string }): SheetInvoice => ({
  invoiceMonth: '2026-10-01',
  clientName: 'Bupa',
  invoiceNo: null,
  partnerId: 'p1',
  dueDate: '2026-11-10',
  amountInr: 1000,
  status: 'open',
  paidOn: null,
  paidAmount: null,
  paidVia: null,
  partPaid: 0,
  remindersPausedUntil: null,
  pauseReason: null,
  ...p,
});

describe('collectionsReport', () => {
  const today = '2026-11-17';
  const list = [
    inv({ id: 'a', status: 'received', paidOn: '2026-11-08', paidAmount: 1000 }), // 2 days early
    inv({ id: 'b', status: 'received', paidOn: '2026-11-15', paidAmount: 900, clientName: 'Vena' }), // 5 late, short 100
    inv({ id: 'c', status: 'received', paidOn: '2026-11-12', paidAmount: 900, tdsInr: 100 }), // 2 late, TDS covers it
    inv({ id: 'd', status: 'open', dueDate: '2026-11-01' }), // open, 16 days late
    inv({ id: 'e', status: 'open', dueDate: '2026-11-30' }), // open, not due
  ];

  it('splits received invoices into on time and late, and finds short payments', () => {
    const r = collectionsReport(list, { today, period: 'all' });
    expect(r.totals).toMatchObject({ onTime: 1, late: 2, avgDaysLate: 4, openLate: 1, shortPaid: 1, shortPaidInr: 100, onTimePct: 33 });
    expect(r.rows.find((x) => x.id === 'a')).toMatchObject({ result: 'on_time', daysLate: -2 });
    expect(r.rows.find((x) => x.id === 'c')?.shortPaid).toBe(false);
    expect(r.rows.some((x) => x.id === 'e')).toBe(false);
  });

  it('can count open late invoices in the on-time share, and filters by client', () => {
    expect(collectionsReport(list, { today, period: 'all', countOpenLate: true }).totals.onTimePct).toBe(25);
    expect(collectionsReport(list, { today, period: 'all', client: 'Vena' }).totals).toMatchObject({ onTime: 0, late: 1 });
  });

  it('starts the financial year on 1 April and the quarter on its first month', () => {
    expect(periodStart('fy', '2026-11-17')).toBe('2026-04-01');
    expect(periodStart('fy', '2027-02-10')).toBe('2026-04-01');
    expect(periodStart('quarter', '2026-11-17')).toBe('2026-10-01');
    expect(periodStart('month', '2026-11-17')).toBe('2026-11-01');
  });
});
