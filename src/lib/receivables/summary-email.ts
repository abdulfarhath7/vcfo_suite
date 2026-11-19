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
 * team already sends: the payments received, then one SBC-orange table, a band per invoice month, with the
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
 * The table theme (owner, 17 Nov 2026; refined 18 Nov 2026): a light peach month title, column
 * heads in orange (#e35f2a, white bold text), rows banded white and a lighter peach with thin grey
 * rules between them, received rows pale green, the month's open total bold under an orange rule,
 * amounts right-aligned in Roboto Mono and the status in colour (overdue red, due today amber,
 * received green). No firm name in the signature.
 */
// The owner's SBC table theme (17 Nov 2026), the same values as email-v2.ts.
const ORANGE = '#e35f2a';
const BAND = '#fdf4f0';
const PAID = '#eef8ea';
const GRID = '#e4e4e4';
const INK = '#1f2328';
const MUTED = '#6b7079';
const AMBER = '#b26a00';
const GREEN = '#2e7d32';
const RED = emailColor('danger');
const SANS = SPECTRUM_EMAIL_FONTS.sans;
const MONO = SPECTRUM_EMAIL_FONTS.mono;
const P = `margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:21px;color:${INK};`;
const CELL = `border-bottom:1px solid ${GRID};padding:5px 10px;font-size:13px;line-height:17px;font-family:${SANS};color:${INK};white-space:nowrap;`;
const TITLE = `padding:6px 10px;font-size:13.5px;line-height:18px;font-family:${SANS};background:#fbe4da;color:${INK};font-weight:bold;border-bottom:1px solid ${GRID};`;
const HEAD = `padding:6px 10px;font-size:12.5px;line-height:16px;font-family:${SANS};background:${ORANGE};color:#ffffff;font-weight:bold;text-align:left;white-space:nowrap;`;
// Every table is the full width of the email (owner, 19 Nov 2026), so the month table and the total line up.
const TABLE = `width:100%;border-collapse:collapse;margin:10px 0 14px;min-width:560px;border:1px solid ${GRID};`;
/** An empty cell: the same dash in the same font everywhere. */
const DASH = `<span style="font-family:${SANS};color:${MUTED};">—</span>`;
const NUM = `font-family:${MONO};text-align:right;`;
const TOTAL = `font-weight:bold;border-top:2px solid ${ORANGE};background:#ffffff;`;

export type SummaryEmailInput = {
  rows: SnapshotRow[];
  today: string;
  liveUrl: string;
  signerName: string;
  /** Optional: only this partner's rows (a per-partner email). */
  partnerSlug?: string | null;
  /** With `partnerSlug`: the client keys the partner is a second partner on; their rows are included too. */
  alsoClientKeys?: string[];
  /** The rows are invoices the person picked on the sheet (owner, 18 Nov 2026): show every one, received or not. */
  picked?: boolean;
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

/**
 * The invoices an email holds, in table order: the partner's rows (when it is a partner's email),
 * then open ones and the ones received this week, or every picked one. The pop-up lists exactly
 * these, so what the person removes and what the email shows always agree.
 */
export function emailRows(input: Pick<SummaryEmailInput, 'rows' | 'today' | 'partnerSlug' | 'alsoClientKeys' | 'picked'>): SnapshotRow[] {
  const rows = input.partnerSlug ? partnerRows(input.rows, input.partnerSlug, input.alsoClientKeys) : input.rows;
  return monthsOf(rows).flatMap((m) =>
    rows.filter((r) => r.invoiceMonth === m && (input.picked || isOpen(r) || receivedThisWeek(r, input.today))).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  );
}

/** "Overdue · 18 days", "Due in 3 days", "Due today" or "Received", with its colour. */
function statusOf(r: SnapshotRow, today: string): { text: string; color: string } {
  if (!isOpen(r)) return { text: 'Received', color: GREEN };
  const dl = daysLeft(r.dueDate, today);
  if (dl < 0) return { text: `Overdue · ${-dl} day${dl === -1 ? '' : 's'}`, color: RED };
  if (dl === 0) return { text: 'Due today', color: AMBER };
  return { text: `Due in ${dl} day${dl === 1 ? '' : 's'}`, color: MUTED };
}

export function summaryEmailHtml(input: SummaryEmailInput): string {
  const shown = emailRows(input);
  const received = shown.filter((r) => receivedThisWeek(r, input.today));
  const paidItems = [...new Set(received.map((r) => `${r.clientName} - ${monthLong(r.invoiceMonth)}`))];
  const paidBlock = paidItems.length
    ? `<p style="${P}">We have received the following payments:</p><ul style="margin:0 0 14px;padding-left:22px;font-family:${SANS};font-size:14px;line-height:22px;color:${INK};">${paidItems
        .map((line) => {
          const [client, ...rest] = line.split(' - ');
          return `<li><b>${escapeHtml(client)}</b> - ${escapeHtml(rest.join(' - '))}</li>`;
        })
        .join('')}</ul>`
    : `<p style="${P}">No new payments have been received since the last update.</p>`;

  const foreign = shown.some(isForeignRow);
  // The sheet's own columns (owner, 18 Nov 2026), with the received date and amount apart.
  const heads: Array<{ label: string; num?: boolean; center?: boolean }> = [
    { label: 'Client' },
    { label: 'Invoice no.' },
    { label: 'Invoice date', center: true },
    { label: 'Partner' },
    { label: 'Due date', center: true },
    ...(foreign ? [{ label: 'Currency', center: true }, { label: foreignAmountHeader(shown.filter(isForeignRow).map((r) => r.currency)), num: true }] : []),
    { label: 'Amount (₹)', num: true },
    { label: 'Received date', center: true },
    { label: 'Received amount (₹)', num: true },
    { label: 'Status' },
  ];
  const cols = heads.length;
  const td = (bg: string, extra = '') => `style="${CELL}background:${bg};${extra}"`;
  // One table for every month (owner, 19 Nov 2026): the column heads once at the top, then a peach
  // band per month, its rows and its open total, so the columns line up and no gap sits between months.
  const monthBlocks = monthsOf(shown)
    .map((m) => {
      const list = shown.filter((r) => r.invoiceMonth === m);
      if (!list.length) return '';
      const body = list
        .map((r, i) => {
          const open = isOpen(r);
          const bg = !open ? PAID : i % 2 === 1 ? BAND : '#ffffff';
          const st = statusOf(r, input.today);
          const fc = foreignAmountOf(r);
          const fx = foreign
            ? `<td ${td(bg, 'text-align:center;')}>${isForeignRow(r) ? escapeHtml((r.currency ?? '').toUpperCase()) : 'INR'}</td><td ${td(bg, NUM)}>${fc === null ? DASH : fcFormat.format(fc)}</td>`
            : '';
          return `<tr><td ${td(bg, 'font-weight:600;')}>${escapeHtml(r.clientName)}</td><td ${td(bg, `font-family:${MONO};font-size:12.5px;`)}>${r.invoiceNo ? escapeHtml(r.invoiceNo) : DASH}</td><td ${td(bg, 'text-align:center;')}>${r.invoiceDate ? sheetDate(r.invoiceDate) : DASH}</td><td ${td(bg)}>${r.partnerName ? escapeHtml(r.partnerName) : DASH}</td><td ${td(bg, 'text-align:center;')}>${sheetDate(r.dueDate)}</td>${fx}<td ${td(bg, NUM)}>${money(open ? r.amountInr : (r.paidAmount ?? r.amountInr) + (r.partPaid ?? 0))}</td><td ${td(bg, 'text-align:center;')}>${!open && r.paidOn ? sheetDate(r.paidOn) : DASH}</td><td ${td(bg, NUM)}>${open ? DASH : money((r.paidAmount ?? r.amountInr) + (r.partPaid ?? 0))}</td><td ${td(bg, `color:${st.color};font-weight:600;`)}>${st.text}</td></tr>`;
        })
        .join('');
      const title = monthBlockTitle(m).replace(' Receivables', '');
      const open = sumInr(list.filter(isOpen));
      return `<tr><td colspan="${cols}" style="${TITLE}">${escapeHtml(title)}</td></tr>${body}<tr><td colspan="${cols - 4}" style="${CELL}${TOTAL}">Still open in ${escapeHtml(monthShort(m))}</td><td style="${CELL}${TOTAL}${NUM}">${money(open)}</td><td colspan="3" style="${CELL}${TOTAL}"></td></tr>`;
    })
    .join('');
  const tables = monthBlocks
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${TABLE}"><tr>${heads
        .map((h) => `<td style="${HEAD}${h.num ? 'text-align:right;' : h.center ? 'text-align:center;' : ''}">${h.label}</td>`)
        .join('')}</tr>${monthBlocks}</table>`
    : '';

  const total = sumInr(shown.filter(isOpen));
  return [
    `<p style="${P}">Hi Team,</p>`,
    paidBlock,
    `<p style="${P}">Please find the receivables summary as of today:</p>`,
    tables,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;min-width:560px;border-collapse:collapse;margin:6px 0 18px;"><tr><td style="padding:10px 14px;background:${BAND};border-left:4px solid ${ORANGE};font-family:${SANS};font-size:14px;color:${INK};">Total receivables (open) <b style="font-family:${MONO};font-size:16px;padding-left:14px;">₹ ${money(total)}</b></td></tr></table>`,
    // Receivables v2: no link to the tool in any receivables email; `liveUrl` is no longer shown.
    // No firm name under the signature (owner, 18 Nov 2026).
    `<p style="${P}">Regards,<br>${signNameSpan(input.signerName)}</p>`,
  ].join('');
}
