import { emailColor, escapeHtml } from '@/lib/email/email-layout';
import { SPECTRUM_EMAIL_FONTS } from '@/lib/email/spectrum-email-tokens';
import { clientKey } from './client-key';
import { foreignAmountHeader } from './currencies';
import { signNameSpan } from './sign-name';
import { partOf, type TemplateOverride } from './templates';
import { daysLeft, monthBlockTitle, monthLong, monthShort, sheetDate } from './dates';
import type { SnapshotRow } from './model';
import { foreignAmountOf, isForeignRow, isOpen, monthsOf, receivedThisWeek, sumInr } from './summary';
import { croreLabel, depositsTotal, type DepositsSection } from './deposits';

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
 * heads in orange (#e35f2a, white bold text), rows white (no alternate colour since 23 Nov 2026) with thin grey
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
const MUTED = '#6b7079';
const AMBER = '#b26a00';
const GREEN = '#2e7d32';
const RED = emailColor('danger');
const SANS = SPECTRUM_EMAIL_FONTS.sans;
const P = `margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:21px;color:${INK};`;
const CELL = `border-bottom:1px solid ${GRID};padding:5px 10px;font-size:13px;line-height:17px;font-family:${SANS};color:${INK};white-space:nowrap;`;
const TITLE = `padding:6px 10px;font-size:13.5px;line-height:18px;font-family:${SANS};background:#fbe4da;color:${INK};font-weight:bold;border-bottom:1px solid ${GRID};`;
const HEAD = `padding:6px 10px;font-size:12.5px;line-height:16px;font-family:${SANS};background:${ORANGE};color:#ffffff;font-weight:bold;text-align:left;white-space:nowrap;`;
// Every table is the full width of the email (owner, 19 Nov 2026), so the month table and the total line up.
const TABLE = `width:100%;border-collapse:collapse;margin:10px 0 14px;min-width:560px;border:1px solid ${GRID};`;
/** An empty cell: the same dash in the same font everywhere. */
const DASH = `<span style="font-family:${SANS};color:${MUTED};">—</span>`;
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
  /**
   * The security deposits section (owner, 23 Nov 2026): typed or pasted in the Send email pop-up,
   * for the leaders' email only. It is never drawn on a partner's email (`partnerSlug`).
   */
  deposits?: DepositsSection | null;
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
  const heads: Array<{ label: string; num?: boolean; center?: boolean; width?: string }> = [
    { label: 'Client', width: '22%' },
    { label: 'Invoice no.' },
    { label: 'Invoice date', center: true },
    { label: 'Partner', width: '13%' },
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
        .map((r) => {
          const open = isOpen(r);
          // No alternate row colour (owner, 23 Nov 2026): only a received row is shaded, in green.
          const bg = !open ? PAID : '#ffffff';
          const st = statusOf(r, input.today);
          const fc = foreignAmountOf(r);
          const fx = foreign
            ? `<td ${td(bg, 'text-align:center;')}>${isForeignRow(r) ? escapeHtml((r.currency ?? '').toUpperCase()) : 'INR'}</td><td ${td(bg, NUM)}>${fc === null ? DASH : fcFormat.format(fc)}</td>`
            : '';
          return `<tr${input.marks ? ` data-inv="${escapeHtml(r.id)}"` : ''}><td ${td(bg, `font-weight:600;${WRAP}`)}>${escapeHtml(r.clientName)}</td><td ${td(bg, 'font-size:12.5px;')}>${r.invoiceNo ? escapeHtml(r.invoiceNo) : DASH}</td><td ${td(bg, 'text-align:center;')}>${r.invoiceDate ? sheetDate(r.invoiceDate) : DASH}</td><td ${td(bg, WRAP)}>${r.partnerName ? escapeHtml(r.partnerName) : DASH}</td><td ${td(bg, 'text-align:center;')}>${sheetDate(r.dueDate)}</td>${fx}<td ${td(bg, NUM)}>${money(open ? r.amountInr : (r.paidAmount ?? r.amountInr) + (r.partPaid ?? 0))}</td><td ${td(bg, 'text-align:center;')}>${!open && r.paidOn ? sheetDate(r.paidOn) : DASH}</td><td ${td(bg, NUM)}>${open ? DASH : money((r.paidAmount ?? r.amountInr) + (r.partPaid ?? 0))}</td><td ${td(bg, `color:${st.color};font-weight:600;`)}>${st.text}</td></tr>`;
        })
        .join('');
      const title = monthBlockTitle(m).replace(' Receivables', '');
      const open = sumInr(list.filter(isOpen));
      return `<tr><td colspan="${cols}" style="${TITLE}">${escapeHtml(title)}</td></tr>${body}<tr><td colspan="${cols - 4}" style="${CELL}${TOTAL}">Still open in ${escapeHtml(monthShort(m))}</td><td style="${CELL}${TOTAL}${NUM}">${money(open)}</td><td colspan="3" style="${CELL}${TOTAL}"></td></tr>`;
    })
    .join('');
  const tables = monthBlocks
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${TABLE}"><tr>${heads
        .map((h) => `<td${h.width ? ` width="${h.width}"` : ''} style="${HEAD}${h.width ? `width:${h.width};` : ''}${h.num ? 'text-align:right;' : h.center ? 'text-align:center;' : ''}">${h.label}</td>`)
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
    // The security deposits, a section of its own after the receivables total; nothing when absent.
    input.partnerSlug ? '' : depositsSectionHtml(input.deposits, input.marks),
    // Receivables v2: no link to the tool in any receivables email; `liveUrl` is no longer shown.
    // No firm name under the signature (owner, 18 Nov 2026).
    closing !== null ? paras(closing) : '',
    `<p style="${P}">Regards,<br>${signNameSpan(input.signerName)}</p>`,
  ].join('');
}

/*
 * The security deposits section (owner, 23 Nov 2026). It sits after the receivables table and its
 * total box, under its own heading, in its own table (Client, Amount and Remarks) with the same orange column heads, so it reads
 * as part of the same email but clearly as a different list. Its total row carries the sum and the
 * crore figure. In the pop-up (`marks`) it is wrapped in comment markers and a block the person
 * cannot edit in place: the rows are edited in the pop-up's own form, and `withDepositsSection`
 * swaps the block when they change. The send route always draws it again from the rows it checked.
 */
const DEPOSITS_START = '<!--deposits-->';
const DEPOSITS_END = '<!--/deposits-->';
const DEPOSITS_HEADING = `margin:28px 0 4px;font-family:${SANS};font-size:15px;line-height:21px;font-weight:bold;color:${INK};`;

export function depositsSectionHtml(deposits: DepositsSection | null | undefined, marks = false): string {
  if (!deposits?.rows.length) return '';
  // Client, amount and remarks only (owner, 23 Nov 2026).
  const heads: Array<{ label: string; num?: boolean; width: string }> = [
    { label: 'Client', width: '40%' },
    { label: 'Amount (₹)', num: true, width: '20%' },
    { label: 'Remarks', width: '40%' },
  ];
  const td = (bg: string, extra = '') => `style="${CELL}background:${bg};${extra}"`;
  const body = deposits.rows
    .map((r) => {
      const bg = '#ffffff';
      const amount = r.totalInr === null ? '' : money(r.totalInr);
      return `<tr><td ${td(bg, `font-weight:600;${WRAP}`)}>${escapeHtml(r.client)}</td><td ${td(bg, NUM)}>${amount}</td><td ${td(bg, WRAP)}>${escapeHtml(r.remarks)}</td></tr>`;
    })
    .join('');
  const total = depositsTotal(deposits.rows);
  const totalRow = `<tr><td style="${CELL}${TOTAL}">Total</td><td style="${CELL}${TOTAL}${NUM}">${money(total)}</td><td style="${CELL}${TOTAL}">${croreLabel(total)}</td></tr>`;
  const html = `<p style="${DEPOSITS_HEADING}">${escapeHtml(deposits.title)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${TABLE}"><tr>${heads
    .map((h) => `<td width="${h.width}" style="${HEAD}width:${h.width};${h.num ? 'text-align:right;' : ''}">${h.label}</td>`)
    .join('')}</tr>${body}${totalRow}</table>`;
  return marks ? `${DEPOSITS_START}<div data-deposits="" contenteditable="false">${html}</div>${DEPOSITS_END}` : html;
}

const DEPOSITS_BLOCK = /<!--deposits-->[\s\S]*?<!--\/deposits-->/g;
const REGARDS = /<p[^>]*>Regards,/;

/**
 * Puts `section` (or nothing, when it is empty) where the deposits block of `html` is, and drops
 * any other copy. Without a block it goes in before "Regards,", or at the end. The pop-up uses it
 * when the rows change; the send route uses it to replace whatever the body holds with the section
 * drawn from the rows it checked, so the section is in an email only when the request carried it.
 */
export function withDepositsSection(html: string, section: string): string {
  let placed = false;
  const out = html.replace(DEPOSITS_BLOCK, () => {
    if (placed) return '';
    placed = true;
    return section;
  });
  if (placed || !section) return out;
  const m = REGARDS.exec(out);
  return m ? `${out.slice(0, m.index)}${section}${out.slice(m.index)}` : `${out}${section}`;
}
