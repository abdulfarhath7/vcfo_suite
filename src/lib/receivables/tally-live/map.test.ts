import { describe, expect, it } from 'vitest';
import { voucherKey } from '../tally-sales-register';
import { NO_BILL_REASON, mapReceiptVouchers, mapSalesVouchers, periodLabel } from './map';
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
