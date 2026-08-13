import { describe, expect, it } from 'vitest';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist-responses';
import {
  buildPre7OtherAttachmentLinks,
  PRE7_OTHER_ATTACHMENT_FIELD_IDS,
} from '@/lib/checklist-pre7-other-attachments';
import { validatePre7Responses } from '@/lib/checklist-pre7-validation';

const PRE7_REQUIRED_FILE_IDS = [
  'nrDirectorDscSuccessMessageUrl',
  'residentDirectorDscSuccessMessageUrl',
  'nrDirectorDir2DraftUrl',
  'residentDirectorDir2DraftUrl',
  'nrDirectorDir8DraftUrl',
  'residentDirectorDir8DraftUrl',
  'nrDirectorInc9DraftUrl',
  'residentDirectorInc9DraftUrl',
  'moaDraftUrl',
  'aoaDraftUrl',
  'authorisationLetterDraftUrl',
  'acceptanceLetterDraftUrl',
  'boardResolutionDraftForIncorpUrl',
  'moaSubscriptionSheetDraftUrl',
  'aoaSubscriptionSheetDraftUrl',
] as const;

function minimalValidPre7Responses(): Record<string, string> {
  return {
    kycReviewStatus: 'approved',
    kycReviewNotes: 'All documents verified.',
    ...Object.fromEntries(PRE7_REQUIRED_FILE_IDS.map((id) => [id, `eng/pre-7/${id}/file.pdf`])),
  };
}

describe('pre-7 other attachment fields', () => {
  it('registers three optional intern file slots on pre-7', () => {
    const fields = CLIENT_RESPONSE_FIELDS['pre-7'] ?? [];
    for (const id of PRE7_OTHER_ATTACHMENT_FIELD_IDS) {
      const field = fields.find((f) => f.id === id);
      expect(field).toBeDefined();
      expect(field?.type).toBe('file');
      expect(field?.filledBy).toBe('intern');
      expect(field?.section).toBe('Other attachments (optional)');
      expect(field?.required).toBeFalsy();
    }
  });

  it('buildPre7OtherAttachmentLinks returns only uploaded slots', () => {
    const links = buildPre7OtherAttachmentLinks({
      otherAttachment1Url: 'eng/pre-7/other/a.pdf',
      otherAttachment3Url: 'eng/pre-7/other/c.pdf',
    });
    expect(links).toHaveLength(2);
    expect(links[0]?.fieldId).toBe('otherAttachment1Url');
    expect(links[1]?.fieldId).toBe('otherAttachment3Url');
  });
});

describe('validatePre7Responses', () => {
  it('does not require other attachment fields', () => {
    const { ok, errors } = validatePre7Responses(minimalValidPre7Responses());
    expect(ok).toBe(true);
    for (const id of PRE7_OTHER_ATTACHMENT_FIELD_IDS) {
      expect(errors[id]).toBeUndefined();
    }
  });

  it('accepts optional other attachments without affecting validation', () => {
    const { ok, errors } = validatePre7Responses({
      ...minimalValidPre7Responses(),
      otherAttachment1Url: 'eng/pre-7/other/extra.pdf',
    });
    expect(ok).toBe(true);
    expect(errors).toEqual({});
  });
});
