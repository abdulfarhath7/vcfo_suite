import { escapeHtml } from '@/lib/email/email-layout';
import { SPECTRUM_EMAIL_FONTS } from '@/lib/email/spectrum-email-tokens';
import { clientKey } from './client-key';
import { signNameSpan } from './sign-name';
import { partOf, type TemplateOverride } from './templates';
import { monthBlockTitle, monthLong, monthShort } from './dates';
import type { SnapshotRow } from './model';
import { isOpen, monthsOf, receivedThisWeek, sumInr } from './summary';

/**
 * RECEIVABLES SUMMARY EMAIL — the body of "RE: Receivables update", in the format SBC's finance
 * team already sends: the payments received, then one SBC-orange table, a band per invoice month, with
 * three columns only (owner, 23 Nov 2026): Client, Amount ₹ and Remarks; received rows shaded green,
 * a month total of what is still open, and the total receivables. Built from the live sheet. Inline
 * styles, for Outlook.
 *
 * Remarks are typed in the Send email pop-up, in the table itself; a received row starts with
 * "Received". They are not saved on the sheet. A foreign invoice shows its INR amount only.
 */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (n: number) => inr.format(Math.round(n));

/*
 * The table theme (owner, 17 Nov 2026; refined 18 Nov 2026): a light peach month title, column
 * heads in orange (#e35f2a, white bold text), rows banded white and a lighter peach with thin grey
 * rules between them, received rows pale green, the month's open total bold under an orange rule,
 * amounts right-aligned in Roboto with even-width digits (owner, 19 Nov 2026: no typewriter font) and the status in colour (overdue red, due today amber,
 * received green). No firm name in the signature.
 */
// The owner's SBC table theme (17 Nov 2026), the same values as email-v2.ts.
const ORANGE = '#e35f2a';
const BAND = '#fdf4f0';
const PAID = '#eef8ea';
const GRID = '#e4e4e4';
const INK = '#1f2328';
const SANS = SPECTRUM_EMAIL_FONTS.sans;
const P = `margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:21px;color:${INK};`;
const CELL = `border-bottom:1px solid ${GRID};padding:5px 10px;font-size:13px;line-height:17px;font-family:${SANS};color:${INK};white-space:nowrap;`;
const TITLE = `padding:6px 10px;font-size:13.5px;line-height:18px;font-family:${SANS};background:#fbe4da;color:${INK};font-weight:bold;border-bottom:1px solid ${GRID};`;
const HEAD = `padding:6px 10px;font-size:12.5px;line-height:16px;font-family:${SANS};background:${ORANGE};color:#ffffff;font-weight:bold;text-align:left;white-space:nowrap;`;
// Every table is the full width of the email (owner, 19 Nov 2026), so the month table and the total line up.
const TABLE = `width:100%;border-collapse:collapse;margin:10px 0 14px;min-width:560px;border:1px solid ${GRID};`;
// Amounts in Roboto with even-width digits, so the digits still line up (owner, 19 Nov 2026).
const NUM = `font-family:${SANS};font-variant-numeric:tabular-nums;text-align:right;`;
// A long client or partner name wraps onto a second line instead of pushing the other columns
// out of place; the other cells stay on one line (owner, 19 Nov 2026).
const WRAP = 'white-space:normal;';
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
  /** The sheet's saved words for this email (the Templates tab, owner 19 Nov 2026). */
  template?: TemplateOverride;
  /** Who the greeting names: a first name, or "Team" (the default) for the leaders' email. */
  greetName?: string;
  /** The client organisation, for the {sheet} placeholder. */
  sheetName?: string;
  /** Marks each invoice row with `data-inv`, for ✕ in the Send email pop-up; removed before sending. */
  marks?: boolean;
  /** Remarks typed in the Send email pop-up, by invoice id. A received row without one says "Received". */
  remarks?: Record<string, string>;
};

const longDay = (today: string) => {
  const d = new Date(`${today}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })}`;
};

/** "Receivables update - 3 November", or the sheet's saved subject with {date} and {sheet} filled. */
export function summaryEmailSubject(today: string, template?: TemplateOverride, sheetName = ''): string {
  return partOf(template, 'subject', { date: longDay(today), sheet: sheetName }) ?? `Receivables update - ${longDay(today)}`;
}

/** Saved template text as paragraphs: escaped, a blank line starts a new paragraph. */
const paras = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `<p style="${P}">${escapeHtml(t).replace(/\n/g, '<br>')}</p>`)
    .join('');

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

  // Client, amount and remarks only (owner, 23 Nov 2026).
  const heads: Array<{ label: string; num?: boolean; width: string }> = [
    { label: 'Client', width: '42%' },
    { label: 'Amount (₹)', num: true, width: '20%' },
    { label: 'Remarks', width: '38%' },
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
          const remark = input.remarks?.[r.id] ?? (open ? '' : 'Received');
          return `<tr${input.marks ? ` data-inv="${escapeHtml(r.id)}"` : ''}><td ${td(bg, `font-weight:600;${WRAP}`)}>${escapeHtml(r.clientName)}</td><td ${td(bg, NUM)}>${money(open ? r.amountInr : (r.paidAmount ?? r.amountInr) + (r.partPaid ?? 0))}</td><td${input.marks ? ' data-remark=""' : ''} ${td(bg, WRAP)}>${escapeHtml(remark)}</td></tr>`;
        })
        .join('');
      const title = monthBlockTitle(m).replace(' Receivables', '');
      const open = sumInr(list.filter(isOpen));
      return `<tr><td colspan="${cols}" style="${TITLE}">${escapeHtml(title)}</td></tr>${body}<tr><td style="${CELL}${TOTAL}">Still open in ${escapeHtml(monthShort(m))}</td><td style="${CELL}${TOTAL}${NUM}">${money(open)}</td><td style="${CELL}${TOTAL}"></td></tr>`;
    })
    .join('');
  const tables = monthBlocks
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${TABLE}"><tr>${heads
        .map((h) => `<td width="${h.width}" style="${HEAD}width:${h.width};${h.num ? 'text-align:right;' : ''}">${h.label}</td>`)
        .join('')}</tr>${monthBlocks}</table>`
    : '';

  const total = sumInr(shown.filter(isOpen));
  const vars = { name: input.greetName || 'Team', date: longDay(input.today), total: money(total), sheet: input.sheetName ?? '' };
  const greeting = partOf(input.template, 'greeting', vars) ?? `Hi ${vars.name},`;
  const intro = partOf(input.template, 'intro', vars);
  const closing = partOf(input.template, 'closing', vars);
  return [
    `<p style="${P}">${escapeHtml(greeting)}</p>`,
    paidBlock,
    intro !== null ? paras(intro) : `<p style="${P}">Please find the receivables summary as of today:</p>`,
    tables,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;min-width:560px;border-collapse:collapse;margin:6px 0 18px;"><tr><td style="padding:10px 14px;background:${BAND};border-left:4px solid ${ORANGE};font-family:${SANS};font-size:14px;color:${INK};">Total receivables (open) <b style="font-family:${SANS};font-variant-numeric:tabular-nums;font-size:16px;padding-left:14px;">₹ ${money(total)}</b></td></tr></table>`,
    // Receivables v2: no link to the tool in any receivables email; `liveUrl` is no longer shown.
    // No firm name under the signature (owner, 18 Nov 2026).
    closing !== null ? paras(closing) : '',
    `<p style="${P}">Regards,<br>${signNameSpan(input.signerName)}</p>`,
  ].join('');
}
