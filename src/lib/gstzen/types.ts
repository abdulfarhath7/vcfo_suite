/**
 * GSTZEN — shared types for the GST return agents, the consent OTP, GST notices and the GSTIN
 * check (docs/specs/live-portal-browser/GSTZEN.md). Pure and client-safe: no secrets, no OTPs,
 * no tokens. The server-only client is `client.ts`; the pure response mappers are `mappers.ts`;
 * the run state machine is `run-state.ts`.
 */

/** The four GST returns the API route files (`gst_return_runs.form`). */
export type GstForm = 'gstr1' | 'gstr3b' | 'gstr9' | 'gstr9c';

export const GST_FORMS: readonly GstForm[] = ['gstr1', 'gstr3b', 'gstr9', 'gstr9c'];

export const GST_FORM_LABEL: Record<GstForm, string> = {
  gstr1: 'GSTR-1',
  gstr3b: 'GSTR-3B',
  gstr9: 'GSTR-9',
  gstr9c: 'GSTR-9C',
};

/** Catalog task id (`src/lib/assist-agents/catalog.ts`) to the form it files. */
export const TASK_FORM: Record<string, GstForm> = {
  'gstr-1': 'gstr1',
  'gstr-3b': 'gstr3b',
  'gstr-9': 'gstr9',
  'gstr-9c': 'gstr9c',
};

export function isGstForm(v: unknown): v is GstForm {
  return typeof v === 'string' && (GST_FORMS as readonly string[]).includes(v);
}

/** Annual returns take `03YYYY` (March of the year the financial year ends). */
export function isAnnualForm(form: GstForm): boolean {
  return form === 'gstr9' || form === 'gstr9c';
}

/** `gst_return_runs.status`. */
export type GstRunStatus = 'draft' | 'consent_needed' | 'saving' | 'saved' | 'checked' | 'filing' | 'filed' | 'failed' | 'cancelled';

/** One tax amount per head. */
export interface TaxHeads {
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
}

export const ZERO_HEADS: TaxHeads = { igst: 0, cgst: 0, sgst: 0, cess: 0 };

/** A figures table as the card shows it: a label per row and one number per column. */
export interface SummaryTable {
  columns: string[];
  rows: Array<{ label: string; values: number[] }>;
}

/**
 * The portal's own figures after a save (`gst_return_runs.summary`). Numbers and labels only:
 * never an invoice, a party name or a raw portal payload.
 */
export interface GstReturnSummary {
  form: GstForm;
  table: SummaryTable;
  /** Single figures under the table, for example interest and late fee. */
  lines: Array<{ label: string; value: number }>;
  /** GSTR-3B: the cash the return needs after ITC, all heads together. */
  cashNeeded?: number;
  /** GSTR-3B: the cash ledger balance when the figures were read, all heads together. */
  cashBalance?: number;
  /** GSTR-3B: cash still to be paid into the ledger before the offset (0 when the balance covers it). */
  cashShort?: number;
  /** GSTR-3B: ITC in GSTR-2B against ITC claimed in the return, when 2B was read. */
  twoB?: { itcIn2b: number; itcClaimed: number; difference: number } | null;
  /** A note the card shows with the figures, for example "GSTR-9C is not saved on the portal yet". */
  note?: string | null;
  fetchedAt: string;
}

/**
 * Where a run is inside its status (`summary.flow`). Flags only. `signatoryPan` is kept so the EVC
 * can be filed when the client answers; it is never sent to the browser in full.
 */
export interface GstRunFlow {
  /** Which step failed last, so Retry restarts the right one. */
  failedAt?: 'save' | 'file' | null;
  /** GSTR-3B: the offset (ITC and cash set against the liability) went through. */
  offsetDone?: boolean;
  /** GSTR-1, GSTR-9, GSTR-9C: proceed to file went through and the summary to sign was read. */
  proceedDone?: boolean;
  /** A slow job is running now (save, offset or proceed). */
  working?: 'save' | 'offset' | 'proceed' | null;
  /** The authorised signatory's PAN for the EVC. */
  signatoryPan?: string | null;
}

export interface GstCheckView {
  by: string;
  byName?: string | null;
  at: string;
}

/** A "Your turn: type the OTP" request as a card shows it. Never carries the OTP. */
export interface AgentOtpRequestView {
  id: string;
  engagementId: string;
  purpose: 'gstn_consent' | 'evc';
  subjectType: string;
  subjectId: string;
  gstin: string | null;
  sentTo: string | null;
  audience: 'staff' | 'client';
  status: 'pending' | 'answered' | 'expired' | 'cancelled' | 'failed';
  requestedAt: string;
  expiresAt: string;
  /** A short line for the client card, for example "SBC is filing your GSTR-3B (Oct 2026)". */
  title: string;
}

export interface GstnSessionView {
  gstin: string;
  status: 'inactive' | 'active' | 'dormant';
  expiresAt: string | null;
  establishedAt: string | null;
  refreshedAt: string | null;
}

export interface GstReturnRunView {
  id: string;
  engagementId: string;
  gstin: string;
  form: GstForm;
  period: string;
  periodLabel: string;
  status: GstRunStatus;
  summary: GstReturnSummary | null;
  checks: { figures?: GstCheckView; unmatched?: GstCheckView };
  flow: Omit<GstRunFlow, 'signatoryPan'> & { signatoryPanMasked: string | null };
  arn: string | null;
  filedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GstNoticeView {
  id: string;
  gstin: string;
  refId: string;
  arn: string | null;
  noticeType: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  period: string | null;
  state: 'open' | 'replied' | 'closed';
  documents: string[];
  fetchedAt: string;
}

/** What the GSTIN check on GSTN found, for the person to confirm. */
export interface GstinCheckResult {
  gstin: string;
  valid: boolean;
  legalName: string | null;
  tradeName: string | null;
  status: string | null;
  registeredOn: string | null;
  taxpayerType: string | null;
  constitution: string | null;
  state: string | null;
  /** State and centre jurisdictions in one line, for the tracker's Jurisdiction field. */
  jurisdiction: string | null;
  principalAddress: string | null;
}

/* ------------------------------------------------------------------ */
/* periods                                                             */
/* ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** True for `MMYYYY` with a real month. */
export function isRetPeriod(v: string): boolean {
  if (!/^\d{6}$/.test(v)) return false;
  const m = Number(v.slice(0, 2));
  return m >= 1 && m <= 12;
}

/**
 * The GSP's `ret_period` for a filing: the month of the period start (`MMYYYY`) for monthly and
 * quarterly returns, and `03YYYY` for the year the financial year ends for annual ones.
 * `periodStart` and `periodEnd` are ISO dates from the obligation instance.
 */
export function retPeriodFor(form: GstForm, input: { periodStart?: string | null; periodEnd?: string | null; dueDate?: string | null }): string | null {
  const iso = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null);
  if (isAnnualForm(form)) {
    const end = iso(input.periodEnd) ?? null;
    if (end) {
      const y = Number(end.slice(0, 4));
      const m = Number(end.slice(5, 7));
      return `03${m <= 3 ? y : y + 1}`;
    }
    const start = iso(input.periodStart);
    if (start) {
      const y = Number(start.slice(0, 4));
      const m = Number(start.slice(5, 7));
      return `03${m >= 4 ? y + 1 : y}`;
    }
    return null;
  }
  // Quarterly GSTR-1 (QRMP) is filed against the quarter's last month.
  const end = iso(input.periodEnd);
  const start = iso(input.periodStart);
  const pick = form === 'gstr1' && end && start && end.slice(0, 7) !== start.slice(0, 7) ? end : (start ?? end);
  if (!pick) return null;
  return `${pick.slice(5, 7)}${pick.slice(0, 4)}`;
}

/** `102026` → "Oct 2026"; `032026` for an annual form → "FY 2025-26". */
export function periodLabelOf(form: GstForm, period: string): string {
  if (!isRetPeriod(period)) return period;
  const m = Number(period.slice(0, 2));
  const y = Number(period.slice(2));
  if (isAnnualForm(form)) return `FY ${y - 1}-${String(y).slice(2)}`;
  return `${MONTHS[m - 1]} ${y}`;
}

/** The period the card offers when it has no filing instance: last month, or the last financial year. */
export function defaultRetPeriod(form: GstForm, today: string): string {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  if (isAnnualForm(form)) return `03${m >= 4 ? y : y - 1}`;
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${String(pm).padStart(2, '0')}${py}`;
}

/** `AAKCK1234F` → `••••••234F`. */
export function maskPan(pan: string | null | undefined): string | null {
  const p = (pan ?? '').trim().toUpperCase();
  if (!p) return null;
  return `${'•'.repeat(Math.max(0, p.length - 4))}${p.slice(-4)}`;
}

export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
/** A GST portal OTP or EVC OTP: six digits. */
export const OTP_RE = /^\d{6}$/;
/** How long a "Your turn: type the OTP" request stays open. */
export const OTP_REQUEST_MINUTES = 10;
