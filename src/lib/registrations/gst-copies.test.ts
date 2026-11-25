import { describe, expect, it } from 'vitest';
import { director, fullState } from '@/lib/doc-pack/__tests__/fixtures';
import type { EngagementChecklistState } from '@/lib/projects/engagements-db';
import { buildGstProfile, type GstBuildInput } from './gst-profile-build';
import { gstReadinessView } from './gst-readiness';

/**
 * GST copies and the client's unconfirmed values (owner brief, 25 Nov 2026): a finished checklist
 * step is never reopened for GST, so the GST step holds a copy and the profile prefers it; a value
 * the client entered and the lead has not confirmed is used, does not block, and is listed for a
 * confirm. Obviously fake data only: the repo is public.
 */

const D1 = director('d1', 'yes', 'Asha', { gender: 'female', recentPhotographUrl: 'eng-1/recentPhotographUrl/1-asha.jpg' });
const D2 = director('d2', 'yes', 'Ravi', { gender: 'male', fatherName: 'Mohan Rao', recentPhotographUrl: 'eng-1/recentPhotographUrl/2-ravi.jpg' });

function state(over: Partial<EngagementChecklistState> = {}): EngagementChecklistState {
  return {
    ...fullState([D1, D2]),
    ...over,
    'pre-12': {
      status: 'completed',
      responses: { incorporatedCompanyName: 'Test Company Private Limited', dateOfIncorporation: '2026-11-02', cin: 'U62099KA2026PTC000001', pan: 'aaatc1234x', certificateOfIncorporationFinalUrl: 'eng-1/certificateOfIncorporationFinalUrl/1-coi.pdf' },
    },
  } as EngagementChecklistState;
}

const CLIENT = { district: 'Bengaluru Urban', reason: 'voluntary', possession: 'owned', activities: 'office, supplier of services', sac: '998314' };

const input = (over: Partial<GstBuildInput> = {}): GstBuildInput => ({
  engagement: { id: 'eng-1', slug: 'test', companyName: 'Test Company Private Limited', entityLegalForm: 'company', incorporationDate: '2026-11-02' },
  state: state(),
  client: CLIENT,
  sbc: {},
  requestFiles: [
    { label: 'Electricity bill', fileName: 'bill.pdf', contentType: 'application/pdf', sizeBytes: 10, objectKey: 'engagement-documents/eng-1/bill.pdf', source: 'request' },
    { label: 'Board resolution', fileName: 'br.pdf', contentType: 'application/pdf', sizeBytes: 10, objectKey: 'engagement-documents/eng-1/br.pdf', source: 'request' },
  ],
  ...over,
});

describe('GST copies of finished steps', () => {
  it("prefers the GST step's copy of the state and a director's address over the finished steps", () => {
    const r = buildGstProfile(input({ client: { ...CLIENT, 'place-state': 'Telangana' }, sbc: { 'promoter-2-address': 'House 9, Madhapur, Hyderabad, Telangana 500081' } }));
    expect(r.profile.partA.state).toBe('Telangana');
    expect(r.profile.principalPlace.address?.state).toBe('Telangana');
    expect(r.profile.promoters[1]!.address?.full).toBe('House 9, Madhapur, Hyderabad, Telangana 500081');
    expect(r.profile.promoters[1]!.address?.pincode).toBe('500081');
  });

  it('points a missing value of a finished step at the GST copy, not at the finished step', () => {
    const noState = state({ 'pre-14': { status: 'completed', responses: { registeredOfficeCompleteAddress: '2 Office Lane, Test City, 560001' } } } as Partial<EngagementChecklistState>);
    const r = buildGstProfile(input({ state: noState }));
    const gap = r.missing.find((m) => m.key === 'partA.state')!;
    expect(gap.stepId).toBe('reg-4');
    expect(gap.where).toMatch(/registered office step is finished/);
    const open = buildGstProfile(input({ state: { ...noState, 'pre-14': { status: 'in-progress', responses: {} } } as EngagementChecklistState }));
    expect(open.missing.find((m) => m.key === 'partA.state')!.stepId).toBe('pre-14');
  });

  it("points a finished directors step's missing address at the GST copy", () => {
    const noAddress = director('d2', 'yes', 'Ravi', { gender: 'male', fatherName: 'Mohan Rao', utilityBillAddress: '', recentPhotographUrl: 'eng-1/recentPhotographUrl/2-ravi.jpg' });
    const r = buildGstProfile(input({ state: state(fullState([D1, noAddress])) }));
    const gap = r.missing.find((m) => m.key === 'promoters.2.address');
    expect(gap?.stepId).toBe('reg-4');
    expect(gap?.where).toMatch(/directors step is finished/);
  });
});

describe('values the client entered and the lead has not confirmed', () => {
  it('lists them for a confirm, without making them missing or blocking', () => {
    const base = input({ sbc: { 'promoter-1-address': 'Flat 1, Test City 560001', 'promoter-2-address': 'Flat 2, Test City 560001' } });
    const ready = buildGstProfile(base);
    expect(ready.readiness.ready).toBe(true);
    expect(ready.confirm).toEqual([]);
    const r = buildGstProfile({ ...base, unconfirmed: ['district', 'sac', 'trade-name', 'sac'] });
    expect(r.readiness.ready).toBe(true);
    // Only values the profile holds, once each, with the GST step's labels.
    expect(r.confirm).toEqual([
      { key: 'district', label: 'District of the principal place' },
      { key: 'sac', label: 'SAC codes of the main services (up to five)' },
    ]);
    const view = gstReadinessView(r);
    expect(view.ready).toBe(true);
    expect(view.confirm).toHaveLength(2);
    expect(view.actions).toEqual(['confirm_client', 'start_portal', 'open_step']);
    expect(view.line).toMatch(/2 values the client entered need your confirmation/);
  });

  it('says nothing about confirmations when there are none', () => {
    const view = gstReadinessView({ companyName: 'X', missing: [], readiness: { ready: true, missingValues: 0, missingDocuments: 0 } });
    expect(view.confirm).toEqual([]);
    expect(view.actions).not.toContain('confirm_client');
    expect(view.line).not.toMatch(/confirmation/);
  });
});
