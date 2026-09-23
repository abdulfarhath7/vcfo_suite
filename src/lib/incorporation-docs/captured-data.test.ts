import PizZip from 'pizzip';
import { describe, expect, it, vi } from 'vitest';

import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import { validatePre15Responses } from '@/lib/checklist-part-b-validation';
import { pre15Responses } from '@/lib/doc-pack/__tests__/fixtures';
import { renderDir8DocxBuffer, renderPanUndertakingDocxBuffer } from '@/lib/incorporation-docs/docx';
import { buildDir2MergeFields } from '@/lib/incorporation-docs/dir2';
import { buildDir8MergeFields } from '@/lib/incorporation-docs/dir8';
import { buildInc9MergeFields } from '@/lib/incorporation-docs/inc9';
import { formatDocumentDate, signingDate, signingPlace } from '@/lib/incorporation-docs/shared';
import { isValidCinOrLlpin } from '@/lib/other-company-interests';
import { directorResponsesFromState } from '@/lib/proposed-directors';

vi.mock('server-only', () => ({}));

const INTERESTS = {
  hasOtherCompanyInterest: 'yes',
  otherInterest1Company: 'Test Holdings Private Limited',
  otherInterest1Cin: 'U12345KA2020PTC123456',
  otherInterest1Designation: 'Director',
  otherInterest1From: '2020-04-01',
  otherInterest2Company: 'Test Ventures LLP',
  otherInterest2Cin: 'AAB-1234',
  otherInterest2Designation: 'Designated Partner',
  otherInterest2From: '2019-01-15',
  otherInterest2To: '2022-03-31',
};

function pre6For(...dirs: ReturnType<typeof director>[]) {
  return directorResponsesFromState(fullState(dirs)).pre6;
}

function documentText(buffer: Buffer): string {
  const xml = new PizZip(buffer).file('word/document.xml')!.asText();
  return xml.replace(/<[^>]+>/g, '');
}

function tableRowsContaining(buffer: Buffer, text: string): number {
  const xml = new PizZip(buffer).file('word/document.xml')!.asText();
  return (xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).filter((row) =>
    row.replace(/<[^>]+>/g, '').includes(text),
  ).length;
}

describe('DIR-2 reads captured director data', () => {
  it('DIN, directorship count and CS membership from the pre-15 entry', () => {
    const pre6 = pre6For(
      director('e1', 'yes', 'Alpha', { din: '01234567', csMembershipOrCopNumber: 'A12345', ...INTERESTS }),
      director('e2', 'yes', 'Beta'),
    );
    const d1 = buildDir2MergeFields({ pre6, director: 'resident' });
    expect(d1.DIRECTOR_DIN).toBe('01234567');
    expect(d1.DIRECTOR_OTHER_DIRECTORSHIPS).toBe('2');
    expect(d1.DIRECTOR_MEMBERSHIP).toBe('A12345');
  });

  it('nothing captured → the old defaults', () => {
    const pre6 = pre6For(director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta'));
    const fields = buildDir2MergeFields({ pre6, director: 'resident' });
    expect(fields.DIRECTOR_DIN).toBe('-');
    expect(fields.DIRECTOR_OTHER_DIRECTORSHIPS).toBe('NIL');
    expect(fields.DIRECTOR_MEMBERSHIP).toBe('NIL');
  });

  it('legacy engagements read the DIN from Part A', () => {
    const state = {
      'pre-1': {
        status: 'completed' as const,
        responses: {
          directorCount: '2',
          director1FirstName: 'Test',
          director1LastName: 'One',
          director1IndiaResident: 'yes',
          director1Din: '01234567',
          director2FirstName: 'Test',
          director2LastName: 'Two',
          director2IndiaResident: 'no',
        },
      },
      'pre-6': { status: 'completed' as const, responses: { residentDirectorFatherName: 'Test Father' } },
    };
    const { pre6 } = directorResponsesFromState(state);
    expect(buildDir2MergeFields({ pre6, director: 'resident' }).DIRECTOR_DIN).toBe('01234567');
    expect(pre6.residentDirectorFatherName).toBe('Test Father');
  });
});

describe('DIR-8 prior directorship table', () => {
  it('one row per interest in the rendered XML', () => {
    const pre6 = pre6For(director('e1', 'yes', 'Alpha', INTERESTS), director('e2', 'yes', 'Beta'));
    const fields = buildDir8MergeFields({ pre6, director: 'resident' });
    expect(fields.PRIOR_DIRECTORSHIPS).toHaveLength(2);
    expect(fields.PRIOR_DIRECTORSHIPS[1]).toEqual({
      PRIOR_DIR_COMPANY: 'Test Ventures LLP',
      PRIOR_DIR_CIN: 'AAB-1234',
      PRIOR_DIR_FROM: '15/01/2019',
      PRIOR_DIR_TO: '31/03/2022',
    });

    const buffer = renderDir8DocxBuffer({ pre6, director: 'resident' });
    expect(tableRowsContaining(buffer, 'Test Holdings Private Limited')).toBe(1);
    expect(tableRowsContaining(buffer, 'Test Ventures LLP')).toBe(1);
    const text = documentText(buffer);
    expect(text).not.toContain('{');
    expect(text).toContain('Till date');
  });

  it('no interests → a single NA row, as before', () => {
    const pre6 = pre6For(director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta'));
    const buffer = renderDir8DocxBuffer({ pre6, director: 'resident' });
    const xml = new PizZip(buffer).file('word/document.xml')!.asText();
    const naRows = (xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).filter(
      (row) => (row.replace(/<[^>]+>/g, '').match(/NA/g) ?? []).length === 4,
    );
    expect(naRows).toHaveLength(1);
    expect(documentText(buffer)).toContain('son of Test Father');
  });

  it('a female director reads "daughter of"', () => {
    const pre6 = pre6For(director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta', { gender: 'female' }));
    expect(documentText(renderDir8DocxBuffer({ pre6, director: 'resident' }))).toContain(
      'daughter of Test Father',
    );
    expect(documentText(renderPanUndertakingDocxBuffer({ pre6, director: 'non-resident' }))).toContain(
      'Son of Test Father',
    );
  });
});

describe('signing date and place', () => {
  it('blank pre-7 → today, India / Foreign', () => {
    const pre6 = pre6For(director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta'));
    const resident = buildInc9MergeFields({ pre6, director: 'resident' });
    expect(resident.DOCUMENT_DATE).toBe(formatDocumentDate(new Date()));
    expect(resident.DOCUMENT_PLACE).toBe('India');
    expect(buildInc9MergeFields({ pre6, director: 'non-resident' }).DOCUMENT_PLACE).toBe('Foreign');
  });

  it('the lead’s date and place apply; non-resident keeps Foreign', () => {
    const pre7 = { incorpDocsSigningDate: '2026-09-01', incorpDocsSigningPlace: 'Hyderabad' };
    expect(formatDocumentDate(signingDate({ pre7 }))).toBe('1st September 2026');
    expect(signingPlace({ pre7 }, 'resident-2')).toBe('Hyderabad');
    expect(signingPlace({ pre7 }, 'non-resident')).toBe('Foreign');
    const pre6 = pre6For(director('e1', 'yes', 'Alpha'), director('e2', 'yes', 'Beta'));
    const dir2 = buildDir2MergeFields({ pre6, pre7, director: 'resident-2' });
    expect(dir2.DOCUMENT_DATE).toBe('1st September 2026');
    expect(dir2.DOCUMENT_PLACE).toBe('Hyderabad');
  });
});

describe('CIN / LLPIN format', () => {
  it('accepts a CIN or LLPIN, rejects the rest', () => {
    expect(isValidCinOrLlpin('U12345KA2020PTC123456')).toBe(true);
    expect(isValidCinOrLlpin('aab-1234')).toBe(true);
    expect(isValidCinOrLlpin('12345')).toBe(false);
  });

  it('pre-15 flags a malformed interest CIN', () => {
    const responses = pre15Responses([
      director('e1', 'yes', 'Alpha', { ...INTERESTS, otherInterest1Cin: 'BAD' }),
      director('e2', 'yes', 'Beta'),
    ]);
    const errors = validatePre15Responses(responses).errors;
    expect(Object.entries(errors).some(([k, v]) => k.includes('otherInterest1Cin') && v.includes('CIN'))).toBe(
      true,
    );
  });
});
