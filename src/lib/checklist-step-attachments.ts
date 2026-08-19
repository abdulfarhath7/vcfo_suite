import type { ChecklistItem } from '@/data/checklist';
import { filterFieldsByViewer } from '@/lib/checklist-field-access';
import {
  getClientResponseFields,
  type ChecklistItemResponses,
} from '@/lib/checklist-responses';
import { fileNameFromStoragePath } from '@/lib/milestone-document-storage';

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
): StepAttachmentRequirement[] {
  return filterFieldsByViewer(getClientResponseFields(item), 'admin')
    .filter((field) => field.type === 'file')
    .map((field) => {
      const path = responses?.[field.id]?.trim() ?? '';
      return {
        fieldId: field.id,
        label: field.label,
        uploaded: Boolean(path),
        fileName: path ? fileNameFromStoragePath(path) : undefined,
      };
    });
}
