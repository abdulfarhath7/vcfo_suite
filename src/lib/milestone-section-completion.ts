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

/** Human-readable pending required fields for a section group. */
export function getSectionPendingItems(
  sectionFields: ChecklistField[],
  responses: ChecklistItemResponses,
  validationErrors: Record<string, string> = {},
): SectionPendingItem[] {
  const pending: SectionPendingItem[] = [];
  const seen = new Set<string>();

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

  return pending;
}

export function isSectionFieldsComplete(
  sectionFields: ChecklistField[],
  responses: ChecklistItemResponses,
  validationErrors: Record<string, string> = {},
): boolean {
  return getSectionPendingItems(sectionFields, responses, validationErrors).length === 0;
}

