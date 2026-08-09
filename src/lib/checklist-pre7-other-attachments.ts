import type { ChecklistItemResponses } from '@/lib/checklist-responses';

export const PRE7_OTHER_ATTACHMENT_FIELD_IDS = [
  'otherAttachment1Url',
  'otherAttachment2Url',
  'otherAttachment3Url',
] as const;

export type Pre7OtherAttachmentFieldId = (typeof PRE7_OTHER_ATTACHMENT_FIELD_IDS)[number];

const PRE7_OTHER_ATTACHMENT_LABELS: Record<Pre7OtherAttachmentFieldId, string> = {
  otherAttachment1Url: 'Other attachment 1',
  otherAttachment2Url: 'Other attachment 2',
  otherAttachment3Url: 'Other attachment 3',
};

export interface Pre7OtherAttachmentLink {
  path: string;
  label: string;
  fieldId: Pre7OtherAttachmentFieldId;
}

export function buildPre7OtherAttachmentLinks(
  responses: ChecklistItemResponses,
): Pre7OtherAttachmentLink[] {
  return PRE7_OTHER_ATTACHMENT_FIELD_IDS.flatMap((fieldId) => {
    const path = responses[fieldId]?.trim() ?? '';
    return path ? [{ fieldId, path, label: PRE7_OTHER_ATTACHMENT_LABELS[fieldId] }] : [];
  });
}

export function hasPre7OtherAttachments(responses: ChecklistItemResponses): boolean {
  return buildPre7OtherAttachmentLinks(responses).length > 0;
}
