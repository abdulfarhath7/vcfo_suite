/**
 * SECURITY DEPOSITS — the separate section of the receivables update (owner, 23 Nov 2026). The
 * leaders get a weekly list of client security deposits ("SD") beside the receivables: client,
 * status, the expected week of closure, the total deposit in rupees and what is due now or after
 * signing. The rows are typed or pasted in the Send email pop-up and travel with the send request;
 * nothing is saved on the server. This module is pure (no React, no server code), so the pop-up,
 * the email builder and the send route share it and the tests can call it directly.
 */

/** One row as the email shows it. `totalInr` is null when the amount is left empty. */
export type DepositRow = { client: string; status: string; eta: string; totalInr: number | null; due: string };

/** The section: its heading and its rows. No rows means no section in the email. */
export type DepositsSection = { title: string; rows: DepositRow[] };

/** One row as the pop-up edits it: the amount is the text the person typed or pasted. */
export type DepositDraftRow = { client: string; status: string; eta: string; amount: string; due: string };

export const DEFAULT_DEPOSITS_TITLE = 'Security deposits';

/** The limits the send route enforces; the pop-up uses the same numbers for its inputs. */
export const DEPOSIT_LIMITS = { title: 80, rows: 50, cell: 200, due: 300, amount: 1e13 } as const;

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Whole rupees with Indian grouping, without the sign: 77015232 → "7,70,15,232". */
export const formatInr = (n: number) => inr.format(Math.round(n));

/** The short crore figure: 77015232 → "7.70 cr". */
export const croreLabel = (n: number) => `${(n / 1e7).toFixed(2)} cr`;

/** The sum of the amounts that are filled in. */
export const depositsTotal = (rows: Array<{ totalInr: number | null }>) => rows.reduce((sum, r) => sum + (r.totalInr ?? 0), 0);

/** "₹ 7,70,15,232 (7.70 cr)", the live total line of the pop-up. */
export const depositsTotalLabel = (total: number) => `₹ ${formatInr(total)} (${croreLabel(total)})`;

/**
 * Reads an amount in rupees. Accepts "₹ 31,004,688", "31004688", "3,10,04,688", "Rs. 22,036,784",
 * "INR 5,00,000" and a decimal part. Commas may sit anywhere between digits, so both Indian and
 * western grouping work. Returns null for empty text or for text that is not an amount
 * ("7.7cr", "TBD"); use `amountProblem` to tell those two cases apart.
 */
export function parseAmountInr(text: string): number | null {
  const t = text
    .trim()
    .replace(/^(₹|rs\.?|inr)\s*/i, '')
    .replace(/\s+/g, '');
  if (!/^\d[\d,]*(\.\d+)?$/.test(t) || /,,|,\./.test(t)) return null;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) && n <= DEPOSIT_LIMITS.amount ? n : null;
}

/** True when the amount cell holds text that is not an amount; an empty cell is fine. */
export const amountProblem = (text: string) => text.trim() !== '' && parseAmountInr(text) === null;

const blankDraft = (r: DepositDraftRow) => !r.client.trim() && !r.status.trim() && !r.eta.trim() && !r.amount.trim() && !r.due.trim();

export const emptyDraftRow = (): DepositDraftRow => ({ client: '', status: '', eta: '', amount: '', due: '' });

/** Splits one pasted line into cells: tabs (Excel, Outlook), then "|" (chat tables), then two or more spaces. */
function cellsOf(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (line.includes('|')) {
    const cells = line.split('|').map((c) => c.trim());
    // "| a | b |" has an empty cell at each end.
    if (line.trim().startsWith('|')) cells.shift();
    if (line.trim().endsWith('|')) cells.pop();
    return cells;
  }
  // A line that starts with a run of spaces has an empty first cell (a total row under the amounts).
  const cells = line.trim().split(/\s{2,}/).map((c) => c.trim());
  return /^\s{2,}/.test(line) ? ['', ...cells] : cells;
}

const isHeader = (first: string) => first.toLowerCase() === 'client';
const isTotal = (first: string) => first === '' || /^\(?\s*(grand\s+)?total\b/i.test(first);
const isRule = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '');

/**
 * Turns a table copied from Excel, Outlook or a chat into rows, in the column order Client,
 * Status, ETA for closure, Total SD, SD due now / post signing. A header row (first cell
 * "Client"), a total row (empty first cell, or one starting with "Total") and blank lines are
 * left out. Cells past the fifth are added to the last column. At most `DEPOSIT_LIMITS.rows`
 * rows are kept; `dropped` says how many more there were.
 */
export function parseDepositsPaste(text: string): { rows: DepositDraftRow[]; dropped: number } {
  const rows: DepositDraftRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = cellsOf(line);
    if (isRule(cells)) continue;
    const first = cells[0] ?? '';
    if (isHeader(first) || isTotal(first)) continue;
    const [client = '', status = '', eta = '', amount = '', ...rest] = cells;
    rows.push({ client, status, eta, amount, due: rest.filter(Boolean).join(' ') });
  }
  return { rows: rows.slice(0, DEPOSIT_LIMITS.rows), dropped: Math.max(0, rows.length - DEPOSIT_LIMITS.rows) };
}

/**
 * The section the send request carries, from the pop-up's rows: cells trimmed and cut to the
 * limits, amounts read, empty rows left out. Returns null when nothing is left, so the email has
 * no section. A row with an amount that is not an amount is sent with the amount empty; the
 * pop-up does not let the person send while such a row is there.
 */
export function depositsPayload(title: string, drafts: DepositDraftRow[]): DepositsSection | null {
  const cut = (s: string, n: number) => s.trim().slice(0, n);
  const rows = drafts
    .filter((r) => !blankDraft(r))
    .slice(0, DEPOSIT_LIMITS.rows)
    .map((r) => ({
      client: cut(r.client, DEPOSIT_LIMITS.cell),
      status: cut(r.status, DEPOSIT_LIMITS.cell),
      eta: cut(r.eta, DEPOSIT_LIMITS.cell),
      totalInr: parseAmountInr(r.amount),
      due: cut(r.due, DEPOSIT_LIMITS.due),
    }));
  if (!rows.length) return null;
  return { title: cut(title, DEPOSIT_LIMITS.title) || DEFAULT_DEPOSITS_TITLE, rows };
}
