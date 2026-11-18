import { emailColor, escapeHtml } from '@/lib/email/email-layout';
import { SPECTRUM_EMAIL_FONTS } from '@/lib/email/spectrum-email-tokens';
import { clientKey } from './client-key';
import { foreignAmountHeader } from './currencies';
import { signNameSpan } from './sign-name';
import { daysLeft, monthBlockTitle, monthLong, monthShort, sheetDate } from './dates';
import type { SnapshotRow } from './model';
import { foreignAmountOf, isForeignRow, isOpen, monthsOf, receivedThisWeek, sumInr } from './summary';

/**
 * RECEIVABLES SUMMARY EMAIL — the body of "RE: Receivables update", in the format SBC's finance
 * team already sends: the payments received, then one SBC-orange table per invoice month with the
 * sheet's own columns (owner, 18 Nov 2026): Client, Invoice no., Invoice date, Partner, Due date,
 * Amount ₹, Received (date and amount) and Status; received rows shaded green, a month total of what
 * is still open, and the total receivables. Built from the live sheet, so the email shows what the
 * table shows. Inline styles, for Outlook.
 *
 * Phase 9: when any row is in a foreign currency, each table gains Currency and foreign amount
 * columns ("USD Amount", or "Foreign Amount" when currencies are mixed) before the INR. With every row in INR the email is exactly the format above.
 */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (n: number) => inr.format(Math.round(n));
const fcFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/*
 * The SBC table theme (owner, 17 Nov 2026), the same as the v2 emails in email-v2.ts: the month
 * title and column heads filled with SBC orange (#e35f2a, white bold text), rows banded white and a
 * light peach, thin grey lines inside and around, totals bold under an orange rule, amounts
 * right-aligned in Roboto Mono, overdue days in red.
 */
// The owner's SBC table theme (17 Nov 2026), the same values as email-v2.ts.
const ORANGE = '#e35f2a';
const ORANGE_EDGE = '#e35f2a';
const BAND = '#fdeee8';
const GRID = '#d6d6d6';
const RED = emailColor('danger');
const SANS = SPECTRUM_EMAIL_FONTS.sans;
const MONO = SPECTRUM_EMAIL_FONTS.mono;
const CELL = `border:1px solid ${GRID};padding:8px 11px;font-size:14px;font-family:${SANS};color:#1a1a1a;`;
const HEAD = `border:1px solid ${GRID};padding:9px 11px;font-size:14px;font-family:${SANS};background:${ORANGE};color:#ffffff;font-weight:bold;text-align:left;`;
const TABLE = `border-collapse:collapse;margin:10px 0;min-width:560px;border:1px solid ${GRID};`;
const NUM = `font-family:${MONO};text-align:right;`;
const TOTAL = `font-weight:bold;border-top:2px solid ${ORANGE_EDGE};`;
const PAID_BG = 'background:#e8f5e3;';

export type SummaryEmailInput = {
  rows: SnapshotRow[];
  today: string;
  liveUrl: string;
  signerName: string;
  /** Optional: only this partner's rows (a per-partner email). */
  partnerSlug?: string | null;
  /** With `partnerSlug`: the client keys the partner is a second partner on; their rows are included too. */
  alsoClientKeys?: string[];
};

export function summaryEmailSubject(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  return `Receivables update - ${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })}`;
}

/** A partner's rows: the clients they lead and the clients they are a second partner on. */
export function partnerRows(rows: SnapshotRow[], partnerSlug: string, alsoClientKeys: string[] = []): SnapshotRow[] {
  const also = new Set(alsoClientKeys);
  return rows.filter((r) => r.partnerSlug === partnerSlug || also.has(clientKey(r.clientName)));
}

export function summaryEmailHtml(input: SummaryEmailInput): string {
  const rows = input.partnerSlug ? partnerRows(input.rows, input.partnerSlug, input.alsoClientKeys) : input.rows;
  const received = rows.filter((r) => receivedThisWeek(r, input.today));
  const paidItems = [...new Set(received.map((r) => `${r.clientName} - ${monthLong(r.invoiceMonth)}`))];
  const paidBlock = paidItems.length
    ? `<p>We have received the following payments:</p><ul>${paidItems
        .map((line) => {
          const [client, ...rest] = line.split(' - ');
          return `<li><b>${escapeHtml(client)}</b> - ${escapeHtml(rest.join(' - '))}</li>`;
        })
        .join('')}</ul>`
    : '<p>No new payments have been received since the last update.</p>';

  const foreign = rows.some(isForeignRow);
  const fxCells = (r: SnapshotRow, bg: string) => {
    if (!foreign) return '';
    const fc = foreignAmountOf(r);
    return `<td style="${CELL}${bg}text-align:center">${isForeignRow(r) ? escapeHtml((r.currency ?? '').toUpperCase()) : 'INR'}</td><td style="${CELL}${bg}${NUM}">${fc === null ? '' : fcFormat.format(fc)}</td>`;
  };
  // The same columns as the sheet in the app (owner, 18 Nov 2026).
  const heads = [
    'Client',
    'Invoice no.',
    'Invoice date',
    'Partner',
    'Due date',
    ...(foreign ? ['Currency', foreignAmountHeader(rows.filter(isForeignRow).map((r) => r.currency))] : []),
    'Amount ₹',
    'Received',
    'Status',
  ];
  const cols = heads.length;
  const tables = monthsOf(rows)
    .map((m) => {
      const list = rows
        .filter((r) => r.invoiceMonth === m && (isOpen(r) || receivedThisWeek(r, input.today)))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      if (!list.length) return '';
      const body = list
        .map((r, i) => {
          const open = isOpen(r);
          const bg = open ? (i % 2 === 1 ? `background:${BAND};` : 'background:#ffffff;') : PAID_BG;
          const dl = daysLeft(r.dueDate, input.today);
          const late = open && dl < 0;
          const red = late ? `color:${RED};` : '';
          const status = !open ? 'Received' : late ? `${-dl}d late` : dl === 0 ? 'Due today' : `Due in ${dl}d`;
          const received = open ? '—' : `${r.paidOn ? sheetDate(r.paidOn) : ''}${r.paidOn ? ' · ' : ''}${money(r.paidAmount ?? r.amountInr)}`;
          return `<tr><td style="${CELL}${bg}">${escapeHtml(r.clientName)}</td><td style="${CELL}${bg}">${escapeHtml(r.invoiceNo ?? '—')}</td><td style="${CELL}${bg}text-align:center">${r.invoiceDate ? sheetDate(r.invoiceDate) : '—'}</td><td style="${CELL}${bg}">${escapeHtml(r.partnerName ?? '—')}</td><td style="${CELL}${bg}text-align:center">${sheetDate(r.dueDate)}</td>${fxCells(r, bg)}<td style="${CELL}${bg}${NUM}${red}">${money(open ? r.amountInr : (r.paidAmount ?? r.amountInr))}</td><td style="${CELL}${bg}text-align:center">${received}</td><td style="${CELL}${bg}${red}${late ? 'font-weight:bold;' : ''}">${status}</td></tr>`;
        })
        .join('');
      const title = monthBlockTitle(m).replace(' Receivables', ' -Receivables');
      const blank = (n: number) => Array.from({ length: n }, () => `<td style="${CELL}${TOTAL}"></td>`).join('');
      return `<table style="${TABLE}"><tr><td colspan="${cols}" style="${HEAD}">${escapeHtml(title)}</td></tr><tr>${heads
        .map((h) => `<td style="${HEAD}">${h}</td>`)
        .join('')}</tr>${body}<tr><td style="${CELL}${TOTAL}">${escapeHtml(monthShort(m))} - open</td>${blank(cols - 4)}<td style="${CELL}${TOTAL}${NUM}">${money(sumInr(list.filter(isOpen)))}</td>${blank(2)}</tr></table>`;
    })
    .join('');

  const total = sumInr(rows.filter(isOpen));
  return [
    '<p>Hi Team,</p>',
    paidBlock,
    '<p>Please find the receivable summary as of today:</p>',
    tables,
    `<table style="${TABLE}margin-top:0"><tr><td style="${HEAD}width:40%">Total Receivables</td><td style="${CELL}${NUM}font-weight:bold">${money(total)}</td></tr></table>`,
    // Receivables v2: no link to the tool in any receivables email; `liveUrl` is no longer shown.
    `<p>Regards,<br>${signNameSpan(input.signerName)}<br>SBC</p>`,
  ].join('');
}
