import { describe, expect, it } from 'vitest';

import { buildDocPackContext } from '@/lib/doc-pack/evaluate';
import { director } from '@/lib/doc-pack/__tests__/fixtures';
import {
  ASSIST_PROFILE_SCHEMA_VERSION,
  MISSING_REASON,
  buildAssistProfile,
  rupeeAmount,
  splitMobile,
  toMcaDate,
} from '@/lib/assist-profile/build';
import { ASSIST_PRE1, NR, RESIDENT, assistFullState } from '@/lib/assist-profile/__tests__/fixtures';
import type { EngagementChecklistState } from '@/lib/engagements-db';

function build(state: EngagementChecklistState, engagement = { companyName: 'Test Company India Private Limited' }) {
  return buildAssistProfile(buildDocPackContext({ state, engagement }));
}

/** Items a Suite step could fill — the ones a lead can act on. */
const fixable = <T extends { reason?: string }>(missing: T[]): T[] => missing.filter((m) => m.reason === undefined);

describe('buildAssistProfile', () => {
  it('a full engagement produces a complete profile and nothing the lead can fill is missing', () => {
    const result = build(assistFullState());
    expect(result.schemaVersion).toBe(ASSIST_PROFILE_SCHEMA_VERSION);
    expect(result.companyName).toBe('Test Company India Private Limited');
    expect(fixable(result.missing)).toEqual([]);

    const { company, registeredOffice, directors } = result.profile;
    expect(company).toEqual({
      proposedNames: ['Test Company India Private Limited', 'Test Labs India Private Limited'],
      type: 'New Company (Others)',
      class: 'Private',
      category: 'Company limited by shares',
      nicCode: '62011',
      nicDescription: 'Writing, modifying, testing of computer program',
      hasShareCapital: true,
      aoaEntrenched: false,
      capital: {
        authorized: 1000000,
        subscribed: 100000,
        equity: { classes: 1, authorizedShares: 100000, subscribedShares: 10000, faceValue: 10 },
        preference: { classes: 0 },
      },
    });
    expect(registeredOffice).toEqual({
      country: 'India',
      email: 'office@example.test',
      mobile: '9999999999',
      countryCode: '+91',
    });
    expect(directors).toHaveLength(2);
    expect(directors[1]).toEqual({
      id: 'e2',
      index: 2,
      firstName: 'Beta',
      surName: 'Director',
      gender: 'Male',
      dob: '01/01/1980',
      residentInIndia: true,
      occupationType: 'Business',
      education: "Bachelor's degree",
      pan: 'ABCDE1234F',
      din: '01234567',
      email: 'director@example.test',
      countryCode: '+91',
      mobile: '9999999999',
    });
  });

  it('every missing item on a full engagement names why Suite cannot supply it', () => {
    const { missing } = build(assistFullState());
    const reasons = new Set(Object.values(MISSING_REASON));
    for (const m of missing) expect(reasons.has(m.reason as never), m.key).toBe(true);
    expect(missing.map((m) => m.key)).toContain('company.subCategory');
    expect(missing.map((m) => m.key)).toContain('subscribers');
  });

  it('no registered office: lists company.registeredOffice at pre-14 and omits the section', () => {
    const state = assistFullState();
    state['pre-14'] = { status: 'not-started', responses: {} };
    const result = build(state);
    expect(result.profile).not.toHaveProperty('registeredOffice');
    const item = result.missing.find((m) => m.key === 'company.registeredOffice');
    expect(item).toMatchObject({ stepId: 'pre-14', tabId: 'registered-office' });
    expect(item?.reason).toBeUndefined();
    expect(result.notes.some((n) => n.key === 'registeredOffice.lines')).toBe(false);
  });

  it('a Suite value with no vocabulary entry is missing, never passed through', () => {
    const other = director('e3', 'yes', 'Gamma', { gender: 'other', occupationType: 'business', highestEducationalQualification: 'bachelors-degree' });
    const result = build(assistFullState([NR, other]));
    const gamma = result.profile.directors[1]!;
    expect(gamma).not.toHaveProperty('gender');
    expect(JSON.stringify(result.profile)).not.toMatch(/"other"/);
    expect(result.missing).toContainEqual({
      key: 'director.2.gender',
      label: 'Gender',
      stepId: 'pre-15',
      tabId: 'directors',
      directorIndex: 2,
      reason: MISSING_REASON.noMcaEquivalent,
    });
  });

  it('a name with no mapped legal suffix leaves the company structure missing', () => {
    const result = build(
      assistFullState([NR, RESIDENT], { ...ASSIST_PRE1, proposedName1: 'Test Company LLP', proposedName2: '' }),
      { companyName: 'Test Company LLP' },
    );
    expect(result.profile.company).not.toHaveProperty('type');
    expect(result.profile.company).not.toHaveProperty('class');
    expect(result.missing.find((m) => m.key === 'company.structure')?.reason).toBe(MISSING_REASON.noMcaEquivalent);
  });

  it('director order is preserved and index maps to array position', () => {
    const a = director('z9', 'yes', 'Zed');
    const b = director('a1', 'no', 'Ann');
    const c = director('m5', 'yes', 'Mo');
    const { directors } = build(assistFullState([a, b, c])).profile;
    expect(directors.map((d) => d.firstName)).toEqual(['Zed', 'Ann', 'Mo']);
    expect(directors.map((d) => d.id)).toEqual(['z9', 'a1', 'm5']);
    directors.forEach((d, i) => expect(d.index).toBe(i + 1));

    // Reordering in pre-15 moves the stable id with the person.
    const reordered = build(assistFullState([c, a, b])).profile.directors;
    expect(reordered.map((d) => [d.index, d.id])).toEqual([
      [1, 'm5'],
      [2, 'z9'],
      [3, 'a1'],
    ]);
  });

  it('a blank director field is missing under the doc-pack key for that director', () => {
    const noPan = director('e2', 'yes', 'Beta', { panNumber: '', gender: 'male', occupationType: 'business', highestEducationalQualification: 'bachelors-degree' });
    const result = build(assistFullState([NR, noPan]));
    expect(result.profile.directors[1]).not.toHaveProperty('pan');
    expect(fixable(result.missing)).toEqual([
      { key: 'director.2.pan', label: 'PAN', stepId: 'pre-15', tabId: 'directors', directorIndex: 2 },
    ]);
  });

  it('a non-resident director carries no PAN and is not reported missing one', () => {
    const result = build(assistFullState());
    expect(result.profile.directors[0]).not.toHaveProperty('pan');
    expect(result.profile.directors[0]?.residentInIndia).toBe(false);
    expect(result.missing.some((m) => m.key === 'director.1.pan')).toBe(false);
  });

  it('dates convert to DD/MM/YYYY', () => {
    expect(toMcaDate('1990-08-15')).toBe('15/08/1990');
    expect(toMcaDate('15/08/1990')).toBe('15/08/1990');
    expect(toMcaDate('Aug 15 1990')).toBeUndefined();
    expect(toMcaDate('')).toBeUndefined();
    expect(build(assistFullState()).profile.directors[0]?.dob).toBe('01/01/1980');
  });

  it('mcaLogin.userId is always empty', () => {
    expect(build(assistFullState()).profile.mcaLogin).toEqual({ userId: '' });
    expect(build({}).profile.mcaLogin).toEqual({ userId: '' });
  });

  it('an empty engagement emits no invented values', () => {
    const result = build({}, { companyName: '' });
    expect(result.companyName).toBe('');
    expect(result.profile.company).toEqual({
      hasShareCapital: true,
      aoaEntrenched: false,
      capital: { equity: { classes: 1 }, preference: { classes: 0 } },
    });
    expect(result.profile.directors).toEqual([]);
    const keys = fixable(result.missing).map((m) => m.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'company.name',
        'company.nicCode',
        'company.authorisedShareCapital',
        'company.registeredOffice',
        'directors.any',
      ]),
    );
  });

  it('share counts that do not divide evenly are missing, not rounded', () => {
    const result = build(assistFullState([NR, RESIDENT], { ...ASSIST_PRE1, nominalValuePerEquityShare: '3' }));
    expect(result.profile.company.capital?.equity).toEqual({ classes: 1, faceValue: 3 });
    expect(result.missing.find((m) => m.key === 'company.authorisedShares')?.reason).toBe(MISSING_REASON.notWholeShares);
  });

  it('keeps the NIC popup caveat in notes', () => {
    expect(build(assistFullState()).notes).toContainEqual({
      key: 'company.nicCode',
      note: 'Pick the NIC row from the popup table manually; MainNICCode is read-only.',
    });
  });

  it('after name approval the approved name leads and the second name is not required', () => {
    const state = assistFullState();
    state['pre-5'] = { status: 'completed', responses: { approvedCompanyName: 'Test Labs India Private Limited' } };
    const result = build(state);
    expect(result.profile.company.proposedNames).toEqual([
      'Test Labs India Private Limited',
      'Test Company India Private Limited',
    ]);
    expect(result.companyName).toBe('Test Labs India Private Limited');
  });
});

describe('format helpers', () => {
  it('rupeeAmount reads Indian-grouped and prefixed amounts', () => {
    expect(rupeeAmount('10,00,000')).toBe(1000000);
    expect(rupeeAmount('INR 10')).toBe(10);
    expect(rupeeAmount('₹ 1,00,000')).toBe(100000);
    expect(rupeeAmount('ten lakh')).toBeUndefined();
    expect(rupeeAmount('0')).toBeUndefined();
  });

  it('splitMobile separates the country code only when Suite stored one', () => {
    expect(splitMobile('+91 9999999999')).toEqual({ countryCode: '+91', mobile: '9999999999' });
    expect(splitMobile('+1-415 555 0100')).toEqual({ countryCode: '+1', mobile: '4155550100' });
    expect(splitMobile('9999999999')).toEqual({ mobile: '9999999999' });
    expect(splitMobile('+919999999999')).toBeUndefined();
  });
});

describe('buildAssistProfile — AGILE-PRO-S, INC-33, INC-34', () => {
  it('counts the directors for AGILE-PRO-S and supplies nothing it does not hold', () => {
    const { profile } = build(assistFullState());
    expect(profile.agile).toEqual({ numberOfDirectors: 2 });
    expect(profile.moa).toEqual({});
    expect(profile.aoa).toEqual({});
  });

  it('with no directors, AGILE-PRO-S carries no count', () => {
    expect(build({}).profile.agile).toEqual({});
  });

  it('lists every uncollected e-form input as missing with a reason, at the filing step', () => {
    const { missing } = build(assistFullState());
    const eforms = missing.filter((m) => /^(agile|moa|aoa)\./.test(m.key));
    expect(eforms.map((m) => m.key)).toEqual([
      'agile.gstin',
      'agile.premises',
      'agile.businessActivity',
      'agile.authorizedSignatory',
      'agile.esic',
      'agile.bank',
      'agile.declaration',
      'moa.objects',
      'moa.liabilityClause',
      'moa.witness',
      'aoa.witness',
      'aoa.subscriberPlaces',
    ]);
    for (const m of eforms) {
      expect(m.stepId).toBe('pre-10');
      expect(m.reason).toBe(MISSING_REASON.notCollected);
    }
  });

  it('tells the lead which e-form choices Suite leaves to the lead', () => {
    const keys = build(assistFullState()).notes.map((n) => n.key);
    expect(keys).toEqual(expect.arrayContaining(['agile.declarations', 'moa.table']));
  });
});
