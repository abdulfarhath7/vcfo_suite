import { describe, expect, it } from 'vitest';
import { mapBooksInvoices, mapBooksPayments, NOT_APPLIED_REASON } from './books-map';
import type { BooksInvoice, BooksPayment } from './books';

const inv = (p: Partial<BooksInvoice>): BooksInvoice => ({ invoice_id: 'i', invoice_number: 'INV-1', customer_id: 'c', customer_name: 'Machinify Inc', date: '2026-11-03', status: 'sent', total: 1000, balance: 1000, ...p });

describe('Books invoices to staged rows', () => {
  it('maps sent invoices, converts foreign totals to INR and skips drafts and void', () => {
    const r = mapBooksInvoices(
      [inv({}), inv({ invoice_number: 'INV-2', total: 100, exchange_rate: 83.5, gst_no: '29abcde1234f1z5' }), inv({ invoice_number: 'INV-3', status: 'draft' }), inv({ invoice_number: 'INV-4', status: 'void' })],
      'SBC',
      'Nov',
    );
    expect(r.rows.map((x) => [x.invoiceNo, x.amountInr, x.gstin])).toEqual([
      ['INV-1', 1000, null],
      ['INV-2', 8350, '29ABCDE1234F1Z5'],
    ]);
    expect(r.warnings.join(' ')).toContain('2 draft or void');
  });

  it('keeps the first of a duplicate number and warns on missing fields', () => {
    const r = mapBooksInvoices([inv({}), inv({}), inv({ invoice_number: '' }), inv({ invoice_number: 'X', date: '' })], 'SBC', 'Nov');
    expect(r.rows).toHaveLength(1);
    expect(r.warnings).toHaveLength(3);
  });
});

describe('Books payments to staged rows', () => {
  const pay = (p: Partial<BooksPayment>): BooksPayment => ({ payment_id: 'p1', payment_number: '7', customer_id: 'c', customer_name: 'Machinify', date: '2026-11-10', amount: 1500, ...p });

  it('gives one row per applied invoice with a stable ref', () => {
    const r = mapBooksPayments(
      [pay({ invoices: [{ invoice_id: 'a', invoice_number: 'INV-1', amount_applied: 1000 }, { invoice_id: 'b', invoice_number: 'INV-2', amount_applied: 500 }, { invoice_id: 'c', invoice_number: 'INV-3', amount_applied: 0 }] })],
      'SBC',
      'Nov',
    );
    expect(r.rows.map((x) => [x.invoiceNo, x.amountInr, x.ref])).toEqual([
      ['INV-1', 1000, 'zoho:p1:' + r.rows[0]!.invoiceKey],
      ['INV-2', 500, 'zoho:p1:' + r.rows[1]!.invoiceKey],
    ]);
    expect(r.receiptVouchers).toBe(1);
  });

  it('skips a payment applied to nothing', () => {
    const r = mapBooksPayments([pay({ invoices: [] })], 'SBC', 'Nov');
    expect(r.rows).toHaveLength(0);
    expect(r.skipped[0]).toMatchObject({ reason: NOT_APPLIED_REASON, amount: 1500 });
  });
});
