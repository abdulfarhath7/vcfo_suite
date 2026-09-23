import type { EngagementChecklistState } from '@/lib/engagements-db';
import { COMPANY_PRE1, director, fullState, type FixtureDirector } from '@/lib/doc-pack/__tests__/fixtures';

/** Obviously fake data only — the repo is public. Builds on the doc-pack fixtures. */

export const ASSIST_PRE1: Record<string, string> = {
  ...COMPANY_PRE1,
  proposedName1: 'Test Company India Private Limited',
  proposedName2: 'Test Labs India Private Limited',
  nicCode: '62011',
  nicBusinessType: 'Writing, modifying, testing of computer program',
  companyMailId: 'office@example.test',
  companyMobileCountryCode: '+91',
  companyMobileNumber: '9999999999',
};

const PERSON = {
  gender: 'female',
  occupationType: 'business',
  highestEducationalQualification: 'bachelors-degree',
};

export const NR = director('e1', 'no', 'Alpha', PERSON);
export const RESIDENT = director('e2', 'yes', 'Beta', { ...PERSON, gender: 'male', din: '01234567' });

/** Every Suite field the profile reads is filled. */
export function assistFullState(
  directors: FixtureDirector[] = [NR, RESIDENT],
  pre1: Record<string, string> = ASSIST_PRE1,
): EngagementChecklistState {
  const base = fullState(directors);
  return {
    ...base,
    'pre-1': { status: 'completed', responses: pre1 },
    // Part A stage: no approved name yet, so both proposed names are filed.
    'pre-5': { status: 'not-started', responses: {} },
  };
}
