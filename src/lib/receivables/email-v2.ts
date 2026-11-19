import { emailColor, escapeHtml } from '@/lib/email/email-layout';
import { SPECTRUM_EMAIL_FONTS } from '@/lib/email/spectrum-email-tokens';
import { daysLeft, sheetDate } from './dates';
import { signNameSpan } from './sign-name';

/**
 * RECEIVABLES v2 EMAILS — pure HTML and text builders (docs/specs/receivables/V2.md).
 *
 * The body is plain white with dark text: no coloured band, no header, no button. Only the tables
 * carry the SBC theme: an SBC orange header row with white bold text, rows alternating white and a
 * light peach, thin grey lines inside and around, a bold total row under an orange rule, amounts
 * right-aligned in Roboto Mono and overdue amounts in red. The
 * content is at most 560 px wide and each table scrolls inside itself on a phone. Every table shows
 * Invoice no., Invoice date, Due date and Amount ₹. There is never a link to the tool. Each email
 * closes with "Regards, <sender name>" (no firm name, owner 18 Nov 2026).
 *
 * Colours: the owner's own SBC table theme (see the constants below), not the app's purple `brand`.
 */

const SANS = SPECTRUM_EMAIL_FONTS.sans;
const MONO = SPECTRUM_EMAIL_FONTS.mono;
/*
 * The SBC table theme the owner picked on 17 Nov 2026 (the firm's "MY DAY" email): an SBC orange
 * header row (#e35f2a) with white bold text, rows banded white and a light peach (#fdeee8), and
 * thin grey grid lines (#d6d6d6) inside and around. These three are the owner's own values and win
 * over the design tokens for email tables; red stays the `danger` token.
 */
const INK = '#1a1a1a';
const MUTED = '#6b7079';
const ORANGE = '#e35f2a';
const ORANGE_EDGE = '#e35f2a';
const ORANGE_ROW = '#fdf4f0';
const GRID = '#e4e4e4';
const RED = emailColor('danger');

export type EmailInvoice = {
  clientName: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  dueDate: string;
  amountInr: number;
};

export type BuiltEmail = { subject: string; html: string; text: string };

/** 1234567.5 → "12,34,567.50" (Indian grouping). */
export function inrText(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const esc = (s: string | null | undefined) => escapeHtml(s ?? '');
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there';

function p(html: string): string {
  return `<p style="margin:0 0 14px;font-family:${SANS};font-size:14px;line-height:21px;color:${INK};">${html}</p>`;
}

function h(text: string, level: 2 | 3): string {
  const size = level === 2 ? 15 : 13.5;
  return `<p style="margin:${level === 2 ? 22 : 14}px 0 8px;font-family:${SANS};font-size:${size}px;line-height:20px;font-weight:700;color:${INK};">${esc(text)}</p>`;
}

/** The plain white page, at most 560 px wide. */
function page(title: string, bodyHtml: string, senderName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-collapse:collapse;">
<tr><td style="font-family:${SANS};font-size:14px;line-height:21px;color:${INK};">
${bodyHtml}
<p style="margin:24px 0 0;font-family:${SANS};font-size:14px;line-height:21px;color:${INK};">Regards,<br />${signNameSpan(senderName)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const TH = `padding:6px 10px;background:${ORANGE};color:#ffffff;font-family:${SANS};font-size:12.5px;line-height:16px;font-weight:700;text-align:left;white-space:nowrap;`;
const TD = `padding:5px 10px;border-bottom:1px solid ${GRID};font-family:${SANS};font-size:13px;line-height:17px;color:${INK};white-space:nowrap;`;
const NUM = `font-family:${MONO};text-align:right;`;

type Column = { label: string; num?: boolean };

/**
 * One orange table. `rows` are already-escaped cell HTML; `total` is the bold total row's cells.
 * The wrapper div scrolls sideways inside itself on a narrow screen.
 */
function table(columns: Column[], rows: string[][], total?: string[]): string {
  const head = columns.map((c) => `<th style="${TH}${c.num ? 'text-align:right;' : ''}">${esc(c.label)}</th>`).join('');
  const body = rows
    .map((cells, i) => {
      const bg = i % 2 === 1 ? ORANGE_ROW : '#ffffff';
      return `<tr style="background:${bg};">${cells.map((c, j) => `<td style="${TD}${columns[j]?.num ? NUM : ''}background:${bg};">${c}</td>`).join('')}</tr>`;
    })
    .join('');
  const foot = total
    ? `<tr>${total.map((c, j) => `<td style="${TD}${columns[j]?.num ? NUM : ''}font-weight:700;border-top:2px solid ${ORANGE_EDGE};background:#ffffff;">${c}</td>`).join('')}</tr>`
    : '';
  return `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 0 14px;max-width:100%;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;min-width:480px;border-collapse:collapse;border:1px solid ${GRID};">
<tr>${head}</tr>${body}${foot}
</table></div>`;
}

/** An amount cell: red when the invoice is past due (on `today`). */
function amountCell(inv: EmailInvoice, today: string): string {
  const overdue = daysLeft(inv.dueDate, today) < 0;
  return overdue ? `<span style="color:${RED};">${inrText(inv.amountInr)}</span>` : inrText(inv.amountInr);
}

const INVOICE_COLS: Column[] = [{ label: 'Invoice no.' }, { label: 'Invoice date' }, { label: 'Due date' }, { label: 'Amount (₹)', num: true }];

function invoiceCells(inv: EmailInvoice, today: string): string[] {
  return [esc(inv.invoiceNo ?? '—'), inv.invoiceDate ? sheetDate(inv.invoiceDate) : '—', sheetDate(inv.dueDate), amountCell(inv, today)];
}

const sum = (rows: EmailInvoice[]) => Math.round(rows.reduce((a, r) => a + r.amountInr, 0) * 100) / 100;

function textTable(rows: EmailInvoice[], withClient: boolean): string {
  return rows
    .map((r) => `${withClient ? `${r.clientName} · ` : ''}${r.invoiceNo ?? '—'} · invoiced ${r.invoiceDate ? sheetDate(r.invoiceDate) : '—'} · due ${sheetDate(r.dueDate)} · ₹${inrText(r.amountInr)}`)
    .join('\n');
}

function textClose(senderName: string): string {
  return `\n\nRegards,\n${senderName}`;
}

/** Groups by client name, clients in name order, invoices by due date. */
function byClient<T extends EmailInvoice>(rows: T[]): Array<{ client: string; rows: T[] }> {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.clientName, [...(map.get(r.clientName) ?? []), r]);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([client, list]) => ({ client, rows: list.sort((a, b) => a.dueDate.localeCompare(b.dueDate)) }));
}

/** A — new invoices for one client partner, from one approval. */
export function newInvoiceEmail(input: { partnerName: string; senderName: string; invoices: EmailInvoice[]; today: string }): BuiltEmail {
  const n = input.invoices.length;
  const subject = n === 1 ? `New invoice ${input.invoices[0]!.invoiceNo ?? ''} · ${input.invoices[0]!.clientName}`.replace(/\s+·/, ' ·') : `${n} new invoices for your clients`;
  const rows = [...input.invoices].sort((a, b) => a.clientName.localeCompare(b.clientName) || a.dueDate.localeCompare(b.dueDate));
  const cols: Column[] = [{ label: 'Client' }, ...INVOICE_COLS];
  const html = page(
    subject,
    p(`Hi ${esc(firstName(input.partnerName))},`) +
      p(n === 1 ? 'A new invoice has been raised for your client:' : `${n} new invoices have been raised for your clients:`) +
      table(
        cols,
        rows.map((r) => [esc(r.clientName), ...invoiceCells(r, input.today)]),
        n > 1 ? ['Total', '', '', '', inrText(sum(rows))] : undefined,
      ),
    input.senderName,
  );
  const text = `Hi ${firstName(input.partnerName)},\n\n${n === 1 ? 'A new invoice has been raised for your client:' : `${n} new invoices have been raised for your clients:`}\n\n${textTable(rows, true)}${n > 1 ? `\nTotal ₹${inrText(sum(rows))}` : ''}${textClose(input.senderName)}`;
  return { subject, html, text };
}

export type RevisedInvoice = EmailInvoice & { oldAmountInr: number; reason: string | null };

/** A′ — one invoice's amount was revised. */
export function revisedInvoiceEmail(input: { partnerName: string; senderName: string; invoice: RevisedInvoice; today: string }): BuiltEmail {
  const inv = input.invoice;
  const subject = `Invoice revised ${inv.invoiceNo ?? ''} · ${inv.clientName}`.replace(/\s+·/, ' ·');
  const cols: Column[] = [{ label: 'Invoice no.' }, { label: 'Invoice date' }, { label: 'Due date' }, { label: 'Old amount (₹)', num: true }, { label: 'New amount (₹)', num: true }];
  const html = page(
    subject,
    p(`Hi ${esc(firstName(input.partnerName))},`) +
      p(`The amount of an invoice for <b>${esc(inv.clientName)}</b> has been revised.`) +
      table(cols, [[esc(inv.invoiceNo ?? '—'), inv.invoiceDate ? sheetDate(inv.invoiceDate) : '—', sheetDate(inv.dueDate), `<span style="color:${MUTED};text-decoration:line-through;">${inrText(inv.oldAmountInr)}</span>`, amountCell(inv, input.today)]]) +
      (inv.reason ? p(`Reason: ${esc(inv.reason)}`) : ''),
    input.senderName,
  );
  const text = `Hi ${firstName(input.partnerName)},\n\nThe amount of an invoice for ${inv.clientName} has been revised.\n\n${inv.invoiceNo ?? '—'} · invoiced ${inv.invoiceDate ? sheetDate(inv.invoiceDate) : '—'} · due ${sheetDate(inv.dueDate)} · ₹${inrText(inv.oldAmountInr)} → ₹${inrText(inv.amountInr)}${inv.reason ? `\nReason: ${inv.reason}` : ''}${textClose(input.senderName)}`;
  return { subject, html, text };
}

/** B — the roll-up: one client partner's clients, each with a table of open invoices and a total. */
export function rollupEmail(input: { partnerName: string; senderName: string; invoices: EmailInvoice[]; today: string; clientOrgName: string }): BuiltEmail {
  const groups = byClient(input.invoices);
  const total = sum(input.invoices);
  const overdue = sum(input.invoices.filter((r) => daysLeft(r.dueDate, input.today) < 0));
  const subject = `Open invoices for your clients · ₹${inrText(total)} · ${sheetDate(input.today)}`;
  const body =
    p(`Hi ${esc(firstName(input.partnerName))},`) +
    p(`Here are the open invoices for your clients as of ${sheetDate(input.today)}: ₹${inrText(total)} in all${overdue ? `, of which <span style="color:${RED};">₹${inrText(overdue)}</span> is past due` : ''}.`) +
    groups.map((g) => h(g.client, 3) + table(INVOICE_COLS, g.rows.map((r) => invoiceCells(r, input.today)), ['Total', '', '', inrText(sum(g.rows))])).join('');
  const text = `Hi ${firstName(input.partnerName)},\n\nOpen invoices for your clients as of ${sheetDate(input.today)}: ₹${inrText(total)}.\n\n${groups.map((g) => `${g.client}\n${textTable(g.rows, false)}\nTotal ₹${inrText(sum(g.rows))}`).join('\n\n')}${textClose(input.senderName)}`;
  return { subject, html: page(subject, body, input.senderName), text };
}

export type DigestInvoice = EmailInvoice & { partnerName: string | null };

/** C — the leadership digest: partner ▸ client ▸ table, totals per partner and overall. */
export function leadershipDigestEmail(input: { senderName: string; invoices: DigestInvoice[]; today: string; clientOrgName: string }): BuiltEmail {
  const byPartner = new Map<string, DigestInvoice[]>();
  for (const r of input.invoices) {
    const key = r.partnerName ?? 'No client partner';
    byPartner.set(key, [...(byPartner.get(key) ?? []), r]);
  }
  const partners = [...byPartner.entries()].sort(([a], [b]) => (a === 'No client partner' ? 1 : b === 'No client partner' ? -1 : a.localeCompare(b)));
  const total = sum(input.invoices);
  const overdue = sum(input.invoices.filter((r) => daysLeft(r.dueDate, input.today) < 0));
  const subject = `${input.clientOrgName} receivables · ₹${inrText(total)} open · ${sheetDate(input.today)}`;
  const summary = table(
    [{ label: 'Client partner' }, { label: 'Invoices' }, { label: 'Past due ₹', num: true }, { label: 'Open ₹', num: true }],
    partners.map(([name, rows]) => [esc(name), String(rows.length), inrText(sum(rows.filter((r) => daysLeft(r.dueDate, input.today) < 0))), inrText(sum(rows))]),
    ['Total', String(input.invoices.length), overdue ? `<span style="color:${RED};">${inrText(overdue)}</span>` : inrText(0), inrText(total)],
  );
  const detail = partners
    .map(([name, rows]) => h(`${name} · ₹${inrText(sum(rows))}`, 2) + byClient(rows).map((g) => h(g.client, 3) + table(INVOICE_COLS, g.rows.map((r) => invoiceCells(r, input.today)), ['Total', '', '', inrText(sum(g.rows))])).join(''))
    .join('');
  const body = p('Hello,') + p(`The ${esc(input.clientOrgName)} receivables as of ${sheetDate(input.today)}: ₹${inrText(total)} open across ${input.invoices.length} invoice${input.invoices.length === 1 ? '' : 's'}.`) + summary + detail;
  const text = `Hello,\n\nThe ${input.clientOrgName} receivables as of ${sheetDate(input.today)}: ₹${inrText(total)} open.\n\n${partners
    .map(([name, rows]) => `${name} · ₹${inrText(sum(rows))}\n${byClient(rows).map((g) => `${g.client}\n${textTable(g.rows, false)}`).join('\n')}`)
    .join('\n\n')}\n\nOverall total ₹${inrText(total)}${textClose(input.senderName)}`;
  return { subject, html: page(subject, body, input.senderName), text };
}

/** D — a client's statement: that client's open invoices in one table. */
export function clientStatementEmail(input: { clientName: string; senderName: string; invoices: EmailInvoice[]; today: string }): BuiltEmail {
  const rows = [...input.invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const total = sum(rows);
  const subject = `Statement of open invoices · ${input.clientName} · ${sheetDate(input.today)}`;
  const html = page(
    subject,
    p('Dear Sir or Madam,') +
      p(`Please find below the open invoices of <b>${esc(input.clientName)}</b> as of ${sheetDate(input.today)}, ₹${inrText(total)} in all. We would be grateful for payment of the amounts due.`) +
      table(INVOICE_COLS, rows.map((r) => invoiceCells(r, input.today)), ['Total', '', '', inrText(total)]),
    input.senderName,
  );
  const text = `Dear Sir or Madam,\n\nThe open invoices of ${input.clientName} as of ${sheetDate(input.today)}, ₹${inrText(total)} in all:\n\n${textTable(rows, false)}\nTotal ₹${inrText(total)}${textClose(input.senderName)}`;
  return { subject, html, text };
}

export type ReceivedInvoice = EmailInvoice & { paidOn: string; receivedInr: number };

/**
 * The "Payment received" email, offered after Mark received and sent only when the person clicks
 * Send (owner, 17 Nov 2026): the received invoices in one table with the received date and amount.
 */
export function paymentReceivedEmail(input: { recipientName: string; senderName: string; invoices: ReceivedInvoice[] }): BuiltEmail {
  const rows = [...input.invoices].sort((a, b) => a.clientName.localeCompare(b.clientName) || a.paidOn.localeCompare(b.paidOn));
  const clients = [...new Set(rows.map((r) => r.clientName))];
  const total = Math.round(rows.reduce((a, r) => a + r.receivedInr, 0) * 100) / 100;
  const subject =
    rows.length === 1 ? `Payment received · ${rows[0]!.clientName} · ₹${inrText(rows[0]!.receivedInr)}` : `Payments received · ${rows.length} invoices · ₹${inrText(total)}`;
  const many = clients.length > 1;
  const cols: Column[] = [...(many ? [{ label: 'Client' }] : []), { label: 'Invoice no.' }, { label: 'Invoice date' }, { label: 'Due date' }, { label: 'Received date' }, { label: 'Received amount (₹)', num: true }];
  const lead = many ? 'We have received the following payments:' : `We have received the payment for <b>${esc(clients[0])}</b>:`;
  const html = page(
    subject,
    p(`Hi ${esc(firstName(input.recipientName))},`) +
      p(lead) +
      table(
        cols,
        rows.map((r) => [...(many ? [esc(r.clientName)] : []), esc(r.invoiceNo ?? '—'), r.invoiceDate ? sheetDate(r.invoiceDate) : '—', sheetDate(r.dueDate), sheetDate(r.paidOn), inrText(r.receivedInr)]),
        rows.length > 1 ? ['Total', ...Array(cols.length - 2).fill(''), inrText(total)] : undefined,
      ) +
      p('Thank you.'),
    input.senderName,
  );
  const text = `Hi ${firstName(input.recipientName)},\n\n${many ? 'We have received the following payments:' : `We have received the payment for ${clients[0]}:`}\n\n${rows
    .map((r) => `${many ? `${r.clientName} · ` : ''}${r.invoiceNo ?? '—'} · due ${sheetDate(r.dueDate)} · received ${sheetDate(r.paidOn)} · ₹${inrText(r.receivedInr)}`)
    .join('\n')}${rows.length > 1 ? `\nTotal ₹${inrText(total)}` : ''}\n\nThank you.${textClose(input.senderName)}`;
  return { subject, html, text };
}

/**
 * The WhatsApp ping to the sender, after the email went out: the words of the approved DoubleTick
 * template `vcfo_receivables_email_sent`, used as plain text when no template is set.
 */
export function senderPingText(input: { subject: string; name: string; email: string; link: string }): string {
  return [
    'VCFO Suite sent an email from your Outlook.',
    `• Subject: ${input.subject}`,
    `• To: ${input.name}`,
    `• Address: ${input.email}`,
    `• Open it: ${input.link}`,
    'Only you can open this link.',
  ].join('\n');
}
