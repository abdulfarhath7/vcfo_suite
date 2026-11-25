import { getItem } from '@/data/checklist';
import { subjectInputs } from '@/data/compliance-inputs';
import { GST_FIELD, GST_STEP_ID } from '@/lib/registrations/gst-tracker';
import generated from './catalog.generated.json';
import { NOT_WRITABLE } from './rules';
import type { CatalogEntry, FieldUse } from './types';

/** The written catalog (`npm run ask:catalog`). Reading it costs nothing per request. */
export const FIELD_CATALOG = generated as CatalogEntry[];

const BY_KEY = new Map(FIELD_CATALOG.map((entry) => [entry.key, entry]));

export function catalogEntry(key: string): CatalogEntry | undefined {
  return BY_KEY.get(key);
}

/** The GST tracker's own milestones (filed on, ARN, outcome …) are recorded on the tracker, never from a paper. */
const GST_TRACKER_KEYS: ReadonlySet<string> = new Set(Object.values(GST_FIELD).filter((key) => key !== GST_FIELD.jurisdiction));
const GST_STEP_KEYS: ReadonlySet<string> = (() => {
  const inputs = subjectInputs('registration', { stepId: GST_STEP_ID });
  return new Set([...inputs.client, ...inputs.sbc].map((field) => field.key.replace(/-\d+-/, '-#-')));
})();

/** A GST step field (`reg-4`, client or SBC side) the data router may fill; `promoter-#-address` is per director. */
export function isGstStepUse(use: FieldUse): boolean {
  return use.source === 'registration' && use.ref === GST_STEP_ID && GST_STEP_KEYS.has(use.field) && !GST_TRACKER_KEYS.has(use.field);
}

/**
 * A use the data router may fill: an incorporation checklist step, with no workflow stamp or
 * numbered slot, or a field of the GST step (`reg-4`), which holds what REG-01 asks that no
 * checklist step does and the GST copies of values on finished steps.
 */
export function isWritableUse(use: FieldUse): boolean {
  if (isGstStepUse(use)) return true;
  if (use.source !== 'checklist' || use.field.includes('#') || NOT_WRITABLE.test(use.field)) return false;
  const bucket = getItem(use.ref)?.bucket;
  return bucket === 'pre-inc' || bucket === 'post-inc';
}

/** A list with no person behind it (extra NIC codes) has no way to say which entry a value is for. */
const REPEATS_WITH_A_PERSON = new Set(['directors', 'subscribers']);

export function writableUses(entry: CatalogEntry): FieldUse[] {
  return entry.uses.filter((use) => isWritableUse(use) && (!use.repeat || REPEATS_WITH_A_PERSON.has(use.repeat)));
}

export function entryForField(stepId: string, fieldId: string, repeat?: string): CatalogEntry | undefined {
  const slotless = fieldId.replace(/\d+(?=[A-Z])/, '#');
  return FIELD_CATALOG.find((entry) =>
    entry.uses.some((use) => use.source === 'checklist' && use.ref === stepId && (use.field === fieldId || use.field === slotless) && use.repeat === repeat),
  );
}
