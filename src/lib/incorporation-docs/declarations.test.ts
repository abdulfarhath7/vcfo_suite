import PizZip from 'pizzip';
import { describe, expect, it, vi } from 'vitest';

import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import { renderIncorpDocxBuffer } from '@/lib/incorporation-docs/docx';
import { incorpDraftDocSlotsFromResponses } from '@/lib/incorporation-docs/paths';
import { allIncorpDraftSlotsGenerated, signedUploadFieldForIncorpDraft } from '@/lib/incorporation-docs/share';
import { audiencesForDoc, draftFieldIdFor } from '@/lib/incorporation-docs/types';
import { directorResponsesFromState } from '@/lib/proposed-directors';
import { validatePre7Responses } from '@/lib/checklist-pre7-validation';
import { validatePre8Responses } from '@/lib/checklist-pre8-validation';

vi.mock('server-only', () => ({}));

function text(buffer: Buffer): string {
  const xml: string = new PizZip(buffer).file('word/document.xml')!.asText();
  return xml.replace(/<[^>]+>/g, '');
}

const WITH_DIN = director('e1', 'yes', 'Alpha', { din: '01234567', gender: 'female' });
const NO_DIN = director('e2', 'yes', 'Beta');

describe('ID & address and deposit declarations', () => {
  const state = fullState([WITH_DIN, NO_DIN]);
  const { pre1, pre6 } = directorResponsesFromState(state);
  const pre5 = { approvedCompanyName: 'Test Company Private Limited' };

  it('ID & address declaration only for directors who hold a DIN', () => {
    expect(audiencesForDoc('id-address-declaration', ['resident', 'resident-2'], pre6)).toEqual(['resident']);
    expect(audiencesForDoc('deposit-declaration', ['resident', 'resident-2'], pre6)).toEqual([
      'resident',
      'resident-2',
    ]);
  });

  it('renders every tag, with D/o for a female director', () => {
    const idDecl = text(renderIncorpDocxBuffer('id-address-declaration', { pre1, pre5, pre6, director: 'resident' }));
    expect(idDecl).not.toContain('{');
    expect(idDecl).toContain('I, Alpha Director, D/o Test Father, residing at 1 Test Street, Test City');
    expect(idDecl).toContain('First Director of Test Company Private Limited');
    expect(idDecl).toContain('DIN: 01234567');

    const deposit = text(renderIncorpDocxBuffer('deposit-declaration', { pre1, pre5, pre6, director: 'resident-2' }));
    expect(deposit).not.toContain('{');
    expect(deposit).toContain('I, Beta Director, S/o Test Father');
    expect(deposit).toContain('ARTICLES OF ASSOCIATION OF Test Company Private Limited — PROPOSED');
    expect(deposit).toContain('Place: India');
  });

  it('response ids follow the per-director pattern', () => {
    expect(draftFieldIdFor('deposit-declaration', 'resident-2')).toBe('residentDirector2DepositDeclarationDraftUrl');
    expect(signedUploadFieldForIncorpDraft('id-address-declaration', 'non-resident')).toBe(
      'nrDirectorIdAddressDeclarationSignedUrl',
    );
  });

  it('never reopen a finished pre-7 or pre-8', () => {
    const legacyKinds = new Set(['dir-2', 'dir-8', 'inc-9', 'pan-undertaking', 'moa', 'aoa',
      'authorisation-letter', 'acceptance-letter', 'moa-subscription-sheet', 'aoa-subscription-sheet']);
    const slots = incorpDraftDocSlotsFromResponses({}, { pre6 });
    const done = Object.fromEntries(
      slots.filter((s) => legacyKinds.has(s.doc)).map((s) => [draftFieldIdFor(s.doc, s.audience)!, 'a/b/1-x.docx']),
    );
    expect(allIncorpDraftSlotsGenerated(incorpDraftDocSlotsFromResponses(done, { pre6 }))).toBe(true);
    const directors = ['resident', 'resident-2'] as const;
    expect(Object.keys(validatePre7Responses({}, { directors }).errors).some((k) => k.includes('Declaration'))).toBe(false);
    expect(Object.keys(validatePre8Responses({}, { directors }).errors).some((k) => k.includes('Declaration'))).toBe(false);
  });
});
