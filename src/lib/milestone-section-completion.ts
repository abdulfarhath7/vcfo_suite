import type { ChecklistField } from '@/data/checklist';
import type { ChecklistItemResponses } from '@/lib/checklist-responses';

/** Whether a field counts toward section/step completion (required unless explicitly optional). */
function isFieldRequiredForCompletion(field: ChecklistField): boolean {
  return field.required !== false;
}

function isFieldValueFilled(responses: ChecklistItemResponses, fieldId: string): boolean {
  return Boolean((responses[fieldId] ?? '').trim());
}

export interface SectionPendingItem {
  fieldId: string;
  label: string;
}

const DIRECTOR_COUNT_INDIA_RESIDENT_MESSAGE =
  'At least one proposed director must be a resident of India.';

/** Human-readable pending required fields for a section group. */
export function getSectionPendingItems(
  sectionFields: ChecklistField[],
  responses: ChecklistItemResponses,
  validationErrors: Record<string, string> = {},
): SectionPendingItem[] {
  const pending: SectionPendingItem[] = [];
  const seen = new Set<string>();
  const fieldIds = new Set(sectionFields.map((field) => field.id));

  for (const field of sectionFields) {
    const error = validationErrors[field.id];
    if (error) {
      if (!seen.has(field.id)) {
        pending.push({ fieldId: field.id, label: field.label });
        seen.add(field.id);
      }
      continue;
    }

    if (!isFieldRequiredForCompletion(field)) continue;
    if (!isFieldValueFilled(responses, field.id) && !seen.has(field.id)) {
      pending.push({ fieldId: field.id, label: field.label });
      seen.add(field.id);
    }
  }

  const directorCountError = validationErrors.directorCount;
  if (
    fieldIds.has('directorCount') &&
    directorCountError?.includes('resident of India') &&
    !seen.has('directorCount:india-resident')
  ) {
    pending.push({
      fieldId: 'directorCount',
      label: DIRECTOR_COUNT_INDIA_RESIDENT_MESSAGE,
    });
  }

  return pending;
}

export function isSectionFieldsComplete(
  sectionFields: ChecklistField[],
  responses: ChecklistItemResponses,
  validationErrors: Record<string, string> = {},
): boolean {
  return getSectionPendingItems(sectionFields, responses, validationErrors).length === 0;
}

