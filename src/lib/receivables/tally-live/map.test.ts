import { describe, expect, it } from 'vitest';
import { voucherKey } from '../tally-sales-register';
import { NO_BILL_REASON, ON_ACCOUNT_REASON, REVERSAL_REASON, mapReceiptVouchers, mapSalesVouchers, periodLabel } from './map';
import type { TallyVoucher } from './wire';

const v = (over: Partial<TallyVoucher>): TallyVoucher => ({
  guid: 'g-1',
  voucherType: 'Sales',
  voucherNo: 'SCSPL/26-27/0164',
  date: '2026-11-03',
  partyName: '  Duravant   India  ',
  gstin: '29abcde1234f1z5',
  amount: 118000,
  ...over,
});

describe('periodLabel', () => {
  it('names the year once within a year and twice across years', () => {
    expect(periodLabel('2026-11-01', '2026-11-25')).toBe('1 Nov–25 Nov 2026');
    expect(periodLabel('2025-04-01', '2026-03-31')).toBe('1 Apr 2025–31 Mar 2026');
  });
});

describe('mapSalesVouchers', () => {
  it('maps a Sales voucher with the Excel parser rules', () => {
    const out = mapSalesVouchers([v({})], 'Summit', '1 Nov–25 Nov 2026');
    expect(out.rows).toEqual([
      { invoiceNo: 'SCSPL/26-27/0164', invoiceKey: voucherKey('SCSPL/26-27/164'), invoiceDate: '2026-11-03', clientName: 'Duravant India', gstin: '29ABCDE1234F1Z5', amountInr: 118000, sourceRow: 1 },
    ]);
    expect(out.company).toBe('Summit');
  });

  it('keeps custom Sales types and leaves out returns, receipts and cancelled vouchers', () => {
    const out = mapSalesVouchers(
      [
        v({ voucherType: 'Sales - Export', voucherNo: 'E/1' }),
        v({ voucherType: 'Sales Return', voucherNo: 'R/1' }),
        v({ voucherType: 'Receipt', voucherNo: 'RC/1' }),
        v({ voucherNo: 'C/1', cancelled: true }),
      ],
      '',
      '',
    );
    expect(out.rows.map((r) => r.invoiceNo)).toEqual(['E/1']);
    expect(out.warnings.join(' ')).toContain('3 voucher(s)');
  });

  it('warns about a repeated voucher number, no amount and no party', () => {
    const out = mapSalesVouchers([v({ voucherNo: 'A/01' }), v({ voucherNo: 'A/1', guid: 'g-2' }), v({ voucherNo: 'B/1', amount: 0 }), v({ voucherNo: 'C/1', partyName: ' ' })], '', '');
    expect(out.rows).toHaveLength(1);
    expect(out.warnings).toHaveLength(3);
  });
});

describe('mapSalesVouchers with sides (connector 0.2+)', () => {
  it('keeps a debit Sales voucher and leaves out one that credits the party', () => {
    const out = mapSalesVouchers(
      [v({ voucherNo: 'S/1', direction: 'debit', bills: [{ name: 'S/1', amount: 118000, direction: 'debit', billType: 'New Ref', creditPeriod: '30 Days' }] }), v({ guid: 'g-2', voucherNo: 'S/2', direction: 'credit', amount: 5900 })],
      '',
      '',
    );
    expect(out.rows.map((r) => r.invoiceNo)).toEqual(['S/1']);
    expect(out.warnings).toEqual(['S/2: credits the party in Tally (a return or reversal entered as Sales); skipped.']);
  });
});

describe('mapReceiptVouchers with bill types and sides (connector 0.2+)', () => {
  const r = (over: Partial<TallyVoucher>) => v({ voucherType: 'Receipt', direction: 'credit', date: '2026-11-20', ...over });

  it('matches Agst Ref bills and skips on-account and advance parts with a reason', () => {
    const out = mapReceiptVouchers(
      [
        r({
          guid: 'r-1',
          voucherNo: 'RC/7',
          amount: 150000,
          bills: [
            { name: 'SCSPL/26-27/0164', amount: 112100, direction: 'credit', billType: 'Agst Ref' },
            { name: 'ADV/1', amount: 20000, direction: 'credit', billType: 'Advance' },
            { name: '', amount: 17900, direction: 'credit', billType: 'On Account' },
          ],
        }),
        r({ guid: 'r-2', voucherNo: 'RC/8', amount: 9000, bills: [{ name: '', amount: 9000, direction: 'credit', billType: 'On Account' }] }),
      ],
      '',
      '',
    );
    expect(out.rows.map((x) => [x.invoiceNo, x.amountInr])).toEqual([['SCSPL/26-27/0164', 112100]]);
    expect(out.skipped).toEqual([
      { voucherNo: 'RC/7', partyName: 'Duravant India', amount: 20000, reason: ON_ACCOUNT_REASON },
      { voucherNo: 'RC/7', partyName: 'Duravant India', amount: 17900, reason: ON_ACCOUNT_REASON },
      { voucherNo: 'RC/8', partyName: 'Duravant India', amount: 9000, reason: ON_ACCOUNT_REASON },
    ]);
  });

  it('skips a reversal: a receipt that debits the party, or a bill debited on a receipt', () => {
    const out = mapReceiptVouchers(
      [
        r({ guid: 'r-3', voucherNo: 'RC/9', direction: 'debit', amount: 10000, bills: [{ name: 'SCSPL/26-27/0164', amount: 10000, direction: 'debit', billType: 'Agst Ref' }] }),
        r({
          guid: 'r-4',
          voucherNo: 'RC/10',
          amount: 100,
          bills: [
            { name: 'A/1', amount: 120, direction: 'credit', billType: 'Agst Ref' },
            { name: 'A/2', amount: 20, direction: 'debit', billType: 'Agst Ref' },
          ],
        }),
      ],
      '',
      '',
    );
    expect(out.rows.map((x) => [x.invoiceNo, x.amountInr])).toEqual([['A/1', 120]]);
    expect(out.skipped).toEqual([
      { voucherNo: 'RC/9', partyName: 'Duravant India', amount: 10000, reason: REVERSAL_REASON },
      { voucherNo: 'RC/10', partyName: 'Duravant India', amount: 20, reason: REVERSAL_REASON },
    ]);
  });

  it('keeps matching a New Ref bill by name, as before', () => {
    const out = mapReceiptVouchers([r({ guid: 'r-5', bills: [{ name: 'B/1', amount: 50, direction: 'credit', billType: 'New Ref' }] })], '', '');
    expect(out.rows.map((x) => x.invoiceNo)).toEqual(['B/1']);
  });
});

describe('mapReceiptVouchers', () => {
  it('gives one row per bill reference and skips a receipt with none', () => {
    const out = mapReceiptVouchers(
      [
        v({ guid: 'r-1', voucherType: 'Receipt', voucherNo: 'RC/7', date: '2026-11-20', amount: 150000, bills: [{ name: 'SCSPL/26-27/0164', amount: 100000 }, { name: 'SCSPL/26-27/170', amount: 50000 }] }),
        v({ guid: 'r-2', voucherType: 'Receipt', voucherNo: 'RC/8', amount: 9000, bills: [] }),
        v({ guid: 'r-3', voucherType: 'Receipt', voucherNo: 'RC/9', amount: 500, bills: [{ name: '  ', amount: 500 }] }),
        v({ guid: 's-1' }),
      ],
      'Summit',
      'p',
    );
    expect(out.receiptVouchers).toBe(3);
    expect(out.rows).toEqual([
      { invoiceNo: 'SCSPL/26-27/0164', invoiceKey: voucherKey('SCSPL/26-27/164'), amountInr: 100000, date: '2026-11-20', partyName: 'Duravant India', voucherNo: 'RC/7', ref: `r-1:${voucherKey('SCSPL/26-27/164')}` },
      { invoiceNo: 'SCSPL/26-27/170', invoiceKey: voucherKey('SCSPL/26-27/170'), amountInr: 50000, date: '2026-11-20', partyName: 'Duravant India', voucherNo: 'RC/7', ref: `r-1:${voucherKey('SCSPL/26-27/170')}` },
    ]);
    expect(out.skipped).toEqual([
      { voucherNo: 'RC/8', partyName: 'Duravant India', amount: 9000, reason: NO_BILL_REASON },
      { voucherNo: 'RC/9', partyName: 'Duravant India', amount: 500, reason: NO_BILL_REASON },
    ]);
  });
});
