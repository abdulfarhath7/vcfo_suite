import { fmtLong, type GstSchedule } from '@/lib/registrations/gst-tracker';

/**
 * LUT TRACKER (step `reg-5`) — the Letter of Undertaking, Form GST RFD-11, that lets the
 * company export goods or services without paying IGST. It is filed on the GST portal for
 * one financial year at a time.
 *
 * Firm policy SBC-STD-AI-02 applies ("Agents prepare. Humans file."): the authorised
 * signatory files the LUT on the GST portal in their own session with their own DSC or EVC.
 * This tool records what that person reads on the portal. It never signs in to the portal,
 * never holds the GST login, password, OTP or EVC, and never reads the portal for anyone.
 *
 * Date: the LUT is filed on the GST registration day from the firm calendar (see
 * `gst-tracker.ts`), so the record shows that same day.
 *
 * Stages:
 *   1. Application filed (filed on; the financial year follows from the date)
 *   2. LUT allotted     (date allotted by the GST portal, LUT number)
 *
 * The values live in the registration's SBC fields (`compliance_subject_fields`, side `sbc`,
 * key `reg-5`). `arn` and `fy` predate the tracker. Pure: no database or UI imports.
 */

export const LUT_STEP_ID = 'reg-5';

export const LUT_FIELD = {
  loginCreatedOn: 'gst-login-on',
  filedOn: 'filed-on',
  fy: 'fy',
  allottedOn: 'allotted-on',
  number: 'arn',
} as const;

export type LutStageKey = 'filing' | 'allotted';
export type LutStageState = 'done' | 'current' | 'upcoming';

type Values = Record<string, string | null | undefined>;
const v = (values: Values, key: string) => (values[key] ?? '').trim();
const isIso = (s: string | null | undefined): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));

/** The Indian financial year a date falls in: `2026-11-18` → `2026-27`. */
export function financialYearOf(isoDate: string | null | undefined): string | null {
  if (!isIso(isoDate)) return null;
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** An LUT is valid to the end of its financial year: `2026-27` → `2027-03-31`. */
export function lutValidTill(fy: string | null | undefined): string | null {
  const m = /^(\d{4})-\d{2}$/.exec((fy ?? '').trim());
  return m ? `${Number(m[1]) + 1}-03-31` : null;
}

export function lutStages(values: Values): Array<{ key: LutStageKey; state: LutStageState }> {
  const filed = Boolean(v(values, LUT_FIELD.filedOn));
  const allotted = Boolean(v(values, LUT_FIELD.number));
  return [
    { key: 'filing', state: filed || allotted ? 'done' : 'current' },
    { key: 'allotted', state: allotted ? 'done' : filed ? 'current' : 'upcoming' },
  ];
}

/** The one-line notice at the top of the LUT record; the client gets the facts without instructions. */
export function lutNotice(
  gstDay: GstSchedule,
  values: Values,
  today: string,
  audience: 'firm' | 'client' = 'firm',
): { tone: 'info' | 'warning' | 'positive' | 'danger'; text: string } | null {
  const firm = audience === 'firm';
  const number = v(values, LUT_FIELD.number);
  if (number) {
    const till = lutValidTill(v(values, LUT_FIELD.fy) || financialYearOf(v(values, LUT_FIELD.allottedOn) || v(values, LUT_FIELD.filedOn)));
    return { tone: 'positive', text: till ? `LUT ${number} is valid until ${fmtLong(till)}.` : `LUT ${number} is on record.` };
  }
  if (v(values, LUT_FIELD.filedOn)) return firm ? { tone: 'info', text: 'Filed. Record the LUT number once the GST portal allots it.' } : null;
  const { date, source } = gstDay;
  if (!date || source !== 'calendar') {
    return { tone: 'info', text: firm ? 'The LUT is filed on the GST registration day. Schedule that day on the firm calendar.' : 'The LUT is filed on the GST registration day, which is being scheduled.' };
  }
  if (today < date) return { tone: 'info', text: `The LUT is scheduled for ${fmtLong(date)}, the GST registration day.` };
  if (today === date) return { tone: 'warning', text: firm ? 'Scheduled for today: file the LUT on the GST portal, then record the filing date.' : 'The LUT is scheduled for today.' };
  return { tone: 'danger', text: `The LUT was scheduled for ${fmtLong(date)} and no filing is recorded yet.` };
}
