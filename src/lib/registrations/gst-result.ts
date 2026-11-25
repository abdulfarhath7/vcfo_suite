import { z } from 'zod';
import { GST_FORM_ID } from './gst-profile';
import { GST_FIELD } from './gst-tracker';

/**
 * GST REG-01 RESULT — what VCFO Assist posts back after the person has submitted the application
 * on the GST portal (`POST /api/assist/engagements/{id}/result` with `form: 'gst-reg-01'`), and
 * the reg-4 tracker values it becomes. Each later stage posts again with the same form (the SRN,
 * the GSTIN, Aadhaar done). Pure, so the route and the tests share it.
 */

/**
 * ARN: `AA`, the two-digit state code, then eleven letters or digits (15 characters, the portal's
 * "15 digit ARN": state, MMYY, seven characters). Seventeen characters are accepted too, the
 * longer form older notices print (AA + state + DDMMYY + seven).
 */
export const ARN_RE = /^AA\d{2}[0-9A-Z]{11}(?:[0-9A-Z]{2})?$/;
/** GSTIN: state code, PAN, entity number, `Z`, check character. */
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const SRN_RE = /^[0-9A-Z-]{6,24}$/;

const upper = (v: string) => v.trim().toUpperCase().replace(/\s+/g, '');
const day = z
  .string()
  .trim()
  .refine((v) => /^\d{2}\/\d{2}\/\d{4}$/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Dates are DD/MM/YYYY');

export const gstResultSchema = z
  .object({
    form: z.literal(GST_FORM_ID),
    arn: z.string().transform(upper).refine((v) => ARN_RE.test(v), 'That is not a GST ARN (15 characters, starting AA and the state code)').optional(),
    arnDate: day.optional(),
    srn: z.string().transform(upper).refine((v) => SRN_RE.test(v), 'That is not an SRN').optional(),
    gstin: z.string().transform(upper).refine((v) => GSTIN_RE.test(v), 'That is not a GSTIN').optional(),
    registeredOn: day.optional(),
    aadhaar: z.enum(['done', 'pending']).optional(),
    /** The tracker row; the extension sends `registration` / `reg-4` unless the profile names another. */
    subjectKind: z.literal('registration').optional(),
    subjectKey: z.literal('reg-4').optional(),
    /** The older schema's copy of the ARN; ignored. */
    reference: z.string().max(40).optional(),
    status: z.string().max(40).optional(),
    capturedAt: z.string().max(40).optional(),
    fieldsWritten: z.number().int().min(0).max(10_000).optional(),
    mismatches: z.array(z.unknown()).max(500).optional(),
  })
  .refine((b) => Boolean(b.arn || b.srn || b.gstin || b.aadhaar), 'Send an ARN, an SRN, a GSTIN or the Aadhaar state')
  // The extension also sends the ARN as `srn` for the older schema; that copy is not an SRN.
  .transform((b) => (b.srn && b.arn && b.srn === b.arn ? { ...b, srn: undefined } : b));
export type GstResultBody = z.infer<typeof gstResultSchema>;

/** `25/11/2026` or `2026-11-25` → `2026-11-25`; anything else null. */
export function isoDay(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * The tracker values a result sets. Only keys the post names are set, so a later SRN post
 * never clears the ARN. `today` (ISO, India time) is the filing day when the post gives none.
 */
export function gstTrackerPatch(body: GstResultBody, today: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (body.arn) {
    out[GST_FIELD.arn] = body.arn;
    const date = isoDay(body.arnDate) ?? today;
    out[GST_FIELD.arnDate] = date;
    out[GST_FIELD.filedOn] = date;
  }
  if (body.aadhaar) out[GST_FIELD.aadhaar] = body.aadhaar;
  if (body.srn) out[GST_FIELD.srn] = body.srn;
  if (body.gstin) {
    out[GST_FIELD.gstin] = body.gstin;
    out[GST_FIELD.outcome] = 'approved';
    const on = isoDay(body.registeredOn);
    if (on) out[GST_FIELD.registeredOn] = on;
  }
  return out;
}

/** Only the values that differ from what the tracker already holds (a repeated post changes nothing). */
export function changedOnly(patch: Record<string, string>, current: Record<string, string | null | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(patch).filter(([k, v]) => (current[k] ?? '').trim() !== v));
}

/** A GSTIN carries the company PAN in characters 3 to 12; a different PAN is someone else's GSTIN. */
export function gstinMatchesPan(gstin: string, pan: string | null | undefined): boolean {
  const p = (pan ?? '').trim().toUpperCase();
  return !p || gstin.slice(2, 12) === p;
}
