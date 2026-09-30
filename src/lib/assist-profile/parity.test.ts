import { describe, expect, it } from 'vitest';

import { buildDocPackContext } from '@/lib/doc-pack/evaluate';
import { director } from '@/lib/doc-pack/__tests__/fixtures';
import { buildAssistProfile } from '@/lib/assist-profile/build';
import { assistFullState, withSubscribers } from '@/lib/assist-profile/__tests__/fixtures';

/**
 * Parity: every key the profile emits is a key VCFO Assist actually reads.
 * A typo here is otherwise invisible until a lead watches a field not fill.
 *
 * `MAPPING_JS_PATHS` is copied from `vcfo_assist/extension/lib/mapping.js`
 * (and `docs/specs/assist-profile/02-profile-mapping.md`). `[]` marks an array
 * element. When mapping.js starts reading a new key, add it here first.
 */
const MAPPING_JS_PATHS = new Set([
  'mcaLogin.userId',
  // partA
  'company.type',
  'company.class',
  'company.category',
  'company.subCategory',
  'company.nicCode',
  'company.proposedNames[]',
  // partB section 1
  'company.aoaEntrenched',
  'company.entrenchedArticlesCount',
  'company.hasShareCapital',
  'company.capital.unclassifiedAuthorized',
  'company.capital.equity.classes',
  'company.capital.equity.className',
  'company.capital.equity.authorizedShares',
  'company.capital.equity.subscribedShares',
  'company.capital.equity.faceValue',
  'company.capital.preference.classes',
  'company.capital.preference.className',
  'company.capital.preference.authorizedShares',
  'company.capital.preference.subscribedShares',
  'company.capital.preference.faceValue',
  'company.maxMembers',
  'company.members',
  // partB section 2
  'registeredOffice.line1',
  'registeredOffice.line2',
  'registeredOffice.pincode',
  'registeredOffice.area',
  'registeredOffice.stdCode',
  'registeredOffice.phone',
  'registeredOffice.fax',
  'registeredOffice.countryCode',
  'registeredOffice.mobile',
  'registeredOffice.email',
  'registeredOffice.sameAsCorrespondence',
  'registeredOffice.longitude',
  'registeredOffice.latitude',
  'registeredOffice.rocOffice',
  'registeredOffice.city',
  'registeredOffice.state',
  // person() for directors, and the 7a / 7b director blocks
  ...[
    'firstName',
    'middleName',
    'surName',
    'lastName',
    'father.firstName',
    'father.middleName',
    'father.surName',
    'gender',
    'dob',
    'nationality',
    'placeOfBirth',
    'occupationType',
    'areaOfOccupation',
    'othersOccupation',
    'education',
    'othersEducation',
    'pan',
    'din',
    'designation',
    'category',
    'nomineeOf',
    'citizenOfIndia',
    'residentInIndia',
    'countryCode',
    'mobile',
    'email',
    'presentAddressSame',
    'stayYears',
    'stayMonths',
    'previousAddress',
    'shares.equity.class',
    'shares.equity.number',
    'interests[].cin',
    'interests[].name',
    'interests[].address',
    'interests[].designation',
    'interests[].percent',
    'interests[].amount',
  ].map((k) => `directors[].${k}`),
  // Part B 6a / 6b / 6c subscribers, from `vcfo_assist/fieldmaps/spice-part-b.json`
  // and `inc-34-eaoa.json`. A subscriber-director is also read through Assist's
  // `directors[withDin|withoutDin]` view (subscriber-directors, then directors),
  // so it may carry every director key too.
  ...[
    'firstName',
    'middleName',
    'surName',
    'father.firstName',
    'father.middleName',
    'father.surName',
    'gender',
    'dob',
    'nationality',
    'placeOfBirth',
    'occupationType',
    'areaOfOccupation',
    'othersOccupation',
    'education',
    'othersEducation',
    'pan',
    'din',
    'email',
    'name',
    'cin',
    'category',
    'place',
    'shares.equity.class',
    'shares.equity.number',
    // via the directors view
    'designation',
    'citizenOfIndia',
    'residentInIndia',
    'countryCode',
    'mobile',
    'interests[].cin',
    'interests[].name',
    'interests[].address',
    'interests[].designation',
    'interests[].percent',
    'interests[].amount',
    ...[
      'firstName',
      'middleName',
      'surName',
      'father.firstName',
      'father.middleName',
      'father.surName',
      'gender',
      'dob',
      'nationality',
      'placeOfBirth',
      'occupationType',
      'areaOfOccupation',
      'othersOccupation',
      'education',
      'othersEducation',
      'pan',
      'din',
      'email',
    ].map((k) => `representative.${k}`),
  ].map((k) => `subscribers[].${k}`),
  // INC-33 / INC-34 witness
  'moa.witness.name',
  'moa.witness.address',
  'aoa.witness.name',
  'aoa.witness.addressDescriptionOccupation',
  'aoa.witness.dinPanMembership',
  // INC-33 / AGILE-PRO-S / INC-34 (P2)
  'company.name',
  'company.objects',
  'company.mattersNecessary',
  'agile.numberOfDirectors',
]);

/**
 * Emitted on purpose but not read by mapping.js. Each needs a reason:
 * - `company.nicDescription`, `company.capital.authorized|subscribed`,
 *   `registeredOffice.country`: in Assist's own sample profile, for the
 *   lead's Preview; the portal derives them.
 * - `directors[].id`, `directors[].index`: director identity across reorders
 *   (QUESTIONS Q1).
 * - `subscribers[].kind|isDirector|id|index`: see the entries below.
 */
const INFORMATIONAL_PATHS = new Set([
  'company.nicDescription',
  'company.capital.authorized',
  'company.capital.subscribed',
  'registeredOffice.country',
  'directors[].id',
  'directors[].index',
  // `kind` / `isDirector` split subscribers into Assist's 6a / 6b / 6c and
  // directors views (`src/suite/profile.js`) rather than filling a field;
  // `id` / `index` are identity, as for directors (QUESTIONS Q7).
  'subscribers[].kind',
  'subscribers[].isDirector',
  'subscribers[].id',
  'subscribers[].index',
]);

function leafPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => leafPaths(v, `${prefix}[]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe('assist profile ↔ mapping.js parity', () => {
  const interests = director('e3', 'yes', 'Gamma', {
    gender: 'male',
    occupationType: 'business',
    highestEducationalQualification: 'master-degree',
    hasOtherCompanyInterest: 'yes',
    otherInterest1Company: 'Other Test Private Limited',
    otherInterest1Cin: 'U12345KA2020PTC123456',
    otherInterest1Designation: 'Director',
  });
  const result = buildAssistProfile(
    buildDocPackContext({
      state: assistFullState([director('e1', 'no', 'Alpha', { middleName: 'M' }), interests]),
      engagement: { companyName: 'Test Company India Private Limited' },
    }),
  );
  const withIndividuals = buildAssistProfile(
    buildDocPackContext({
      state: withSubscribers(assistFullState([director('e1', 'no', 'Alpha', { middleName: 'M' }), interests]), [
        { id: 's1', name: 'Gamma Director', shares: '10000' },
      ]),
      engagement: { companyName: 'Test Company India Private Limited', ownershipType: 'independent', companyType: 'domestic' },
    }),
  );
  const paths = [...new Set([...leafPaths(result.profile), ...leafPaths(withIndividuals.profile)])].sort();

  it('emits every key it is expected to (the fixture exercises the full shape)', () => {
    expect(paths).toEqual(
      expect.arrayContaining([
        'company.proposedNames[]',
        'company.nicCode',
        'registeredOffice.email',
        'directors[].firstName',
        'directors[].middleName',
        'directors[].interests[].cin',
        'directors[].interests[].designation',
        'company.subCategory',
        'subscribers[].representative.firstName',
        'subscribers[].shares.equity.number',
        'subscribers[].interests[].cin',
        'moa.witness.name',
        'aoa.witness.addressDescriptionOccupation',
      ]),
    );
  });

  it('every emitted key is one mapping.js reads, or is listed as informational with a reason', () => {
    const unknown = paths.filter((p) => !MAPPING_JS_PATHS.has(p) && !INFORMATIONAL_PATHS.has(p));
    expect(unknown).toEqual([]);
  });

  it('a renamed key fails the check', () => {
    const renamed = leafPaths({ company: { nicCodee: '62011' }, directors: [{ surname: 'X' }] });
    expect(renamed.filter((p) => !MAPPING_JS_PATHS.has(p))).toEqual(['company.nicCodee', 'directors[].surname']);
  });
});
