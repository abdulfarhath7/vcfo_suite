import { describe, expect, it, vi } from 'vitest';

import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import { directorResponsesFromState } from '@/lib/incorporation/proposed-directors';
import { buildAcceptanceLetterMergeFields } from '@/lib/incorporation-docs/acceptance-letter';
import { buildAoaMergeFields } from '@/lib/incorporation-docs/aoa';
import { buildAuthorisationLetterMergeFields } from '@/lib/incorporation-docs/authorisation-letter';
import { buildDeclarationMergeFields } from '@/lib/incorporation-docs/declarations';
import { buildDir2MergeFields } from '@/lib/incorporation-docs/dir2';
import { buildDir8MergeFields } from '@/lib/incorporation-docs/dir8';
import { buildInc9MergeFields } from '@/lib/incorporation-docs/inc9';
import { buildMoaMergeFields } from '@/lib/incorporation-docs/moa';
import { buildPanUndertakingMergeFields } from '@/lib/incorporation-docs/pan-undertaking';
import { buildSubscriptionSheetMergeFields } from '@/lib/incorporation-docs/subscription-sheet';
import { buildNotice, noticeText } from '@/lib/board-meetings/notice';
import { resolutionDocx } from '@/lib/board-meetings/resolution';
import PizZip from 'pizzip';

vi.mock('server-only', () => ({}));

/*
 * GL-09: every generated document prints company and person names with capital letters, even
 * when the person typed them in lower case. Each template's merge fields are built from answers
 * typed all in lower case, and no field may still hold a lower-case name.
 */

const COMPANY = 'ember technologies private limited';
const PARENT = 'abc (india) llp';
const LOWER_NAMES = ['ember technologies', 'abc (india)', 'ravi', 'kumar', 'mohan lal', 'suresh rao', 'anil', 'sharma'];

function lowerCaseState() {
  const state = fullState(
    [
      director('d1', 'yes', 'ravi', { lastName: 'kumar', fatherName: 'mohan lal' }),
      director('d2', 'no', 'priya', { lastName: 'kumar', fatherName: 'mohan lal' }),
    ],
    { pre7: { subscriptionWitnessName: 'suresh rao' } },
  );
  const pre1 = state['pre-1']!.responses as Record<string, string>;
  Object.assign(pre1, { proposedName1: COMPANY, parentEntityName: PARENT, signatoryFirstName: 'anil', signatoryLastName: 'sharma' });
  (state['pre-5']!.responses as Record<string, string>).approvedCompanyName = COMPANY;
  return state;
}

/** Every string inside a merge-field object, nested rows included. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

function lowerCaseNamesIn(fields: unknown): string[] {
  return strings(fields).filter((text) => LOWER_NAMES.some((name) => new RegExp(`(^|[^\\p{L}])${name.replace(/[()]/g, '\\$&')}`, 'u').test(text)));
}

describe('GL-09 name casing in every document template', () => {
  const state = lowerCaseState();
  const { pre1, pre6 } = directorResponsesFromState(state);
  const pre5 = state['pre-5']!.responses as Record<string, string>;
  const pre7 = state['pre-7']!.responses as Record<string, string>;
  const engagement = { companyName: COMPANY, parentEntityName: PARENT, parentEntityAddress: '1 Road', parentEntityRegistrationNumber: 'P-1' };
  const base = { engagement, pre1, pre5, pre6, pre7 };

  const templates: Array<[string, () => unknown]> = [
    ['Acceptance letter', () => buildAcceptanceLetterMergeFields({ ...base, director: 'non-resident' })],
    ['AOA', () => buildAoaMergeFields({ ...base, director: 'company' })],
    ['Authorisation letter', () => buildAuthorisationLetterMergeFields({ ...base, director: 'company' })],
    ['Declarations', () => buildDeclarationMergeFields({ ...base, director: 'resident' })],
    ['DIR-2', () => buildDir2MergeFields({ ...base, director: 'resident' })],
    ['DIR-8', () => buildDir8MergeFields({ ...base, director: 'resident' })],
    ['INC-9', () => buildInc9MergeFields({ ...base, director: 'resident' })],
    ['MOA', () => buildMoaMergeFields({ ...base, director: 'company' })],
    ['PAN undertaking', () => buildPanUndertakingMergeFields({ ...base, director: 'non-resident' })],
    ['Subscription sheet', () => buildSubscriptionSheetMergeFields({ ...base, director: 'company' })],
  ];

  it.each(templates)('%s prints no lower-case name', (_name, build) => {
    expect(lowerCaseNamesIn(build())).toEqual([]);
  });

  it('cases the typed company name as the CR asks', () => {
    const moa = strings(buildMoaMergeFields({ ...base, director: 'company' })).join('\n');
    expect(moa).toContain('Ember Technologies Private Limited');
  });

  it('board meeting notice and resolution print no lower-case name', () => {
    const notice = buildNotice({
      companyName: COMPANY,
      cin: null,
      address: null,
      kind: 'board',
      meetingNo: '1',
      meetingDate: '2026-11-20',
      meetingTime: '10:00',
      secondZone: null,
      mode: 'vc',
      venue: '1 Road',
      noticeOn: '2026-11-11',
      to: [{ name: 'ravi kumar' }],
      signatory: { name: 'anil sharma', din: null, designation: 'Director' },
      agenda: [],
      teamsLink: null,
      bodyOverride: null,
    });
    expect(lowerCaseNamesIn(noticeText(notice))).toEqual([]);
    expect(noticeText(notice)).toContain('Ember Technologies Private Limited');

    const docx = resolutionDocx({
      companyName: COMPANY,
      cin: null,
      address: null,
      title: 'Bank account',
      description: 'RESOLVED THAT the company opens a bank account.',
      resolutionDate: '2026-11-11',
      meetingNo: '1',
      meetingDate: '2026-11-20',
      changesItem: null,
      signers: [{ name: 'ravi kumar', din: null }],
    });
    const text = new PizZip(docx).file('word/document.xml')!.asText().replace(/<[^>]+>/g, '');
    expect(lowerCaseNamesIn(text)).toEqual([]);
    expect(text).toContain('Ravi Kumar');
  });
});
