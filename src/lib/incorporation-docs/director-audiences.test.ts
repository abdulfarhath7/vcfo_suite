import { describe, expect, it } from 'vitest';

import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import { validatePre7Responses } from '@/lib/checklist-pre7-validation';
import { getClientResponseFields } from '@/lib/checklist-responses';
import { checklist } from '@/data/checklist';
import { fieldIdMatchesPre6Prefix } from '@/lib/checklist-pre6-validation';
import { fieldsForDirectorAudiences } from '@/lib/incorp-director-slots';
import {
  audienceForDirectorFieldId,
  directorAudiencesFromPre6,
  directorFieldPrefix,
  parseDirectorAudience,
} from '@/lib/incorporation-docs/audiences';
import { buildDir2MergeFields } from '@/lib/incorporation-docs/dir2';
import {
  incorpDocDownloadFilename,
  incorpDraftDocSlotsFromResponses,
} from '@/lib/incorporation-docs/paths';
import { incorpDocTargetFromDraftField } from '@/lib/incorporation-docs/preview-url';
import {
  allIncorpDraftSlotsGenerated,
  isIncorpDraftRowKey,
  signedUploadFieldForIncorpDraft,
} from '@/lib/incorporation-docs/share';
import { audiencesForDoc, draftFieldIdFor } from '@/lib/incorporation-docs/types';
import { directorResponsesFromState, resolveDirectorEntries } from '@/lib/proposed-directors';

const NR = director('e1', 'no', 'Alpha');
const R1 = director('e2', 'yes', 'Beta');
const R2 = director('e3', 'yes', 'Gamma');
const R3 = director('e4', 'yes', 'Delta');

function keysFor(state: ReturnType<typeof fullState>) {
  return resolveDirectorEntries(state).map((e) => [e.key, e.fieldPrefix]);
}

describe('director entries', () => {
  it('1 NR + 1 resident keep the legacy keys and prefixes', () => {
    expect(keysFor(fullState([NR, R1]))).toEqual([
      ['non-resident', 'nrDirector'],
      ['resident', 'residentDirector'],
    ]);
  });

  it('2 residents and no NR', () => {
    expect(keysFor(fullState([R1, R2]))).toEqual([
      ['resident', 'residentDirector'],
      ['resident-2', 'residentDirector2'],
    ]);
  });

  it('1 NR + 3 residents', () => {
    expect(keysFor(fullState([R1, NR, R2, R3]))).toEqual([
      ['resident', 'residentDirector'],
      ['non-resident', 'nrDirector'],
      ['resident-2', 'residentDirector2'],
      ['resident-3', 'residentDirector3'],
    ]);
  });

  it('missing pre-6 and pre-15 → no entries, legacy audiences for slot layout', () => {
    expect(resolveDirectorEntries({})).toEqual([]);
    expect(directorAudiencesFromPre6(directorResponsesFromState({}).pre6)).toEqual([
      'non-resident',
      'resident',
    ]);
  });

  it('audiences read off the synthesised pre-6 map match the entries', () => {
    const state = fullState([R1, NR, R2, R3]);
    expect(directorAudiencesFromPre6(directorResponsesFromState(state).pre6)).toEqual([
      'non-resident',
      'resident',
      'resident-2',
      'resident-3',
    ]);
  });

  it('nrDirector never matches nrDirector2 fields', () => {
    expect(fieldIdMatchesPre6Prefix('nrDirector2FirstName', 'nrDirector')).toBe(false);
    expect(audienceForDirectorFieldId('nrDirector2FirstName')).toBe('non-resident-2');
    expect(audienceForDirectorFieldId('nrDirectorFirstName')).toBe('non-resident');
    expect(audienceForDirectorFieldId('residentDirector12FirstName')).toBeNull();
    expect(parseDirectorAudience('resident-1')).toBeNull();
    expect(directorFieldPrefix('resident-2')).toBe('residentDirector2');
  });
});

describe('per-director drafts', () => {
  it('slot-1 response ids and filenames are unchanged', () => {
    expect(draftFieldIdFor('dir-2', 'non-resident')).toBe('nrDirectorDir2DraftUrl');
    expect(draftFieldIdFor('inc-9', 'resident')).toBe('residentDirectorInc9DraftUrl');
    expect(draftFieldIdFor('pan-undertaking', 'non-resident')).toBe('nrDirectorPanUndertakingDraftUrl');
    expect(draftFieldIdFor('pan-undertaking', 'resident')).toBeNull();
    expect(draftFieldIdFor('moa', 'company')).toBe('moaDraftUrl');
    expect(incorpDocDownloadFilename('dir-2', 'resident')).toBe('dir-2-resident-director.docx');
    expect(incorpDocDownloadFilename('pan-undertaking', 'non-resident')).toBe(
      'pan-undertaking-non-resident-director.docx',
    );
    expect(signedUploadFieldForIncorpDraft('dir-8', 'non-resident')).toBe('nrDirectorDir8SignedUrl');
    expect(signedUploadFieldForIncorpDraft('authorisation-letter', 'company')).toBe(
      'authorisationLetterSignedUrl',
    );
  });

  it('later directors get their own ids, row keys and filenames', () => {
    expect(draftFieldIdFor('dir-8', 'resident-2')).toBe('residentDirector2Dir8DraftUrl');
    expect(signedUploadFieldForIncorpDraft('dir-8', 'resident-2')).toBe('residentDirector2Dir8SignedUrl');
    expect(incorpDocDownloadFilename('dir-2', 'resident-2')).toBe('dir-2-resident-director-2.docx');
    expect(isIncorpDraftRowKey('dir-2:resident-2')).toBe(true);
    expect(isIncorpDraftRowKey('dir-2:resident-99')).toBe(false);
    expect(incorpDocTargetFromDraftField('residentDirector2Dir8DraftUrl')).toEqual({
      doc: 'dir-8',
      audience: 'resident-2',
    });
    expect(incorpDocTargetFromDraftField('moaDraftUrl')).toEqual({ doc: 'moa', audience: 'company' });
  });

  it('2 residents: slots skip the non-resident forms entirely', () => {
    const { pre6 } = directorResponsesFromState(fullState([R1, R2]));
    const slots = incorpDraftDocSlotsFromResponses({}, { pre6 });
    const director = slots.filter((s) => s.audience !== 'company').map((s) => `${s.doc}:${s.audience}`);
    expect(director).toEqual([
      'dir-2:resident',
      'dir-2:resident-2',
      'dir-8:resident',
      'dir-8:resident-2',
      'inc-9:resident',
      'inc-9:resident-2',
    ]);
    expect(audiencesForDoc('pan-undertaking', ['resident', 'resident-2'])).toEqual([]);
  });

  it('1 NR + 1 resident: the slot list is exactly the legacy one', () => {
    const { pre6 } = directorResponsesFromState(fullState([NR, R1]));
    const withDirectors = incorpDraftDocSlotsFromResponses({}, { pre6 }).map((s) => `${s.doc}:${s.audience}`);
    const legacy = incorpDraftDocSlotsFromResponses({}).map((s) => `${s.doc}:${s.audience}`);
    expect(withDirectors).toEqual(legacy);
  });

  it('a stored draft never disappears from the slot list', () => {
    const slots = incorpDraftDocSlotsFromResponses({ residentDirector3Dir2DraftUrl: 'x/y/1-a.docx' });
    expect(slots.some((s) => s.doc === 'dir-2' && s.audience === 'resident-3')).toBe(true);
  });

  it('a frozen pre-7 does not require slots added since', () => {
    const { pre6 } = directorResponsesFromState(fullState([NR, R1, R2]));
    const responses = Object.fromEntries(
      incorpDraftDocSlotsFromResponses({}, { pre6: directorResponsesFromState(fullState([NR, R1])).pre6 }).map(
        (s) => [draftFieldIdFor(s.doc, s.audience) as string, 'x/y/1-a.docx'],
      ),
    );
    expect(allIncorpDraftSlotsGenerated(incorpDraftDocSlotsFromResponses(responses, { pre6 }))).toBe(false);
    expect(
      allIncorpDraftSlotsGenerated(incorpDraftDocSlotsFromResponses(responses, { pre6, frozen: true })),
    ).toBe(true);
  });

  it('DIR-2 for resident-2 reads the second resident', () => {
    const { pre6 } = directorResponsesFromState(fullState([R1, R2]));
    const fields = buildDir2MergeFields({ pre6, director: 'resident-2' });
    expect(fields.DIRECTOR_FULL_NAME).toBe('Gamma Director');
    expect(fields.DOCUMENT_PLACE).toBe('India');
  });
});

describe('pre-7 fields and validator follow the directors', () => {
  const pre7 = checklist.find((c) => c.id === 'pre-7')!;
  const fields = getClientResponseFields(pre7);

  it('without director context the legacy two slots are required, as before', () => {
    const errors = validatePre7Responses({}).errors;
    expect(errors.nrDirectorDir2DraftUrl).toBeDefined();
    expect(errors.residentDirectorDir2DraftUrl).toBeDefined();
    expect(errors.residentDirector2Dir2DraftUrl).toBeUndefined();
  });

  it('2 residents: no NR requirement, resident-2 required', () => {
    const errors = validatePre7Responses({}, { directors: ['resident', 'resident-2'] }).errors;
    expect(errors.nrDirectorDir2DraftUrl).toBeUndefined();
    expect(errors.nrDirectorDscSuccessMessageUrl).toBeUndefined();
    expect(errors.residentDirector2Dir2DraftUrl).toBeDefined();
    expect(errors.residentDirector2DscSuccessMessageUrl).toBeDefined();
  });

  it('frozen: resident-2 becomes optional', () => {
    const slots = { directors: ['resident', 'resident-2'] as const, frozen: true };
    expect(validatePre7Responses({}, slots).errors.residentDirector2Dir2DraftUrl).toBeUndefined();
    const visible = fieldsForDirectorAudiences(fields, slots);
    const r2 = visible.find((f) => f.id === 'residentDirector2Dir2DraftUrl');
    expect(r2?.required).toBe(false);
  });

  it('only the directors on file are visible; slot-1 ids are unchanged', () => {
    const visible = fieldsForDirectorAudiences(fields, { directors: ['non-resident', 'resident'] });
    expect(visible.map((f) => f.id)).toEqual(
      fields.filter((f) => !/^(nrDirector|residentDirector)\d/.test(f.id)).map((f) => f.id),
    );
    const label = fields.find((f) => f.id === 'residentDirector2Dir2DraftUrl')?.label;
    expect(label).toBe('DIR-2 draft - Resident Director 2');
  });
});
