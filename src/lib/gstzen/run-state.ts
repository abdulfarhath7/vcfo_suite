import type { GstCheckView, GstForm, GstReturnSummary, GstRunFlow, GstRunStatus } from './types';

/**
 * GST RETURN RUN — the state machine of one return filed through the GSP API (MASTER-PLAN
 * screen 7). Pure: the repository stores the status, the routes and jobs ask this module whether
 * a move is allowed, and the card draws its steps strip and its next step from it.
 *
 *   draft ─start─▶ consent_needed ─consent─▶ saving ─saved─▶ saved ─both checks─▶ checked
 *     │                 (no GSTN session)     ▲  │              ▲ │ untick              │
 *     └────start (session active)─────────────┘  └─failed       └─┘                    ▼
 *                                                                            filing ─ARN─▶ filed
 *                                                                               └─failed─▶ failed ─retry─▶ saving | checked
 *
 * `filing` covers the slow work after the checks (the GSTR-3B offset, or proceed to file for the
 * other forms) and the EVC. The person gives every OTP and pays any cash: the agent never pays.
 * Any state but `filed` can be cancelled.
 */

export type GstRunEvent =
  | { type: 'start'; sessionActive: boolean }
  | { type: 'consent_established' }
  | { type: 'save' }
  | { type: 'saved' }
  | { type: 'failed'; at: 'save' | 'file' }
  | { type: 'check_complete' }
  | { type: 'check_incomplete' }
  | { type: 'file_start' }
  | { type: 'filed' }
  | { type: 'retry'; at: 'save' | 'file' | null }
  | { type: 'cancel' };

/** Every allowed move. Anything else is refused. */
export const GST_RUN_TRANSITIONS: Record<GstRunStatus, readonly GstRunStatus[]> = {
  draft: ['consent_needed', 'saving', 'cancelled'],
  consent_needed: ['saving', 'cancelled'],
  saving: ['saved', 'failed', 'consent_needed', 'cancelled'],
  saved: ['checked', 'saving', 'consent_needed', 'cancelled'],
  checked: ['saved', 'filing', 'saving', 'consent_needed', 'cancelled'],
  filing: ['filed', 'failed', 'checked', 'cancelled'],
  failed: ['saving', 'checked', 'consent_needed', 'cancelled'],
  filed: [],
  cancelled: [],
};

export function canMove(from: GstRunStatus, to: GstRunStatus): boolean {
  return GST_RUN_TRANSITIONS[from].includes(to);
}

/** The status after an event, or null when the event is not allowed in this status. */
export function nextStatus(from: GstRunStatus, event: GstRunEvent): GstRunStatus | null {
  let to: GstRunStatus | null = null;
  switch (event.type) {
    case 'start':
      to = from === 'draft' ? (event.sessionActive ? 'saving' : 'consent_needed') : null;
      break;
    case 'consent_established':
      to = from === 'consent_needed' ? 'saving' : null;
      break;
    case 'save':
      // From consent_needed only once a session is active (consent given on another run).
      to = from === 'saved' || from === 'checked' || from === 'draft' || from === 'consent_needed' ? 'saving' : null;
      break;
    case 'saved':
      to = from === 'saving' ? 'saved' : null;
      break;
    case 'failed':
      to = from === 'saving' || from === 'filing' ? 'failed' : null;
      break;
    case 'check_complete':
      to = from === 'saved' ? 'checked' : null;
      break;
    case 'check_incomplete':
      to = from === 'checked' ? 'saved' : null;
      break;
    case 'file_start':
      to = from === 'checked' ? 'filing' : null;
      break;
    case 'filed':
      to = from === 'filing' ? 'filed' : null;
      break;
    case 'retry':
      to = from === 'failed' ? (event.at === 'file' ? 'checked' : 'saving') : null;
      break;
    case 'cancel':
      to = from === 'filed' || from === 'cancelled' ? null : 'cancelled';
      break;
  }
  return to && canMove(from, to) ? to : null;
}

/** Open runs: one per GSTIN, form and period at a time. */
export function isOpenStatus(s: GstRunStatus): boolean {
  return s !== 'filed' && s !== 'cancelled';
}

/* ------------------------------------------------------------------ */
/* certifier checks                                                    */
/* ------------------------------------------------------------------ */

export type GstCheckKey = 'figures' | 'unmatched';

/** The two ticks the certifier gives before anything is filed, worded per form. */
export function checkLabels(form: GstForm, summary: GstReturnSummary | null): Record<GstCheckKey, string> {
  const twoB = summary?.twoB;
  switch (form) {
    case 'gstr3b':
      return {
        figures: 'I checked the figures against the books',
        unmatched: twoB && Math.abs(twoB.difference) >= 1 ? 'I checked the ITC that differs from GSTR-2B' : 'I checked the ITC against GSTR-2B',
      };
    case 'gstr1':
      return { figures: 'I checked the figures against the sales register', unmatched: 'I checked the e-invoices and uploads on the portal' };
    case 'gstr9':
      return { figures: 'I checked the annual figures against the books', unmatched: 'I checked the figures against the year’s GSTR-1 and GSTR-3B' };
    case 'gstr9c':
      return { figures: 'I checked the reconciliation against the audited statements', unmatched: 'I checked the unreconciled differences with the auditor' };
  }
}

export function checksComplete(checks: { figures?: GstCheckView | null; unmatched?: GstCheckView | null }): boolean {
  return Boolean(checks.figures && checks.unmatched);
}

/* ------------------------------------------------------------------ */
/* steps strip and next step                                           */
/* ------------------------------------------------------------------ */

export type GstStepKey = 'data' | 'consent' | 'save' | 'check' | 'pay' | 'file' | 'arn';
export type GstStepState = 'done' | 'current' | 'upcoming' | 'attention';

export const GST_STEP_LABEL: Record<GstStepKey, string> = {
  data: 'Data',
  consent: 'Consent',
  save: 'Save',
  check: 'Check',
  pay: 'Pay',
  file: 'File',
  arn: 'ARN',
};

/** GSTR-3B has a Pay step (the person pays any cash due from their own bank); the other forms do not. */
export function stepKeysFor(form: GstForm): GstStepKey[] {
  return form === 'gstr3b' ? ['data', 'consent', 'save', 'check', 'pay', 'file', 'arn'] : ['data', 'consent', 'save', 'check', 'file', 'arn'];
}

export interface RunFacts {
  form: GstForm;
  status: GstRunStatus;
  summary: GstReturnSummary | null;
  flow: Pick<GstRunFlow, 'failedAt' | 'offsetDone' | 'proceedDone' | 'working'>;
  /** The GSTIN has an active GSTN session now. */
  sessionActive: boolean;
  /** A consent or EVC OTP request is waiting for its answer. */
  pendingOtp: 'gstn_consent' | 'evc' | null;
}

/** The index of the step the run is on (the first step that is not done). */
function currentIndex(f: RunFacts, keys: GstStepKey[]): number {
  const at = (k: GstStepKey) => keys.indexOf(k);
  switch (f.status) {
    case 'draft':
      return at('data');
    case 'consent_needed':
      return at('consent');
    case 'saving':
      return at('save');
    case 'saved':
      return at('check');
    case 'checked':
    case 'filing':
      if (f.form === 'gstr3b' && !f.flow.offsetDone && (f.summary?.cashShort ?? 0) > 0) return at('pay');
      return at('file');
    case 'failed':
      return f.flow.failedAt === 'file' ? at('file') : at('save');
    case 'filed':
      return keys.length;
    case 'cancelled':
      return -1;
  }
}

export function runSteps(f: RunFacts): Array<{ key: GstStepKey; label: string; state: GstStepState }> {
  const keys = stepKeysFor(f.form);
  const cur = currentIndex(f, keys);
  return keys.map((key, i) => {
    let state: GstStepState = cur < 0 ? 'upcoming' : i < cur ? 'done' : i === cur ? 'current' : 'upcoming';
    if (state === 'current' && f.status === 'failed') state = 'attention';
    // A session that lapsed after consent shows again as the step to redo.
    if (key === 'consent' && state === 'done' && !f.sessionActive && (f.status === 'saved' || f.status === 'checked')) state = 'attention';
    // No cash due: the pay step is passed through.
    if (key === 'pay' && state === 'upcoming' && f.summary && (f.summary.cashShort ?? 0) <= 0 && (f.status === 'checked' || f.status === 'filing')) state = 'done';
    return { key, label: GST_STEP_LABEL[key], state };
  });
}

export type GstNextKind =
  | 'start'
  | 'consent'
  | 'consent_wait'
  | 'working'
  | 'check'
  | 'pay'
  | 'offset'
  | 'proceed'
  | 'evc'
  | 'evc_wait'
  | 'retry'
  | 'not_ready'
  | 'done'
  | 'cancelled';

/** The one next step the card offers, with the line it shows. */
export function nextStep(f: RunFacts): { kind: GstNextKind; text: string } {
  if (f.flow.working) {
    const what = f.flow.working === 'save' ? 'Saving the return on the portal' : f.flow.working === 'offset' ? 'Setting off the liability' : 'Proceeding to file';
    return { kind: 'working', text: `${what}. This can take a few minutes.` };
  }
  switch (f.status) {
    case 'draft':
      return { kind: 'start', text: 'Start: the agent reads the portal’s figures for this period.' };
    case 'consent_needed':
      if (f.pendingOtp === 'gstn_consent') return { kind: 'consent_wait', text: 'Type the consent OTP the GST portal sent to the registered mobile.' };
      // Consent was given on another run for this GSTIN: the session is already open.
      if (f.sessionActive) return { kind: 'start', text: 'The GSTN session is active. Read and save the return on the portal.' };
      return { kind: 'consent', text: 'Ask the GST portal for the consent OTP.' };
    case 'saving':
      return { kind: 'working', text: 'Reading and saving the return on the portal.' };
    case 'saved':
      if (f.summary?.note && f.form === 'gstr9c') return { kind: 'not_ready', text: f.summary.note };
      return { kind: 'check', text: 'The certifier ticks both checks before anything is filed.' };
    case 'checked':
    case 'filing': {
      if (!f.sessionActive && f.pendingOtp !== 'evc') return { kind: 'consent', text: 'The GSTN session has lapsed. Ask for a new consent OTP to continue.' };
      if (f.form === 'gstr3b' && !f.flow.offsetDone) {
        const short = f.summary?.cashShort ?? 0;
        if (short > 0) return { kind: 'pay', text: `Pay Rs ${formatInr(short)} into the cash ledger from your own bank, then read the balance again.` };
        return { kind: 'offset', text: 'Set off the liability with ITC and the cash ledger.' };
      }
      if (f.form !== 'gstr3b' && !f.flow.proceedDone) return { kind: 'proceed', text: 'Proceed to file: the portal freezes the return for signing.' };
      return f.pendingOtp === 'evc'
        ? { kind: 'evc_wait', text: 'Type the EVC OTP the portal sent to the authorised signatory.' }
        : { kind: 'evc', text: 'Ask for the EVC OTP to file. Signing with a DSC is not built yet.' };
    }
    case 'failed':
      return { kind: 'retry', text: 'The last step failed. Read the message, fix the cause, then try again.' };
    case 'filed':
      return { kind: 'done', text: 'Filed. The ARN is saved on the filing.' };
    case 'cancelled':
      return { kind: 'cancelled', text: 'This run was cancelled.' };
  }
}

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
export function formatInr(n: number): string {
  return INR.format(Math.round(n * 100) / 100);
}
