import type { BoardResolutionDoc } from '@/lib/board-resolution';
import type { EngagementChecklistState } from '@/lib/engagements-db';
import { repeatFieldId } from '@/lib/checklist-repeat';

/** Obviously fake directors only — the repo is public. */
export interface FixtureDirector {
  id: string;
  /** Empty = residency not set yet. */
  resident: 'yes' | 'no' | '';
  values?: Record<string, string>;
}

const COMMON = {
  fatherName: 'Test Father',
  dob: '1980-01-01',
  utilityBillAddress: '1 Test Street, Test City',
  personalMailId: 'director@example.test',
  mobileNumber: '+91 9999999999',
  utilityBillType: 'electricity',
};

export function director(
  id: string,
  resident: 'yes' | 'no' | '',
  first: string,
  overrides: Record<string, string> = {},
): FixtureDirector {
  const identity =
    resident === 'yes'
      ? { panNumber: 'ABCDE1234F', aadhaarNumber: '999999999999' }
      : {
          passportNumber: 'X1234567',
          nationality: 'Singapore',
          signingPlace: 'Test City, Singapore',
          residenceProofType: 'bank-statement',
        };
  return {
    id,
    resident,
    values: { firstName: first, lastName: 'Director', ...COMMON, ...identity, ...overrides },
  };
}

export function pre15Responses(directors: FixtureDirector[]): Record<string, string> {
  const out: Record<string, string> = { directors: directors.map((d) => d.id).join(',') };
  for (const d of directors) {
    out[repeatFieldId('directors', d.id, 'indiaResident')] = d.resident;
    for (const [k, v] of Object.entries(d.values ?? {})) {
      out[repeatFieldId('directors', d.id, k)] = v;
    }
  }
  return out;
}

export const COMPANY_PRE1: Record<string, string> = {
  proposedName1: 'Test Company Private Limited',
  authorisedShareCapital: '1000000',
  paidUpShareCapital: '100000',
  nominalValuePerEquityShare: '10',
  parentEntityName: 'Test Parent Inc',
  parentEntityAddress: '100 Parent Road, Salt Lake City, Utah, USA',
  parentEntityCountry: 'United States of America',
  parentEntityState: 'Utah',
  parentEntityRegistrationNumber: 'P-0000001',
  signatoryFirstName: 'Test',
  signatoryLastName: 'Signatory',
  signatoryDesignation: 'Director',
};

/** The lead's subscription-sheet witness (Pre-7). */
export const WITNESS_PRE7: Record<string, string> = {
  subscriptionWitnessName: 'Test Witness',
  subscriptionWitnessAddress: '3 Witness Road, Test City',
  subscriptionWitnessOccupation: 'Practising Chartered Accountant',
};

export function fullState(
  directors: FixtureDirector[],
  options: { accepted?: boolean; pre7?: Record<string, string> } = {},
): EngagementChecklistState {
  const { accepted = true, pre7 = {} } = options;
  return {
    'pre-1': { status: 'completed', responses: COMPANY_PRE1 },
    'pre-5': { status: 'completed', responses: { approvedCompanyName: 'Test Company Private Limited' } },
    'pre-14': {
      status: 'completed',
      responses: {
        registeredOfficeCompleteAddress: '2 Office Lane, Test City, 560001',
        registeredOfficeState: 'Karnataka',
      },
    },
    'pre-15': {
      status: 'completed',
      responses: pre15Responses(directors),
      ...(accepted ? { reviewStatus: 'accepted' } : {}),
    },
    'pre-7': { status: 'in-progress', responses: { ...WITNESS_PRE7, ...pre7 } },
  };
}

export const FINALIZED_BR: BoardResolutionDoc = {
  content: 'RESOLVED THAT …',
  status: 'finalized',
  storagePath: '00000000-0000-4000-8000-000000000000/board-resolution.docx',
  finalizedAt: '2026-09-01T10:00:00.000Z',
};

export const DRAFT_BR: BoardResolutionDoc = {
  content: 'RESOLVED THAT …',
  status: 'draft',
  storagePath: '00000000-0000-4000-8000-000000000000/board-resolution.docx',
};
