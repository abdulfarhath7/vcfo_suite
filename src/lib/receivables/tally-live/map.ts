import { voucherKey, type TallyRow, type TallySalesRegister } from '../tally-sales-register';
import type { TallyVoucher } from './wire';

/**
 * Tally live sync mappers (docs/specs/receivables/TALLY-LIVE.md). Pure: vouchers in, rows out.
 *
 * Sales: a voucher whose type contains "Sales" (and not "Return"), not cancelled, becomes a
 * `TallyRow`, with the same voucher key and client name rules as the Excel Sales Register parser,
 * so a synced invoice and an uploaded one match the same sheet row.
 *
 * Receipts: a voucher whose type contains "Receipt" gives one receipt row per bill-wise reference;
 * the bill name is the invoice number it pays. A receipt with no named bill cannot be tied to an
 * invoice, so it is reported as skipped with the reason "No bill reference in Tally".
 */

export type ReceiptRow = {
  /** The bill name exactly as Tally wrote it (the invoice number paid). */
  invoiceNo: string;
  invoiceKey: string;
  amountInr: number;
  /** The receipt voucher's date: the day the money arrived. */
  date: string;
  partyName: string;
  voucherNo: string;
  /** `<voucher guid>:<invoice key>`: the same payment synced twice is applied once. */
  ref: string;
};

export type SkippedVoucher = { voucherNo: string; partyName: string; amount: number; reason: string };

export type TallyReceipts = { company: string; period: string; rows: ReceiptRow[]; skipped: SkippedVoucher[]; receiptVouchers: number };

export const NO_BILL_REASON = 'No bill reference in Tally';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clientNameOf = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 120);
const isCancelled = (v: TallyVoucher) => v.cancelled === true;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1 Nov–25 Nov 2026", or "1 Apr 2026–25 Nov 2026" across years. */
export function periodLabel(from: string, to: string): string {
  const part = (iso: string, year: boolean) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[(m ?? 1) - 1]}${year ? ` ${y}` : ''}`;
  };
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${part(from, !sameYear)}–${part(to, true)}`;
}

export function isSalesVoucher(v: TallyVoucher): boolean {
  const t = v.voucherType.toLowerCase();
  return t.includes('sales') && !t.includes('return') && !isCancelled(v);
}

export function isReceiptVoucher(v: TallyVoucher): boolean {
  return v.voucherType.toLowerCase().includes('receipt') && !isCancelled(v);
}

/** Sales vouchers → the rows `stageTallyImport` takes, plus warnings for what was left out. */
export function mapSalesVouchers(vouchers: TallyVoucher[], company: string, period: string): TallySalesRegister {
  const rows: TallyRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let other = 0;
  vouchers.forEach((v, i) => {
    if (!isSalesVoucher(v)) {
      other += 1;
      return;
    }
    const voucherNo = (v.voucherNo ?? '').trim();
    if (!voucherNo) return void warnings.push(`A Sales voucher of ${v.partyName || 'no party'} has no voucher number; skipped.`);
    if (!ISO.test(v.date ?? '')) return void warnings.push(`${voucherNo}: no date; skipped.`);
    if (!Number.isFinite(v.amount) || v.amount <= 0) return void warnings.push(`${voucherNo}: no amount above zero; skipped.`);
    const clientName = clientNameOf(v.partyName ?? '');
    if (!clientName) return void warnings.push(`${voucherNo}: no party name; skipped.`);
    const invoiceKey = voucherKey(voucherNo);
    if (seen.has(invoiceKey)) return void warnings.push(`${voucherNo}: the same voucher number appears twice; the first was kept.`);
    seen.add(invoiceKey);
    const gstin = (v.gstin ?? '').trim().toUpperCase();
    rows.push({ invoiceNo: voucherNo.slice(0, 40), invoiceKey, invoiceDate: v.date, clientName, gstin: gstin || null, amountInr: round2(v.amount), sourceRow: i + 1 });
  });
  if (other) warnings.push(`${other} voucher(s) that are not Sales (or are cancelled) were skipped.`);
  return { company, period, rows, warnings };
}

/** Receipt vouchers → one receipt row per bill reference; receipts without one are skipped. */
export function mapReceiptVouchers(vouchers: TallyVoucher[], company: string, period: string): TallyReceipts {
  const rows: ReceiptRow[] = [];
  const skipped: SkippedVoucher[] = [];
  const seen = new Set<string>();
  let receiptVouchers = 0;
  for (const v of vouchers) {
    if (!isReceiptVoucher(v)) continue;
    receiptVouchers += 1;
    const voucherNo = (v.voucherNo ?? '').trim().slice(0, 40);
    const partyName = clientNameOf(v.partyName ?? '');
    const amount = round2(Number(v.amount) || 0);
    if (!ISO.test(v.date ?? '')) {
      skipped.push({ voucherNo, partyName, amount, reason: 'No date in Tally' });
      continue;
    }
    const bills = (v.bills ?? []).filter((b) => (b?.name ?? '').trim() && Number.isFinite(b.amount) && b.amount > 0);
    if (!bills.length) {
      skipped.push({ voucherNo, partyName, amount, reason: NO_BILL_REASON });
      continue;
    }
    for (const b of bills) {
      const invoiceNo = b.name.trim().slice(0, 40);
      const invoiceKey = voucherKey(invoiceNo);
      const ref = `${v.guid}:${invoiceKey}`;
      if (seen.has(ref)) continue;
      seen.add(ref);
      rows.push({ invoiceNo, invoiceKey, amountInr: round2(b.amount), date: v.date, partyName, voucherNo, ref });
    }
  }
  return { company, period, rows, skipped, receiptVouchers };
}
