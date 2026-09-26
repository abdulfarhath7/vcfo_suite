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
import { buildPanUndertakingMergeFields } from '@/lib/incorporation-docs/pan-undertaking';
import { buildDeclarationMergeFields } from '@/lib/incorporation-docs/declarations';
import { buildAoaMergeFields } from '@/lib/incorporation-docs/aoa';
import { buildMoaMergeFields, collectMoaMissingFields } from '@/lib/incorporation-docs/moa';
import {
  buildSubscriptionSheetMergeFields,
  collectSubscriptionSheetMissingFields,
  planSubscription,
} from '@/lib/incorporation-docs/subscription-sheet';
import { renderIncorpDocxBuffer } from '@/lib/incorporation-docs/docx';
import { validateIncorpDocsGeneration } from '@/lib/api/incorporation-docs-errors';
import { repeatFieldId } from '@/lib/checklist-repeat';
import type { EngagementChecklistState } from '@/lib/engagements-db';
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

/** A non-resident who has not answered the questions that replaced the old defaults. */
const UNANSWERED_NR = { nationality: '', signingPlace: '', residenceProofType: '' };

function pre6For(...dirs: ReturnType<typeof director>[]) {
  return directorResponsesFromState(fullState(dirs)).pre6;
}

function documentText(buffer: Buffer): string {
  const xml = new PizZip(buffer).file('word/document.xml')!.asText();
  return xml.replace(/<[^>]+>/g, '');
}

function tableRows(buffer: Buffer): string[] {
  const xml: string = new PizZip(buffer).file('word/document.xml')!.asText();
  return xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? [];
}

function tableRowsContaining(buffer: Buffer, text: string): number {
  return tableRows(buffer).filter((row) => row.replace(/<[^>]+>/g, '').includes(text)).length;
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
    const naRows = tableRows(buffer).filter(
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
    const pre6 = pre6For(director('e1', 'no', 'Alpha', UNANSWERED_NR), director('e2', 'yes', 'Beta'));
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

describe('non-resident answers replace the old defaults', () => {
  const pre6 = pre6For(
    director('e1', 'no', 'Alpha', {
      nationality: 'Singapore',
      signingPlace: 'Singapore, Singapore',
      residenceProofType: 'bank-statement',
      identityProofType: 'passport',
    }),
    director('e2', 'yes', 'Beta'),
  );

  it('DIR-2 prints the nationality, place, and confirmed proofs', () => {
    const fields = buildDir2MergeFields({ pre6, director: 'non-resident' });
    expect(fields.DIRECTOR_NATIONALITY).toBe('Singapore');
    expect(fields.DOCUMENT_PLACE).toBe('Singapore, Singapore');
    expect(fields.RESIDENCE_PROOF).toBe('Copy of Bank Statement');
    expect(fields.IDENTITY_PROOF).toBe('Copy of Passport');
  });

  it('every other director draft takes the same place of signing', () => {
    expect(buildDir8MergeFields({ pre6, director: 'non-resident' }).DOCUMENT_PLACE).toBe('Singapore, Singapore');
    expect(buildInc9MergeFields({ pre6, director: 'non-resident' }).DOCUMENT_PLACE).toBe('Singapore, Singapore');
    expect(buildDeclarationMergeFields({ pre6, director: 'non-resident' }).DOCUMENT_PLACE).toBe(
      'Singapore, Singapore',
    );
    const pan = buildPanUndertakingMergeFields({ pre6, director: 'non-resident' });
    expect(pan.DOCUMENT_PLACE).toBe('Singapore, Singapore');
    expect(pan.DIRECTOR_NATIONALITY).toBe('Singapore');
  });

  it('"other" proof of residence prints the named document', () => {
    const other = pre6For(
      director('e1', 'no', 'Alpha', { residenceProofType: 'other', residenceProofOther: 'Tenancy Agreement' }),
      director('e2', 'yes', 'Beta'),
    );
    expect(buildDir2MergeFields({ pre6: other, director: 'non-resident' }).RESIDENCE_PROOF).toBe(
      'Copy of Tenancy Agreement',
    );
  });

  it('a resident with no nationality answer is Indian; an answered one prints as given', () => {
    const resident = pre6For(director('e1', 'yes', 'Alpha'), director('e2', 'yes', 'Beta', { nationality: 'Nepal' }));
    expect(buildDir2MergeFields({ pre6: resident, director: 'resident' }).DIRECTOR_NATIONALITY).toBe('India');
    expect(buildDir2MergeFields({ pre6: resident, director: 'resident-2' }).DIRECTOR_NATIONALITY).toBe('Nepal');
  });

  it('unanswered → exactly the historical output', () => {
    const legacy = pre6For(director('e1', 'no', 'Alpha', UNANSWERED_NR), director('e2', 'yes', 'Beta'));
    const fields = buildDir2MergeFields({ pre6: legacy, director: 'non-resident' });
    expect(fields.DIRECTOR_NATIONALITY).toBe('Foreign');
    expect(fields.DOCUMENT_PLACE).toBe('Foreign');
    expect(fields.RESIDENCE_PROOF).toBe('Copy of Driving License');
    expect(fields.IDENTITY_PROOF).toBe('Copy of Passport');
    expect(buildDir2MergeFields({ pre6: legacy, director: 'resident' }).IDENTITY_PROOF).toBe('Copy of Aadhaar Card');
    // The PAN undertaking still reads the country off the address when nothing was answered.
    expect(buildPanUndertakingMergeFields({ pre6: legacy, director: 'non-resident' }).DIRECTOR_NATIONALITY).toBe(
      'Test City',
    );
  });
});

describe('generation blocks on unanswered non-resident questions (pre-15 engagements only)', () => {
  it('names the missing answers', () => {
    const state = fullState([director('e1', 'no', 'Alpha', UNANSWERED_NR), director('e2', 'yes', 'Beta')]);
    expect(() =>
      validateIncorpDocsGeneration({
        engagement: { companyName: 'Test Company Private Limited' },
        checklistState: state,
        docs: ['dir-2'],
        directors: ['non-resident'],
      }),
    ).toThrow(/place of signing \(Pre-15\).*nationality \(Pre-15\).*proof of residence \(Pre-15\)/);
  });

  it('a legacy pre-6 engagement keeps generating with the old defaults', () => {
    const state: EngagementChecklistState = {
      ...fullState([]),
      'pre-15': { status: 'not-started', responses: {} },
      'pre-1': {
        status: 'completed',
        responses: {
          ...fullState([])['pre-1']!.responses,
          directorCount: '2',
          director1FirstName: 'Test',
          director1LastName: 'One',
          director1IndiaResident: 'no',
          director2FirstName: 'Test',
          director2LastName: 'Two',
          director2IndiaResident: 'yes',
        },
      },
      'pre-6': {
        status: 'completed',
        reviewStatus: 'accepted',
        responses: {
          nrDirectorFatherName: 'Test Father',
          nrDirectorDob: '1980-01-01',
          nrDirectorUtilityBillAddress: '1 Test Street, Test City, USA',
          nrDirectorPersonalMailId: 'nr@example.test',
          nrDirectorMobileNumber: '+1 5550100',
        },
      },
    };
    const { pre6 } = validateIncorpDocsGeneration({
      engagement: { companyName: 'Test Company Private Limited' },
      checklistState: state,
      docs: ['dir-2'],
      directors: ['non-resident'],
    });
    expect(buildDir2MergeFields({ pre6, director: 'non-resident' }).DIRECTOR_NATIONALITY).toBe('Foreign');
  });
});

describe('AOA directors list', () => {
  it('each director once, with their own salutation', () => {
    const { pre1, pre6 } = directorResponsesFromState(
      fullState([
        director('e1', 'yes', 'Beta', { gender: 'female' }),
        director('e2', 'no', 'Alpha', { gender: 'male' }),
      ]),
    );
    const list = buildAoaMergeFields({ pre1, pre6, director: 'company' }).AOA_DIRECTORS_LIST;
    expect(list).toBe('1. Mr. Alpha Director 2. Ms. Beta Director');
  });
});

describe('MOA clause II and V', () => {
  it('state from pre-14, shares from pre-13', () => {
    const state = fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta')]);
    state['pre-14'] = {
      status: 'completed',
      responses: { registeredOfficeCompleteAddress: '2 Office Lane, Test City, 560001', registeredOfficeState: 'Karnataka' },
    };
    const { pre1, pre6 } = directorResponsesFromState(state);
    const pre13 = { equityShares: 'yes', equityQuantity: '20000', equityNominalValue: '5' };
    const fields = buildMoaMergeFields({ pre1, pre6, pre13, director: 'company' });
    expect(fields.MOA_REGISTERED_OFFICE_STATE).toBe('Karnataka');
    expect(fields.PAID_UP_EQUITY_SHARES).toBe('20,000');
    expect(fields.NOMINAL_VALUE_PER_EQUITY_SHARE).toBe('5');
    expect(fields.MOA_CLAUSE_5).toContain('20,000 equity shares of INR 5 each');
  });

  it('no pre-13 / no state answer → Part A shares and the address guess, and generation asks for the state', () => {
    const pre6 = { registeredOfficeCompleteAddress: '2 Office Lane, Bengaluru, Karnataka, India' };
    const pre1 = { authorisedShareCapital: '1000000', paidUpShareCapital: '100000', nominalValuePerEquityShare: '10' };
    const fields = buildMoaMergeFields({ pre1, pre6, director: 'company' });
    expect(fields.MOA_REGISTERED_OFFICE_STATE).toBe('Karnataka');
    expect(fields.PAID_UP_EQUITY_SHARES).toBe('10,000');
    expect(collectMoaMissingFields({ pre1, pre6, director: 'company' })).toContain(
      'State / union territory of the registered office (Pre-14)',
    );
  });
});

function pre16Responses(entries: Array<{ id: string; values: Record<string, string> }>, extra: Record<string, string> = {}) {
  const out: Record<string, string> = { subscribers: entries.map((e) => e.id).join(','), ...extra };
  for (const e of entries) {
    for (const [k, v] of Object.entries(e.values)) out[repeatFieldId('subscribers', e.id, k)] = v;
  }
  return out;
}

const WITNESS = {
  subscriptionWitnessName: 'Test Witness',
  subscriptionWitnessAddress: '3 Witness Road, Test City',
  subscriptionWitnessOccupation: 'Practising Chartered Accountant',
  subscriptionWitnessMembershipNumber: '123456',
};

describe('subscription sheets', () => {
  const directors = [director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta')];

  it('subsidiary, no pre-16: parent subscribes on the foreign sheet (share words, BR date, witness)', () => {
    const state = fullState(directors);
    const { pre1, pre6 } = directorResponsesFromState(state);
    const input = {
      pre1: { ...pre1, boardResolutionDate: '2026-08-01' },
      pre6,
      pre7: WITNESS,
      pre13: { equityShares: 'yes', equityQuantity: '10000', equityNominalValue: '10' },
      director: 'company' as const,
    };
    expect(planSubscription(input).variant).toBe('foreign');
    const fields = buildSubscriptionSheetMergeFields(input);
    expect(fields.PARENT_ENTITY_NAME).toBe('Test Parent Inc');
    expect(fields.EQUITY_SHARES_SUBSCRIBED).toBe('10,000 (Ten Thousand)');
    expect(fields.TOTAL_SHARES_TAKEN).toBe('10,000 (Ten Thousand)');
    expect(fields.SUBSCRIPTION_DATE).toBe('01.08.2026');
    expect(fields.SUBSCRIBER_NATIONALITY).toBe('Singapore');
    expect(fields.WITNESS_NAME).toBe('Test Witness');
    expect(fields.WITNESS_MEMBERSHIP).toBe('Membership No. 123456');

    const text = documentText(renderIncorpDocxBuffer('moa-subscription-sheet', input));
    expect(text).not.toContain('{');
    // Page 2 reads its labels correctly now (tags used to sit one label late).
    const flat = text.replace(/\u00a0/g, ' ');
    expect(flat.match(/company name: Test Parent Inc/g)).toHaveLength(2);
    expect(flat.match(/Name: Alpha Director/g)).toHaveLength(2);
    expect(flat.match(/Nationality: Singapore/g)).toHaveLength(2);
    expect(text).toContain('Test Witness');
  });

  it('a body corporate on pre-16 subscribes with its own name, address and shares', () => {
    const pre16 = pre16Responses([
      {
        id: 's1',
        values: {
          type: 'non-individual',
          entityType: 'body-corporate',
          name: 'Holding Test Ltd',
          address: '9 Holding Street, London, United Kingdom',
          authorisedPerson: 'Alpha Director',
          shares: '9999',
        },
      },
      { id: 's2', values: { type: 'individual', name: 'Beta Director', shares: '1' } },
    ]);
    const { pre1, pre6 } = directorResponsesFromState(fullState(directors));
    const fields = buildSubscriptionSheetMergeFields({ pre1, pre6, pre16, pre7: WITNESS, director: 'company' });
    expect(fields.PARENT_ENTITY_NAME).toBe('Holding Test Ltd');
    expect(fields.PARENT_ENTITY_ADDRESS).toBe('9 Holding Street, London, United Kingdom');
    expect(fields.EQUITY_SHARES_SUBSCRIBED).toBe('9,999 (Nine Thousand Nine Hundred Ninety Nine)');
    expect(fields.SUBSCRIBER_FULL_NAME).toBe('Alpha Director');
  });

  it('independent company: individuals on pre-16 get the resident sheet, one row each', () => {
    const pre16 = pre16Responses([
      { id: 's1', values: { type: 'individual', name: 'Alpha Director', shares: '6000' } },
      { id: 's2', values: { type: 'individual', name: 'Beta Director', shares: '4000' } },
    ]);
    const { pre1, pre6 } = directorResponsesFromState(fullState(directors));
    const input = {
      engagement: { companyName: 'Test', parentEntityName: null, parentEntityAddress: null, parentEntityRegistrationNumber: null, ownershipType: 'independent' as const },
      pre1,
      pre6,
      pre16,
      pre7: WITNESS,
      director: 'company' as const,
    };
    expect(planSubscription(input).variant).toBe('resident');
    const fields = buildSubscriptionSheetMergeFields(input);
    expect(fields.SUBSCRIBERS.map((r) => r.SUBSCRIBER_FULL_NAME)).toEqual(['Alpha Director', 'Beta Director']);
    expect(fields.SUBSCRIBERS[1]!.SUBSCRIBER_NATIONALITY).toBe('India');
    expect(fields.TOTAL_SHARES_TAKEN).toBe('10,000 (Ten Thousand)');
    expect(collectSubscriptionSheetMissingFields(input)).toEqual([]);

    const buffer = renderIncorpDocxBuffer('moa-subscription-sheet', input);
    const text = documentText(buffer);
    expect(text).not.toContain('{');
    expect(text).not.toMatch(/Naga|Ravanam|Aloha|SANNAREDDY/);
    // Two subscriber rows on each page.
    expect(tableRowsContaining(buffer, 'Alpha Director')).toBe(2);
    expect(tableRowsContaining(buffer, 'Beta Director')).toBe(2);
    expect(text).toContain('6,000 (Six Thousand)');
    expect(text).not.toContain('Nominee Shareholder');
  });

  it('independent with no subscribers listed, or a non-director subscriber, is blocked', () => {
    const { pre1, pre6 } = directorResponsesFromState(fullState(directors));
    const engagement = { companyName: 'Test', parentEntityName: null, parentEntityAddress: null, parentEntityRegistrationNumber: null, ownershipType: 'independent' as const };
    expect(collectSubscriptionSheetMissingFields({ engagement, pre1, pre6, pre7: WITNESS, director: 'company' })).toEqual([
      'Subscribers to the memorandum and the shares each takes (Pre-16)',
    ]);
    const pre16 = pre16Responses([{ id: 's1', values: { type: 'individual', name: 'Someone Else', shares: '10' } }]);
    expect(
      collectSubscriptionSheetMissingFields({ engagement, pre1, pre6, pre16, pre7: WITNESS, director: 'company' }),
    ).toEqual(['Subscriber 1 (Someone Else) — must be a proposed director so their KYC can fill the sheet (Pre-16)']);
  });

  it('the witness is required', () => {
    const { pre1, pre6 } = directorResponsesFromState(fullState(directors));
    expect(collectSubscriptionSheetMissingFields({ pre1, pre6, director: 'company' })).toEqual([
      'Witness to the subscribers — name (Pre-7)',
      'Witness to the subscribers — address (Pre-7)',
      'Witness to the subscribers — occupation (Pre-7)',
    ]);
  });
});
