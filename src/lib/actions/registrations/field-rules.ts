import { getItem } from '@/data/checklist';
import { subjectInputs, type InputField } from '@/data/compliance-inputs';
import { checkFormat } from '@/lib/ask/data-router/formats';
import { catalogEntry } from '@/lib/ask/field-catalog';
import type { RowCheck } from '@/lib/ask/changeset/types';
import { canRecordRegistrationTracker, isRegistrationTracker } from '@/lib/registrations/tracker-access';
import { heldReasonOf } from '../checklist/rules';

/**
 * The checks one registration field row (`registrations.setField`) goes through when it is
 * proposed, edited and clicked: the same rules as the "From the client" and "Filled by SBC" cards
 * (`saveSubjectFields`). Pure, so the data router's plan and the action share it.
 *
 *  - the field must be on the registration's list (`src/data/compliance-inputs.ts`);
 *  - the SBC side of the GST and LUT trackers is the project lead's (and the client's) to record,
 *    so a manager's or an admin's row is held (`tracker-access.ts`);
 *  - a value of a known shape (a date, a state from the list) is stored in that shape;
 *  - a different saved value, or a different value on the checklist step the field copies, only
 *    asks for a closer look.
 */
export interface SubjectFieldTarget {
  engagementId: string;
  kind: 'registration';
  /** The registration step id, for example `reg-4`. */
  key: string;
  side: 'client' | 'sbc';
  fieldKey: string;
  /** The catalog key the value was placed under, for its format and choices. */
  catalogKey?: string;
  /** For a GST copy: the checklist step and answer key the value copies (shown, never written). */
  homeStep?: string;
  homeField?: string;
}

export interface SubjectFieldCheck {
  checks: RowCheck[];
  heldReason: string | null;
  value: string;
  oldValue: string;
}

/** The field's definition on the registration's list for that side, or null. */
export function subjectFieldDef(key: string, side: 'client' | 'sbc', fieldKey: string): InputField | null {
  const inputs = subjectInputs('registration', { stepId: key });
  return (side === 'client' ? inputs.client : inputs.sbc).find((field) => field.key === fieldKey) ?? null;
}

/** The side a registration field sits on, or null when it is on neither list. */
export function subjectFieldSide(key: string, fieldKey: string): 'client' | 'sbc' | null {
  if (subjectFieldDef(key, 'client', fieldKey)) return 'client';
  if (subjectFieldDef(key, 'sbc', fieldKey)) return 'sbc';
  return null;
}

export function checkSubjectFieldRow(input: {
  role: string;
  target: SubjectFieldTarget;
  value: string;
  /** The value saved on the field now. */
  oldValue: string;
  /** The value on the checklist step the field copies, when it copies one. */
  homeValue?: string;
}): SubjectFieldCheck {
  const { target, role } = input;
  const checks: RowCheck[] = [];
  let value = input.value.trim();
  if (!value) checks.push({ rule: 'answer', ok: false, message: 'This needs your answer.' });
  else {
    const entry = target.catalogKey ? catalogEntry(target.catalogKey) : undefined;
    // A free-text entry (a long address) takes the value as typed.
    if (entry && entry.format !== 'longtext') {
      const format = checkFormat(entry, value);
      value = format.value;
      checks.push({ rule: 'format', ok: format.ok, ...(format.message ? { message: format.message } : {}) });
    }
  }
  const def = subjectFieldDef(target.key, target.side, target.fieldKey);
  const title = getItem(target.key)?.title ?? target.key;
  if (!def) checks.push({ rule: 'condition', ok: false, message: `Held: this field is not on "${title}".` });
  const tracker = target.side === 'sbc' && isRegistrationTracker(target.kind, target.key);
  const owner = tracker ? canRecordRegistrationTracker(role) : role !== 'client';
  checks.push({
    rule: 'owner',
    ok: owner,
    ...(owner ? {} : { message: tracker ? `Held: the project lead records "${title}". Managers and admins can view it.` : 'Held: the client gives this on their own page.' }),
  });
  const oldValue = input.oldValue.trim();
  if (oldValue && value && oldValue !== value) checks.push({ rule: 'conflict', ok: false, message: 'A different value is already saved. Accepting replaces it.' });
  const home = input.homeValue?.trim();
  if (home && value && home !== value) {
    const step = target.homeStep ? (getItem(target.homeStep)?.title ?? target.homeStep) : 'The checklist';
    checks.push({ rule: 'other_step', ok: false, message: `"${step}" holds ${home}. The GST application uses this value.` });
  }
  return { checks, heldReason: heldReasonOf(checks), value, oldValue };
}

/** The card's label for a registration field row. */
export function subjectFieldLabel(target: Pick<SubjectFieldTarget, 'key' | 'side' | 'fieldKey'>): string {
  const def = subjectFieldDef(target.key, target.side, target.fieldKey);
  const title = getItem(target.key)?.title ?? target.key;
  return `${title} · ${def?.label ?? target.fieldKey}`;
}
