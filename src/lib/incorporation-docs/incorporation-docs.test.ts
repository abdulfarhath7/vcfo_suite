import PizZip from 'pizzip';
import { describe, expect, it, vi } from 'vitest';

import {
  buildAuthorisationLetterMergeFields,
  collectAuthorisationLetterMissingFields,
} from '@/lib/incorporation-docs/authorisation-letter';
import {
  buildAcceptanceLetterMergeFields,
  collectAcceptanceLetterMissingFields,
} from '@/lib/incorporation-docs/acceptance-letter';
import { renderIncorpDocxBuffer } from '@/lib/incorporation-docs/docx';
import { incorpDocAppliesToEngagement } from '@/lib/incorporation-docs/types';
import { collectIncorpDocsMissingFields } from '@/lib/api/incorporation-docs-errors';

vi.mock('server-only', () => ({}));

import { buildDir8MergeFields } from '@/lib/incorporation-docs/dir8';
import { buildInc9MergeFields } from '@/lib/incorporation-docs/inc9';
import { buildPanUndertakingMergeFields } from '@/lib/incorporation-docs/pan-undertaking';
import { nationalityFromAddress } from '@/lib/incorporation-docs/shared';

const pre6Base = {
  nrDirectorFirstName: 'Justin',
  nrDirectorMiddleName: 'Cheng',
  nrDirectorLastName: 'Hsu',
  nrDirectorDob: '1980-02-25',
  nrDirectorFatherName: 'Robert Hsu',
  nrDirectorPassportNumber: 'P2982018',
  nrDirectorUtilityBillAddress: '2544 Horsetail Road, Frisco, Texas 75033, USA',
  nrDirectorPersonalMailId: 'justin@example.com',
  nrDirectorMobileNumber: '+1 555 0100',
  residentDirectorFirstName: 'Priya',
  residentDirectorLastName: 'Sharma',
  residentDirectorDob: '1990-06-15',
  residentDirectorFatherName: 'Raj Sharma',
  residentDirectorUtilityBillAddress: '12 MG Road, Bengaluru, Karnataka 560001, India',
  residentDirectorPersonalMailId: 'priya@example.com',
  residentDirectorMobileNumber: '+91 9876543210',
  residentDirectorPanNumber: 'ABCDE1234F',
};

describe('buildDir8MergeFields', () => {
  it('maps director details and prior directorship NA defaults', () => {
    const fields = buildDir8MergeFields({
      pre5: { approvedCompanyName: 'ABC India Private Limited' },
      pre6: pre6Base,
      director: 'non-resident',
    });

    expect(fields.PROPOSED_COMPANY_NAME).toBe('ABC India Private Limited');
    expect(fields.DIRECTOR_FULL_NAME).toBe('Justin Cheng Hsu');
    expect(fields.FATHERS_NAME).toBe('Robert Hsu');
    expect(fields.PRIOR_DIR_COMPANY).toBe('NA');
    expect(fields.DOCUMENT_PLACE).toBe('Foreign');
    expect(fields.DOCUMENT_DATE_DAY1).toBeTruthy();
  });
});

describe('buildInc9MergeFields', () => {
  it('maps company and director for declaration', () => {
    const fields = buildInc9MergeFields({
      pre1: { proposedName1: 'ABC India Private Limited' },
      pre6: pre6Base,
      director: 'resident',
    });

    expect(fields.PROPOSED_COMPANY_NAME).toBe('ABC India Private Limited');
    expect(fields.DIRECTOR_FULL_NAME).toBe('Priya Sharma');
    expect(fields.DOCUMENT_PLACE).toBe('India');
  });
});

describe('buildPanUndertakingMergeFields', () => {
  it('maps non-resident passport and nationality from address', () => {
    const fields = buildPanUndertakingMergeFields({
      pre6: pre6Base,
      director: 'non-resident',
    });

    expect(fields.DIRECTOR_FULL_NAME).toBe('Justin Cheng Hsu');
    expect(fields.FATHERS_NAME).toBe('Robert Hsu');
    expect(fields.PASSPORT_NUMBER).toBe('P2982018');
    expect(fields.DIRECTOR_NATIONALITY).toBe('United States of America');
  });
});

describe('nationalityFromAddress', () => {
  it('expands USA suffix', () => {
    expect(nationalityFromAddress('Frisco, Texas, USA')).toBe('United States of America');
  });
});

describe('parent country and state on the letters', () => {
  const pre1Uk = {
    parentEntityName: 'Test Parent Ltd',
    parentEntityAddress: '1 Parent Street, London',
    parentEntityCountry: 'United Kingdom',
  };

  it('a UK parent (no state) reads "the laws of the United Kingdom"', () => {
    const fields = buildAuthorisationLetterMergeFields({ pre1: pre1Uk, pre6: pre6Base, director: 'company' });
    expect(fields.PARENT_ENTITY_STATE).toBe('');
    expect(fields.PARENT_ENTITY_JURISDICTION).toBe('the United Kingdom');
    expect(fields.CERTIFICATION_PLACE).toBe('United Kingdom');
    expect(buildAcceptanceLetterMergeFields({ pre1: pre1Uk, pre6: pre6Base, director: 'company' }).CERTIFICATION_PLACE).toBe(
      'United Kingdom',
    );

    const xml = new PizZip(
      renderIncorpDocxBuffer('authorisation-letter', { pre1: pre1Uk, pre6: pre6Base, director: 'company' }),
    )
      .file('word/document.xml')!
      .asText();
    const text = xml.replace(/<[^>]+>/g, '');
    expect(text).toContain('under the laws of the United Kingdom, having its registered office');
    expect(text).not.toContain('Utah');
    expect(text).not.toContain('{');
  });

  it('an answered state reads "the State of Delaware, United States of America"', () => {
    const pre1 = { ...pre1Uk, parentEntityCountry: 'United States of America', parentEntityState: 'Delaware' };
    const xml = new PizZip(renderIncorpDocxBuffer('authorisation-letter', { pre1, pre6: pre6Base, director: 'company' }))
      .file('word/document.xml')!
      .asText();
    expect(xml.replace(/<[^>]+>/g, '')).toContain(
      'under the laws of the State of Delaware, United States of America, having',
    );
  });

  it('legacy (no country answer): address-derived Utah / USA, and generation asks for the country', () => {
    const pre1 = { parentEntityName: 'Test Parent Inc', parentEntityAddress: '1 Road, Salt Lake City, Utah, USA' };
    const fields = buildAuthorisationLetterMergeFields({ pre1, pre6: pre6Base, director: 'company' });
    expect(fields.PARENT_ENTITY_STATE).toBe('Utah');
    expect(fields.PARENT_ENTITY_COUNTRY).toBe('USA');
    const text = new PizZip(renderIncorpDocxBuffer('authorisation-letter', { pre1, pre6: pre6Base, director: 'company' }))
      .file('word/document.xml')!
      .asText()
      .replace(/<[^>]+>/g, '');
    expect(text).toContain('under the laws of the Utah, USA, having');
    expect(collectAuthorisationLetterMissingFields({ pre1, pre6: pre6Base, director: 'company' })).toContain(
      'Parent entity country of incorporation (Pre-1)',
    );
    expect(collectAcceptanceLetterMissingFields({ pre1, pre6: pre6Base, director: 'company' })).toContain(
      'Parent entity country of incorporation (Pre-1)',
    );
  });
});

describe('independent companies', () => {
  const independent = { companyName: 'Test', ownershipType: 'independent' as const };

  it('never get the parent letters', () => {
    expect(incorpDocAppliesToEngagement('authorisation-letter', independent)).toBe(false);
    expect(incorpDocAppliesToEngagement('acceptance-letter', independent)).toBe(false);
    expect(incorpDocAppliesToEngagement('moa', independent)).toBe(true);
    expect(incorpDocAppliesToEngagement('authorisation-letter', { ownershipType: 'subsidiary' })).toBe(true);
  });

  it('are not asked for parent fields by the generate check', () => {
    const missing = collectIncorpDocsMissingFields({
      engagement: independent,
      pre1: { proposedName1: 'Test India Private Limited' },
      pre6: pre6Base,
      docs: ['authorisation-letter', 'acceptance-letter'],
    });
    expect(missing).toEqual([]);
  });
});
