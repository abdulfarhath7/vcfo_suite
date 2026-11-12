import { LATE_FEE_RULES, type LateFeeRule } from '@/data/late-fee-rules';
import { todayIST } from '@/lib/compliance/filings';

/**
 * LATE FEES — what a late filing has cost so far under the rules in `src/data/late-fee-rules.ts`
 * (A1.5, phase 1 of the penalty calculator).
 *
 * Pure and deterministic: the same filing and the same day always give the same amount, and no
 * model computes a figure. A filing is late when it was filed after its due date, or when it is
 * still not filed and the due date has passed (counted up to today in India). A filing on time,
 * or one whose obligation has no rule, has no late fee. Amounts are whole rupees.
 */

export interface LateFeeInput {
  /** `compliance_obligations.id`, when the row carries it. */
  obligationId?: string | null;
  /** `compliance_obligations.particular` ("GSTR-3B Filing"), the fallback match. */
  particular?: string | null;
  /** ISO due date. */
  dueDate: string;
  /** ISO filed date, or null while unfiled. */
  filedOn: string | null;
}

export interface LateFee {
  ruleId: string;
  kind: LateFeeRule['kind'];
  daysLate: number;
  /** Whole rupees. For a `maximum` rule this is the most that may be imposed. */
  amount: number;
  /** True when the rule's cap stopped the amount. */
  capped: boolean;
  /** True while the filing is still not made, so the amount keeps growing. */
  ongoing: boolean;
  basis: string;
  note: string | null;
  citation: string;
  asOf: string;
}

const DAY_MS = 86_400_000;

function isoDay(value: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.trim() ?? '');
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** The rule for an obligation: by its id first, then by its name. */
export function lateFeeRuleFor(input: Pick<LateFeeInput, 'obligationId' | 'particular'>): LateFeeRule | null {
  const id = input.obligationId?.trim();
  if (id) {
    const byId = LATE_FEE_RULES.find((r) => r.obligationIds.includes(id));
    if (byId) return byId;
  }
  const name = input.particular?.toLowerCase() ?? '';
  if (!name) return null;
  return LATE_FEE_RULES.find((r) => r.particulars.some((p) => name.includes(p))) ?? null;
}

/** Whole days between the due date and the filed date (or today while unfiled); 0 when on time. */
export function daysLate(dueDate: string, filedOn: string | null, now: Date = new Date()): number {
  const due = isoDay(dueDate);
  if (due === null) return 0;
  const end = isoDay(filedOn) ?? isoDay(todayIST(now))!;
  return Math.max(0, Math.round((end - due) / DAY_MS));
}

export function computeLateFee(input: LateFeeInput, now: Date = new Date()): LateFee | null {
  const rule = lateFeeRuleFor(input);
  if (!rule) return null;
  const days = daysLate(input.dueDate, input.filedOn, now);
  if (days <= 0) return null;

  let raw: number;
  if (rule.kind === 'fixed') raw = rule.amount ?? 0;
  else if (rule.kind === 'maximum') raw = (rule.base ?? 0) + (rule.perDay ?? 0) * days;
  else raw = (rule.perDay ?? 0) * days;

  const capped = rule.cap !== undefined && raw > rule.cap;
  return {
    ruleId: rule.id,
    kind: rule.kind,
    daysLate: days,
    amount: capped ? rule.cap! : raw,
    capped,
    ongoing: !input.filedOn?.trim(),
    basis: rule.basis,
    note: rule.note ?? null,
    citation: rule.citation,
    asOf: rule.asOf,
  };
}

/** The sum of the late fees of many filings, and how many of them carry one. */
export function totalLateFees(rows: LateFeeInput[], now: Date = new Date()): { amount: number; count: number } {
  let amount = 0;
  let count = 0;
  for (const row of rows) {
    const fee = computeLateFee(row, now);
    if (!fee) continue;
    amount += fee.amount;
    count += 1;
  }
  return { amount, count };
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** "₹3,400", "up to ₹23,000" for a maximum. */
export function lateFeeLabel(fee: LateFee): string {
  return `${fee.kind === 'maximum' ? 'up to ' : ''}${INR.format(fee.amount)}`;
}

export function formatRupees(amount: number): string {
  return INR.format(amount);
}

/** The hover text: how the figure was worked out, the caveat and the law. */
export function lateFeeExplanation(fee: LateFee): string {
  const parts = [
    `${fee.daysLate} day${fee.daysLate === 1 ? '' : 's'} late${fee.ongoing ? ' so far' : ''}. ${fee.basis}${fee.capped ? ', capped' : ''}.`,
    fee.note,
    `${fee.citation} Checked ${fee.asOf}. An estimate; confirm before quoting it to a client.`,
  ];
  return parts.filter(Boolean).join(' ');
}
