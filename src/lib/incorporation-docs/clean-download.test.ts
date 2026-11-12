import PizZip from 'pizzip';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildAuthorisationLetterMergeFields } from '@/lib/incorporation-docs/authorisation-letter';
import { renderIncorpDocxBuffer } from '@/lib/incorporation-docs/docx';
import {
  docxForResponse,
  leftAlignTableValueCells,
  stripDocxHighlights,
} from '@/lib/incorporation-docs/docx-sanitize';
import { signingPlace } from '@/lib/incorporation-docs/shared';
import { planSubscription } from '@/lib/incorporation-docs/subscription-sheet';
import { audiencesForDoc } from '@/lib/incorporation-docs/types';
import { countryFromAddress } from '@/lib/incorporation/countries';

const documentXml = (docx: Buffer) => new PizZip(docx).file('word/document.xml')!.asText();

const pre6 = {
  nrDirectorFirstName: 'Gabriel',
  nrDirectorMiddleName: 'Benjamin',
  nrDirectorLastName: 'Weiss',
  nrDirectorFatherName: 'David Weiss',
  nrDirectorDob: '1980-02-25',
  nrDirectorPassportNumber: 'A1234567',
  nrDirectorUtilityBillAddress: '23 Maggie Way, Yarmouth, ME 04096',
  nrDirectorSigningPlace: '23 Maggie Way, Yarmouth, ME 04096',
  nrDirectorDin: '01234567',
  nrDirectorPersonalMailId: 'gabe@example.com',
  nrDirectorMobileNumber: '+1 555 0100',
  nrDirector2FirstName: 'Owen',
  nrDirector2MiddleName: 'Roger',
  nrDirector2LastName: 'Newman',
  nrDirector2PassportNumber: 'B7654321',
  nrDirector2UtilityBillAddress: '4 Elm Street, Portland, OR 97201',
  residentDirectorFirstName: 'Rakesh',
  residentDirectorLastName: 'Bhatia',
  residentDirectorUtilityBillAddress: '12 MG Road, Bengaluru 560001',
};

const pre1 = {
  parentEntityName: 'Emburse, Inc',
  parentEntityAddress: '1 Market Street, Portland, Maine, USA',
  parentEntityCountry: 'United States of America',
  parentEntityState: 'Delaware',
  signatoryFirstName: 'Jane',
  signatoryLastName: 'Doe',
  signatoryDesignation: 'Director',
  boardResolutionDate: '2026-07-01',
};

describe('downloads are clean copies', () => {
  it('the rendered draft keeps the yellow marking; the download strips it', () => {
    const rendered = renderIncorpDocxBuffer('dir-2', { pre6, director: 'non-resident' });
    expect(documentXml(rendered)).toContain('<w:highlight');
    const clean = documentXml(stripDocxHighlights(rendered));
    expect(clean).not.toContain('<w:highlight');
    expect(clean).toContain('Gabriel Benjamin Weiss');
    expect(docxForResponse(rendered, true)).toBe(rendered);
  });

  it('merged values in table cells are left-aligned; label cells keep theirs', () => {
    const cell = (jc: string, text: string) => `<w:tc><w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
    const xml = `<w:tbl><w:tr>${cell('center', 'SL. NO.')}${cell('center', '{DIRECTOR_DIN}')}</w:tr></w:tbl>`;
    const out = leftAlignTableValueCells(xml);
    expect(out).toContain(cell('center', 'SL. NO.'));
    expect(out).toContain(cell('left', '{DIRECTOR_DIN}'));

    const dir2 = documentXml(renderIncorpDocxBuffer('dir-2', { pre6, director: 'non-resident' }));
    const dinCell = dir2.match(/<w:tc\b[^>]*>(?:(?!<\/w:tc>)[\s\S])*01234567[\s\S]*?<\/w:tc>/)?.[0] ?? '';
    expect(dinCell).toContain('<w:jc w:val="left"/>');
    expect(dinCell).not.toContain('<w:jc w:val="center"/>');
  });
});

describe('place of signing outside India is the country', () => {
  it('reads the country from an address or a "City, Country" answer', () => {
    expect(countryFromAddress('23 Maggie Way, Yarmouth, ME 04096')).toBe('United States of America');
    expect(countryFromAddress('Austin, USA')).toBe('United States of America');
    expect(countryFromAddress('Singapore, Singapore')).toBe('Singapore');
    expect(countryFromAddress('10 Downing Street, London SW1A 2AA')).toBe('United Kingdom');
    expect(countryFromAddress('100 King St W, Toronto, ON M5X 1A9')).toBe('Canada');
    expect(countryFromAddress('Austin')).toBe('');
  });

  it('never prints the street address; falls back to the address, then nationality', () => {
    expect(signingPlace({ pre6 }, 'non-resident')).toBe('United States of America');
    expect(signingPlace({ pre6: { nrDirectorSigningPlace: 'Austin', nrDirectorNationality: 'Ireland' } }, 'non-resident')).toBe(
      'Ireland',
    );
    expect(signingPlace({ pre7: { incorpDocsSigningPlace: 'Hyderabad' } }, 'resident')).toBe('Hyderabad');
  });
});

describe('authorisation letter', () => {
  it('goes to every director outside India and to no resident director', () => {
    expect(audiencesForDoc('authorisation-letter', ['non-resident', 'non-resident-2', 'resident'])).toEqual([
      'non-resident',
      'non-resident-2',
    ]);
  });

  it('names its own director, is signed by the board resolution signatory, and cites the resolution date', () => {
    const fields = buildAuthorisationLetterMergeFields({ pre1, pre6, director: 'non-resident-2' });
    expect(fields.NR_DIRECTOR_FULL_NAME).toBe('Owen Roger Newman');
    expect(fields.NR_PASSPORT_OR_REGISTRATION).toBe('B7654321');
    expect(fields.SIGNATORY_NAME).toBe('Jane Doe');
    expect(fields.BOARD_RESOLUTION_DATE).toBe('1st July 2026');

    const text = documentXml(renderIncorpDocxBuffer('authorisation-letter', { pre1, pre6, director: 'non-resident' }))
      .replace(/<[^>]+>/g, '');
    expect(text).toContain('Gabriel Benjamin Weiss');
    expect(text).toContain('Board Resolution dated 1st July 2026');
    expect(text).not.toContain('{');
  });
});

describe('subscription sheet representative', () => {
  it('is the authorised person the client named when the parent subscribes alone', () => {
    const plan = planSubscription({
      pre1,
      pre6,
      pre16: { shareholderAuthorizedPerson: 'Owen Newman' },
      engagement: { companyName: 'Emburse India', parentEntityName: null, parentEntityAddress: null, parentEntityRegistrationNumber: null, ownershipType: 'subsidiary' },
      director: 'company',
    });
    expect(plan.variant).toBe('foreign');
    expect(plan.representative).toBe('non-resident-2');
  });

  it('falls back to the first non-resident director when no one is named', () => {
    const plan = planSubscription({ pre1, pre6, director: 'company' });
    expect(plan.representative).toBe('non-resident');
  });
});
