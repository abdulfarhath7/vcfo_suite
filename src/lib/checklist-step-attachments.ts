import type { ChecklistItem } from '@/data/checklist';
import type { OwnershipType } from '@/data/engagements';
import { filterFieldsByViewer } from '@/lib/checklist-field-access';
import { applyShowWhen, expandRepeatFields, repeatFieldLabel } from '@/lib/checklist-repeat';
import {
  fieldsForOwnership,
  getClientResponseFields,
  type ChecklistItemResponses,
} from '@/lib/checklist-responses';
import { fileNameFromStoragePath } from '@/lib/milestone-document-storage';
import { withoutUnusedDirectorSlots } from '@/lib/incorp-director-slots';

export type StepAttachmentRequirement = {
  fieldId: string;
  label: string;
  uploaded: boolean;
  fileName?: string;
};

/** Required file fields for a checklist step, with upload state from stored responses. */
export function getStepAttachmentRequirements(
  item: ChecklistItem,
  responses?: ChecklistItemResponses,
  ownershipType?: OwnershipType,
): StepAttachmentRequirement[] {
  const fields = withoutUnusedDirectorSlots(
    item.id,
    filterFieldsByViewer(fieldsForOwnership(item.id, getClientResponseFields(item), ownershipType), 'admin'),
    responses,
  );
  // Repeat entries contribute their own file fields, labelled per entry.
  return applyShowWhen(expandRepeatFields(fields, responses ?? {}), responses ?? {})
    .filter((field) => field.type === 'file')
    .map((field) => {
      const path = responses?.[field.id]?.trim() ?? '';
      return {
        fieldId: field.id,
        label: repeatFieldLabel(fields, responses ?? {}, field.id) ?? field.label,
        uploaded: Boolean(path),
        fileName: path ? fileNameFromStoragePath(path) : undefined,
      };
    });
}
