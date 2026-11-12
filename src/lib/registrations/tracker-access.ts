import { GST_FIELD, GST_STEP_ID } from '@/lib/registrations/gst-tracker';
import { LUT_FIELD, LUT_STEP_ID } from '@/lib/registrations/lut-tracker';

/**
 * Who records the GST registration and LUT trackers, and what a save copies onto the
 * checklist step.
 *
 * Owner rule (12 November 2026): the project lead and the client fill the trackers. The
 * manager, the admin and the super admin see what has happened but do not record it. The
 * repository enforces the rule (`saveSubjectFields`); the pages use it to show the fields or
 * the read-only record.
 */

const TRACKER_STEP_IDS: ReadonlySet<string> = new Set([GST_STEP_ID, LUT_STEP_ID]);

/** True for the registration subjects whose SBC fields are the GST and LUT trackers. */
export function isRegistrationTracker(kind: string, key: string): boolean {
  return kind === 'registration' && TRACKER_STEP_IDS.has(key);
}

/** The project lead (`intern`) and the client record the trackers; everyone else reads. */
export function canRecordRegistrationTracker(role: string | null | undefined): boolean {
  return role === 'intern' || role === 'client';
}

/**
 * The checklist answers a tracker save also writes, so the registration facts, the GST
 * return calendar and the credentials workbook read the same values. Only the keys present
 * in the save are copied; an empty value clears the answer. Null when nothing is copied.
 */
export function trackerChecklistMirror(key: string, patch: Record<string, string | null>): Record<string, string> | null {
  const pairs: Array<[string, string]> =
    key === GST_STEP_ID
      ? [
          [GST_FIELD.gstin, 'gstinNumber'],
          [GST_FIELD.registeredOn, 'gstRegistrationDate'],
        ]
      : key === LUT_STEP_ID
        ? [
            [LUT_FIELD.filedOn, 'lutFilingDate'],
            [LUT_FIELD.number, 'lutArn'],
          ]
        : [];
  const out: Record<string, string> = {};
  for (const [field, answer] of pairs) {
    if (field in patch) out[answer] = (patch[field] ?? '').trim();
  }
  return Object.keys(out).length ? out : null;
}
