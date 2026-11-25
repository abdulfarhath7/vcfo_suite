import { voucherKey, type TallyRow, type TallySalesRegister } from '@/lib/receivables/tally-sales-register';
import type { ReceiptRow, SkippedVoucher, TallyReceipts } from '@/lib/receivables/tally-live/map';
import type { BooksInvoice, BooksPayment } from './books';
import { cleanId, isGstin } from './ids';

/**
 * Zoho Books → the receivables staging rows (docs/specs/integrations/ZOHO.md). Pure. The output has
 * the same shape as the Tally live mappers (src/lib/receivables/tally-live/map.ts), so a Books
 * invoice and a Tally voucher with the same number match the same sheet row, and payments land in
 * the same Awaiting approval panel.
 *
 * Invoices: every invoice that is not draft or void; the amount is the invoice total in INR
 * (total × exchange_rate for a foreign invoice).
 * Payments: one row per invoice the payment was applied to; a payment applied to no invoice is
 * skipped with NOT_APPLIED_REASON. The ref is `zoho:<payment id>:<invoice key>`, so the same payment
 * synced twice is applied once.
 */

export const NOT_APPLIED_REASON = 'Not applied to an invoice in Zoho Books';
const SKIP_STATUS = new Set(['draft', 'void']);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const nameOf = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 120);
const inr = (amount: number, rate: number | undefined) => round2(Number(amount) * (Number(rate) > 0 ? Number(rate) : 1));

export function mapBooksInvoices(invoices: BooksInvoice[], company: string, period: string): TallySalesRegister {
  const rows: TallyRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let skippedStatus = 0;
  invoices.forEach((inv, i) => {
    if (SKIP_STATUS.has((inv.status ?? '').toLowerCase())) {
      skippedStatus += 1;
      return;
    }
    const no = (inv.invoice_number ?? '').trim();
    if (!no) return void warnings.push(`An invoice of ${inv.customer_name || 'no customer'} has no number; skipped.`);
    if (!ISO.test(inv.date ?? '')) return void warnings.push(`${no}: no date; skipped.`);
    const amount = inr(inv.total, inv.exchange_rate);
    if (!Number.isFinite(amount) || amount <= 0) return void warnings.push(`${no}: no amount above zero; skipped.`);
    const clientName = nameOf(inv.customer_name ?? '');
    if (!clientName) return void warnings.push(`${no}: no customer name; skipped.`);
    const invoiceKey = voucherKey(no);
    if (seen.has(invoiceKey)) return void warnings.push(`${no}: the same invoice number appears twice; the first was kept.`);
    seen.add(invoiceKey);
    const gstin = cleanId(inv.gst_no);
    rows.push({ invoiceNo: no.slice(0, 40), invoiceKey, invoiceDate: inv.date, clientName, gstin: isGstin(gstin) ? gstin : null, amountInr: amount, sourceRow: i + 1 });
  });
  if (skippedStatus) warnings.push(`${skippedStatus} draft or void invoice(s) were skipped.`);
  return { company, period, rows, warnings };
}

export function mapBooksPayments(payments: BooksPayment[], company: string, period: string): TallyReceipts {
  const rows: ReceiptRow[] = [];
  const skipped: SkippedVoucher[] = [];
  const seen = new Set<string>();
  for (const p of payments) {
    const voucherNo = (p.payment_number || p.reference_number || p.payment_id || '').trim().slice(0, 40);
    const partyName = nameOf(p.customer_name ?? '');
    const amount = inr(p.amount, p.exchange_rate);
    if (!ISO.test(p.date ?? '')) {
      skipped.push({ voucherNo, partyName, amount, reason: 'No date in Zoho Books' });
      continue;
    }
    const applied = (p.invoices ?? []).filter((i) => (i.invoice_number ?? '').trim() && Number(i.amount_applied) > 0);
    if (!applied.length) {
      skipped.push({ voucherNo, partyName, amount, reason: NOT_APPLIED_REASON });
      continue;
    }
    for (const a of applied) {
      const invoiceNo = a.invoice_number.trim().slice(0, 40);
      const invoiceKey = voucherKey(invoiceNo);
      const ref = `zoho:${p.payment_id}:${invoiceKey}`;
      if (seen.has(ref)) continue;
      seen.add(ref);
      rows.push({ invoiceNo, invoiceKey, amountInr: inr(a.amount_applied, p.exchange_rate), date: p.date, partyName, voucherNo, ref });
    }
  }
  return { company, period, rows, skipped, receiptVouchers: payments.length };
}
