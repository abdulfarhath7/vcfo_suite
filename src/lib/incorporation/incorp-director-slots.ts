import type { ChecklistField } from '@/data/checklist';
import {
  audienceForDirectorFieldId,
  directorAudienceKey,
  directorAudienceLabel,
  directorFieldPrefix,
  isLegacyDirectorAudience,
  LEGACY_DIRECTOR_AUDIENCES,
  MAX_DIRECTOR_SLOTS_PER_KIND,
  parseDirectorAudience,
  type IncorpDirectorAudience,
} from '@/lib/incorporation-docs/audiences';

/**
 * PER-DIRECTOR FIELDS ON PRE-7 / PRE-8.
 *
 * Both steps declare their director fields for slot 1 only (`nrDirector…`,
 * `residentDirector…`). Like pre-6's KYC slots, the field list is a static
 * superset: `expandDirectorSlotFields` appends slots 2…N after each slot-1
 * field, and `fieldsForDirectorAudiences` shows only the directors on file.
 * Slot-1 ids are untouched, so every stored response keeps resolving.
 */

/** Steps whose director fields are expanded by `expandDirectorSlotFields`. */
export const DIRECTOR_SLOT_STEP_IDS: ReadonlySet<string> = new Set(['pre-7', 'pre-8']);

export interface DirectorSlotContext {
  /** Director audiences on file (`directorAudiencesFromPre6`). Absent → the two legacy slots. */
  directors?: readonly IncorpDirectorAudience[];
  /** Step already shared / accepted: slots beyond the legacy two are optional. */
  frozen?: boolean;
}

function relabel(label: string, from: IncorpDirectorAudience, to: IncorpDirectorAudience): string {
  const fromLabel = directorAudienceLabel(from);
  const toLabel = directorAudienceLabel(to);
  return label.includes(fromLabel) ? label.replace(fromLabel, toLabel) : `${label} — ${toLabel}`;
}

/** Slot-1 director fields followed by their slot 2…N copies; other fields unchanged. */
export function expandDirectorSlotFields(fields: ChecklistField[]): ChecklistField[] {
  const out: ChecklistField[] = [];
  for (const field of fields) {
    out.push(field);
    const audience = audienceForDirectorFieldId(field.id);
    const parsed = audience ? parseDirectorAudience(audience) : null;
    if (!audience || !parsed || parsed.slot !== 1) continue;
    const rest = field.id.slice(directorFieldPrefix(audience).length);
    for (let slot = 2; slot <= MAX_DIRECTOR_SLOTS_PER_KIND; slot += 1) {
      const next = directorAudienceKey(parsed.kind, slot);
      out.push({
        ...field,
        id: `${directorFieldPrefix(next)}${rest}`,
        label: relabel(field.label, audience, next),
      });
    }
  }
  return out;
}

function isDirectorFieldVisible(fieldId: string, directors: readonly IncorpDirectorAudience[]): boolean {
  const audience = audienceForDirectorFieldId(fieldId);
  return !audience || directors.includes(audience);
}

/** Director fields limited to the directors on file; frozen extra slots lose `required`. */
export function fieldsForDirectorAudiences(
  fields: ChecklistField[],
  context?: DirectorSlotContext,
): ChecklistField[] {
  const directors = context?.directors?.length ? context.directors : LEGACY_DIRECTOR_AUDIENCES;
  return fields.flatMap((field) => {
    if (!isDirectorFieldVisible(field.id, directors)) return [];
    const audience = audienceForDirectorFieldId(field.id);
    if (context?.frozen && audience && !isLegacyDirectorAudience(audience) && field.required) {
      return [{ ...field, required: false }];
    }
    return [field];
  });
}

/**
 * Required ids for a validator: slot-1 ids as declared, expanded to the
 * directors on file. Company ids pass through.
 */
export function requiredIdsForDirectors(
  slotOneIds: readonly string[],
  context?: DirectorSlotContext,
): string[] {
  const directors = context?.directors?.length ? context.directors : LEGACY_DIRECTOR_AUDIENCES;
  const out: string[] = [];
  for (const id of slotOneIds) {
    const audience = audienceForDirectorFieldId(id);
    const parsed = audience ? parseDirectorAudience(audience) : null;
    if (!audience || !parsed) {
      out.push(id);
      continue;
    }
    const rest = id.slice(directorFieldPrefix(audience).length);
    for (const director of directors) {
      const d = parseDirectorAudience(director);
      if (!d || d.kind !== parsed.kind) continue;
      if (context?.frozen && !isLegacyDirectorAudience(director)) continue;
      out.push(`${directorFieldPrefix(director)}${rest}`);
    }
  }
  return out;
}

/**
 * For read-only lists without director context (summaries, attachment rails,
 * field previews): drop slot 2…N fields unless that director already has a
 * value on this step. Slot-1 and company fields are always kept.
 */
export function withoutUnusedDirectorSlots(
  itemId: string,
  fields: ChecklistField[],
  responses: Record<string, string | undefined> | undefined,
): ChecklistField[] {
  // Pre-6 owns its own `nrDirector2…` KYC slots and visibility rules.
  if (!DIRECTOR_SLOT_STEP_IDS.has(itemId)) return fields;
  const used = new Set<IncorpDirectorAudience>();
  for (const [id, value] of Object.entries(responses ?? {})) {
    if (!value?.trim()) continue;
    const audience = audienceForDirectorFieldId(id);
    if (audience) used.add(audience);
  }
  return fields.filter((field) => {
    const audience = audienceForDirectorFieldId(field.id);
    return !audience || isLegacyDirectorAudience(audience) || used.has(audience);
  });
}
