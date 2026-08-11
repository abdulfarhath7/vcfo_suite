import { describe, expect, it } from 'vitest';

import {
  allIncorpDraftSlotsGenerated,
  filterClientVisibleIncorpDrafts,
  generatedIncorpDraftRowKeys,
  isBulkIncorpShareComplete,
  isIncorpDraftSharedWithClient,
  isIncorpDraftRowKey,
  signedUploadFieldForIncorpDraft,
} from '@/lib/incorporation-docs/share';
import { incorpDraftDocSlotsFromResponses } from '@/lib/incorporation-docs/paths';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

describe('incorporation-docs share', () => {
  it('validates row keys', () => {
    expect(isIncorpDraftRowKey('dir-2:non-resident')).toBe(true);
    expect(isIncorpDraftRowKey('invalid')).toBe(false);
  });

  it('does not treat Pre-7 deliver alone as shared drafts', () => {
    const slice: ChecklistItemStateSlice = {
      status: 'in-progress',
      deliveredToClientAt: '2026-05-29T00:00:00.000Z',
    };
    expect(isIncorpDraftSharedWithClient(slice, 'dir-2', 'non-resident')).toBe(false);
  });

  it('filters client-visible drafts by bulk share list', () => {
    const slice: ChecklistItemStateSlice = {
      status: 'in-progress',
      sharedIncorpDraftDocs: ['inc-9:resident', 'dir-2:non-resident'],
    };
    const responses = {
      nrDirectorDir2DraftUrl: 'path/dir-2.docx',
      residentDirectorInc9DraftUrl: 'path/inc-9.docx',
      residentDirectorDir2DraftUrl: 'path/dir-2-r.docx',
    };
    const visible = filterClientVisibleIncorpDrafts(responses, slice);
    expect(visible).toHaveLength(2);
    expect(visible.map((v) => `${v.doc}:${v.audience}`).sort()).toEqual([
      'dir-2:non-resident',
      'inc-9:resident',
    ]);
  });

  it('detects bulk share complete when all slots generated and shared', () => {
    const responses = {
      nrDirectorDir2DraftUrl: 'a',
      residentDirectorDir2DraftUrl: 'b',
      nrDirectorDir8DraftUrl: 'c',
      residentDirectorDir8DraftUrl: 'd',
      nrDirectorInc9DraftUrl: 'e',
      residentDirectorInc9DraftUrl: 'f',
      nrDirectorPanUndertakingDraftUrl: 'g',
      moaDraftUrl: 'h',
      aoaDraftUrl: 'i',
      authorisationLetterDraftUrl: 'j',
      acceptanceLetterDraftUrl: 'k',
      moaSubscriptionSheetDraftUrl: 'l',
      aoaSubscriptionSheetDraftUrl: 'm',
    };
    const slots = incorpDraftDocSlotsFromResponses(responses);
    expect(allIncorpDraftSlotsGenerated(slots)).toBe(true);
    const keys = generatedIncorpDraftRowKeys(slots);
    expect(keys.length).toBeGreaterThanOrEqual(7);

    const slice: ChecklistItemStateSlice = {
      status: 'in-progress',
      sharedIncorpDraftDocs: keys,
      incorpDraftsSharedAt: '2026-05-29T12:00:00.000Z',
    };
    expect(isBulkIncorpShareComplete(responses, slice)).toBe(true);
  });

  it('maps draft slots to Pre-8 signed upload fields', () => {
    expect(signedUploadFieldForIncorpDraft('dir-2', 'non-resident')).toBe('nrDirectorDir2SignedUrl');
    expect(signedUploadFieldForIncorpDraft('pan-undertaking', 'non-resident')).toBe(
      'nrDirectorPanUndertakingSignedUrl',
    );
  });
});
