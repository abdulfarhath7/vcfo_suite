import { emailColor, escapeHtml } from '@/lib/email/email-layout';
import { SPECTRUM_EMAIL_FONTS } from '@/lib/email/spectrum-email-tokens';
import type { CollectionsReport } from './collections';
import { monthLong, sheetDate } from './dates';
import { signNameSpan } from './sign-name';
import { partOf, type TemplateOverride } from './templates';

/**
 * RECEIVABLES COLLECTIONS EMAIL (owner, 19 Nov 2026) — the body of Send email on the Collections tab:
 * invoices received on time against received late, for the period and filters picked on the tab.
 * One summary box (on time, late, still open and late, average days late, short-paid), then a table
 * by month received, by client partner (only on an email that is not to one partner), by client,
 * and the received invoices with how early or late each was. A client partner's email holds only
 * that partner's invoices; the caller builds the report for that partner. Inline styles, for Outlook,
 * in the same SBC-orange table theme as the receivables update.
 */

const ORANGE = '#e35f2a';
const BAND = '#fdf4f0';
const GRID = '#e4e4e4';
const INK = '#1f2328';
const MUTED = '#6b7079';
const GREEN = '#2e7d32';
const RED = emailColor('danger');
const SANS = SPECTRUM_EMAIL_FONTS.sans;
const P = `margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:21px;color:${INK};`;
const H = `margin:18px 0 6px;font-family:${SANS};font-size:14px;line-height:20px;font-weight:bold;color:${INK};`;
const TABLE = `width:100%;border-collapse:collapse;margin:0 0 10px;min-width:520px;border:1px solid ${GRID};`;
const HEAD = `padding:6px 10px;font-size:12.5px;line-height:16px;font-family:${SANS};background:${ORANGE};color:#ffffff;font-weight:bold;text-align:left;white-space:nowrap;`;
const CELL = `border-bottom:1px solid ${GRID};padding:5px 10px;font-size:13px;line-height:17px;font-family:${SANS};color:${INK};`;
const NUM = `font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap;`;

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (n: number) => inr.format(Math.round(n));
const pct = (on: number, late: number) => (on + late ? `${Math.round((on / (on + late)) * 100)}%` : '—');

type Col = { label: string; num?: boolean };
function table(cols: Col[], rows: string[][]): string {
  const head = cols.map((c) => `<td style="${HEAD}${c.num ? 'text-align:right;' : ''}">${escapeHtml(c.label)}</td>`).join('');
  const body = rows
    .map((cells) => `<tr>${cells.map((c, j) => `<td style="${CELL}background:#ffffff;${cols[j]?.num ? NUM : ''}">${c}</td>`).join('')}</tr>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${TABLE}"><tr>${head}</tr>${body}</table>`;
}

const TALLY_COLS: Col[] = [{ label: 'On time', num: true }, { label: 'On time ₹', num: true }, { label: 'Late', num: true }, { label: 'Late ₹', num: true }, { label: 'Avg days late', num: true }, { label: '% on time', num: true }];
const tallyCells = (t: { onTime: number; late: number; onTimeInr: number; lateInr: number; avgDaysLate: number | null }) => [
  String(t.onTime),
  money(t.onTimeInr),
  String(t.late),
  money(t.lateInr),
  t.avgDaysLate === null ? '—' : String(t.avgDaysLate),
  `<b>${pct(t.onTime, t.late)}</b>`,
];

export type CollectionsEmailInput = {
  report: CollectionsReport;
  today: string;
  /** "This financial year", "This quarter" … as on the tab. */
  periodLabel: string;
  signerName: string;
  greetName?: string;
  sheetName?: string;
  /** The partner names, for the by-partner table. */
  partnerName: (id: string | null) => string;
  /** False on a client partner's own email, which has no by-partner table. */
  showPartners: boolean;
  template?: TemplateOverride;
};

export function collectionsEmailVars(input: Pick<CollectionsEmailInput, 'report' | 'today' | 'periodLabel' | 'greetName' | 'sheetName'>): Record<string, string> {
  const t = input.report.totals;
  return { name: input.greetName || 'Team', date: sheetDate(input.today), period: input.periodLabel.toLowerCase(), ontime: pct(t.onTime, t.late), sheet: input.sheetName ?? '' };
}

export function collectionsEmailSubject(input: Pick<CollectionsEmailInput, 'report' | 'today' | 'periodLabel' | 'greetName' | 'sheetName' | 'template'>): string {
  const vars = collectionsEmailVars(input);
  return partOf(input.template, 'subject', vars) ?? `Collections · ${input.periodLabel}${vars.ontime === '—' ? '' : ` · ${vars.ontime} on time`}`;
}

const paras = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `<p style="${P}">${escapeHtml(t).replace(/\n/g, '<br>')}</p>`)
    .join('');

export function collectionsEmailHtml(input: CollectionsEmailInput): string {
  const { report } = input;
  const t = report.totals;
  const vars = collectionsEmailVars(input);
  const greeting = partOf(input.template, 'greeting', vars) ?? `Hi ${vars.name},`;
  const intro = partOf(input.template, 'intro', vars);
  const closing = partOf(input.template, 'closing', vars);
  const received = t.onTime + t.late;

  const box = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;min-width:520px;border-collapse:collapse;margin:6px 0 14px;"><tr><td style="padding:10px 14px;background:${BAND};border-left:4px solid ${ORANGE};font-family:${SANS};font-size:14px;line-height:22px;color:${INK};">
<b style="font-size:16px;">${received ? `${pct(t.onTime, t.late)} received on time` : 'Nothing received in this period yet'}</b><br>
On time: <b>${t.onTime}</b> · ₹ ${money(t.onTimeInr)} &nbsp;·&nbsp; Late: <b style="color:${t.late ? RED : INK};">${t.late}</b> · ₹ ${money(t.lateInr)}${t.avgDaysLate === null ? '' : ` (avg ${t.avgDaysLate} days)`}<br>
Still open and past due: <b style="color:${t.openLate ? RED : INK};">${t.openLate}</b> · ₹ ${money(t.openLateInr)} &nbsp;·&nbsp; Short-paid: <b>${t.shortPaid}</b> · ₹ ${money(t.shortPaidInr)}
</td></tr></table>`;

  const sections: string[] = [];
  if (report.byMonth.length) sections.push(`<p style="${H}">By month received</p>` + table([{ label: 'Month' }, ...TALLY_COLS], report.byMonth.map((m) => [escapeHtml(monthLong(m.month)), ...tallyCells(m)])));
  if (input.showPartners && report.byPartner.length > 1)
    sections.push(`<p style="${H}">By client partner</p>` + table([{ label: 'Partner' }, ...TALLY_COLS], report.byPartner.map((p) => [escapeHtml(input.partnerName(p.partnerId)), ...tallyCells(p)])));
  if (report.byClient.length) sections.push(`<p style="${H}">By client</p>` + table([{ label: 'Client' }, ...TALLY_COLS], report.byClient.map((c) => [escapeHtml(c.clientName), ...tallyCells(c)])));
  const list = report.rows.filter((r) => r.result !== 'open_late');
  if (list.length)
    sections.push(
      `<p style="${H}">Received invoices</p>` +
        table(
          [{ label: 'Client' }, { label: 'Invoice no.' }, { label: 'Due date' }, { label: 'Received date' }, { label: 'Received ₹', num: true }, { label: 'Result' }],
          list.map((r) => {
            const late = (r.daysLate ?? 0) > 0;
            const when = r.daysLate === null ? '' : r.daysLate === 0 ? 'On the due date' : late ? `${r.daysLate} day${r.daysLate === 1 ? '' : 's'} late` : `${-r.daysLate} day${r.daysLate === -1 ? '' : 's'} early`;
            return [
              `<b>${escapeHtml(r.clientName)}</b>`,
              r.invoiceNo ? escapeHtml(r.invoiceNo) : '—',
              sheetDate(r.dueDate),
              r.paidOn ? sheetDate(r.paidOn) : '—',
              money(r.receivedInr ?? 0),
              `<span style="color:${late ? RED : GREEN};font-weight:600;">${when}</span>${r.shortPaid ? ` <span style="color:${MUTED};">· short-paid</span>` : ''}`,
            ];
          }),
        ),
    );

  return [
    `<p style="${P}">${escapeHtml(greeting)}</p>`,
    intro !== null ? paras(intro) : `<p style="${P}">Please find the collections for ${escapeHtml(vars.period)}: the invoices received on time against those received late.</p>`,
    received || t.openLate ? box + sections.join('') : `<p style="${P}">No invoices were received in this period.</p>`,
    closing !== null ? paras(closing) : '',
    `<p style="${P}">Regards,<br>${signNameSpan(input.signerName)}</p>`,
  ].join('');
}
