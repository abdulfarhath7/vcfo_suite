import { computeDueDate, type DeadlineRule } from '@/lib/projects/deadlines';
import { windowForStep, type EngagementSchedule } from '@/lib/projects/schedule-windows';

/**
 * GST REGISTRATION TRACKER (step `reg-4`) — the date and the stages SBC records while the
 * application runs on the GST portal.
 *
 * Firm policy SBC-STD-AI-02 applies ("Agents prepare. Humans file."): the authorised
 * signatory files on the GST portal in their own session with their own DSC or EVC. This
 * tool only records what happened. It never signs in to the portal, never holds the portal
 * password, an OTP or an EVC, and never reads the portal on anyone's behalf.
 *
 * One date: the day the registration is scheduled on the firm calendar (the step's schedule
 * window, start day). The application is filed on that day, and the LUT the same day. Until a
 * manager schedules it, the statutory deadline is shown and labelled as such.
 *
 * Stages, in order:
 *   1. Application filed   (filed on, ARN, ARN date)
 *   2. Aadhaar authentication (completed / yet to be done)
 *   3. SRN
 *   4. Outcome: Approved (GSTIN, date of registration, certificate)
 *               or Resubmission (reason for rejection, revised date)
 *
 * The values live in the registration's SBC fields (`compliance_subject_fields`, side `sbc`,
 * key `reg-4`), so the firm and the client read the same record. Pure: no database or UI
 * imports.
 */

export const GST_STEP_ID = 'reg-4';

/** SBC field keys on `reg-4`. `number` (GSTIN), `arn` and `jurisdiction` predate the tracker. */
export const GST_FIELD = {
  filedOn: 'filed-on',
  arn: 'arn',
  arnDate: 'arn-date',
  aadhaar: 'aadhaar',
  srn: 'srn',
  outcome: 'outcome',
  gstin: 'number',
  registeredOn: 'registered-on',
  jurisdiction: 'jurisdiction',
  rejectionReason: 'rejection-reason',
  revisedDate: 'revised-date',
} as const;

export type GstOutcome = 'approved' | 'resubmission';
export type GstStageKey = 'filing' | 'aadhaar' | 'srn' | 'outcome';
export type GstStageState = 'done' | 'current' | 'upcoming' | 'attention';

export interface GstSchedule {
  /** The day the application (and the LUT) is filed, ISO; null without a calendar day or incorporation date. */
  date: string | null;
  /** `calendar` = scheduled on the firm calendar; `deadline` = not scheduled yet, statutory deadline shown. */
  source: 'calendar' | 'deadline' | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const isIso = (v: string | null | undefined): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

/**
 * The registration's day from the firm calendar: the start of the step's schedule window
 * when a manager has set one; else the statutory deadline (two weeks after incorporation).
 */
export function gstSchedule(input: {
  schedule: EngagementSchedule | null | undefined;
  incorporationDate: string | null | undefined;
  rule: DeadlineRule;
}): GstSchedule {
  const win = windowForStep(input.schedule, GST_STEP_ID);
  if (win && isIso(win.from)) return { date: win.from, source: 'calendar' };
  if (!isIso(input.incorporationDate)) return { date: null, source: null };
  const due = computeDueDate(input.rule, new Date(`${input.incorporationDate}T00:00:00Z`));
  return due ? { date: iso(due), source: 'deadline' } : { date: null, source: null };
}

type Values = Record<string, string | null | undefined>;
const v = (values: Values, key: string) => (values[key] ?? '').trim();

export function gstOutcome(values: Values): GstOutcome | null {
  const o = v(values, GST_FIELD.outcome);
  return o === 'approved' || o === 'resubmission' ? o : null;
}

/** Each stage's state, in order. Only the first open stage is current. */
export function gstStages(values: Values): Array<{ key: GstStageKey; state: GstStageState }> {
  const done: Record<GstStageKey, boolean> = {
    filing: Boolean(v(values, GST_FIELD.arn)),
    aadhaar: v(values, GST_FIELD.aadhaar) === 'done',
    srn: Boolean(v(values, GST_FIELD.srn)),
    outcome: gstOutcome(values) === 'approved' && Boolean(v(values, GST_FIELD.gstin)),
  };
  const order: GstStageKey[] = ['filing', 'aadhaar', 'srn', 'outcome'];
  let currentGiven = false;
  return order.map((key) => {
    if (key === 'outcome' && gstOutcome(values) === 'resubmission') {
      currentGiven = true;
      return { key, state: 'attention' as const };
    }
    if (done[key]) return { key, state: 'done' as const };
    if (!currentGiven) {
      currentGiven = true;
      return { key, state: 'current' as const };
    }
    return { key, state: 'upcoming' as const };
  });
}

export type GstNoticeTone = 'info' | 'warning' | 'positive' | 'danger';

/**
 * The one-line notice at the top of the tracker. `today` is an ISO date in India time. The
 * client reads the same facts without the firm's instructions.
 */
export function gstNotice(
  schedule: GstSchedule,
  values: Values,
  today: string,
  audience: 'firm' | 'client' = 'firm',
): { tone: GstNoticeTone; text: string } | null {
  const firm = audience === 'firm';
  const outcome = gstOutcome(values);
  if (outcome === 'approved' && v(values, GST_FIELD.gstin)) {
    return { tone: 'positive', text: `Registration approved. GSTIN ${v(values, GST_FIELD.gstin)}.` };
  }
  if (outcome === 'resubmission') {
    const revised = v(values, GST_FIELD.revisedDate);
    if (revised) return { tone: 'danger', text: `Resubmission required by ${fmtLong(revised)}.` };
    return { tone: 'danger', text: firm ? 'Resubmission required. Record the revised date from the portal notice.' : 'Resubmission required.' };
  }
  if (v(values, GST_FIELD.arn)) return null;
  const { date, source } = schedule;
  if (!date) return { tone: 'info', text: 'The registration date appears once it is set on the firm calendar.' };
  if (source === 'deadline') {
    const due = `The statutory deadline is ${fmtLong(date)}.`;
    if (today > date) return { tone: 'danger', text: `The statutory deadline of ${fmtLong(date)} has passed.${firm ? ' Schedule the filing day on the firm calendar.' : ''}` };
    return { tone: 'info', text: firm ? `Not yet scheduled on the firm calendar. ${due}` : `Being scheduled. ${due}` };
  }
  if (today < date) return { tone: 'info', text: `GST registration is scheduled for ${fmtLong(date)}. The LUT is filed the same day.` };
  if (today === date) return { tone: 'warning', text: firm ? 'Scheduled for today: file the GST application and the LUT, then record the ARN.' : 'GST registration is scheduled for today.' };
  return { tone: 'danger', text: `The application was scheduled for ${fmtLong(date)} and no ARN is recorded yet.` };
}

const LONG = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** `18 Nov 2026`; a non-date passes through. */
export function fmtLong(isoDate: string | null | undefined): string {
  if (!isIso(isoDate)) return isoDate ?? '';
  return LONG.format(new Date(`${isoDate}T00:00:00Z`));
}

/** The reminder job's test: scheduled on the firm calendar for today, and nothing filed yet. */
export function gstDueToday(schedule: GstSchedule, values: Values, today: string): boolean {
  return Boolean(schedule.source === 'calendar' && schedule.date === today && !v(values, GST_FIELD.arn));
}
