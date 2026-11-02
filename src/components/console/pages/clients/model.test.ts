import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { buildClientView, clientPaths, companyInitials, healthOf, holderText, isListedOnClients, stageOf, stepCode } from './model';
import { buildIncorporationModel } from '@/lib/client-portal/step-model';

const TODAY = '2026-10-29';

function eng(over: Partial<Engagement> = {}): Engagement {
  return {
    id: 'e-1',
    slug: 'acme',
    clientId: 'c-1',
    companyName: 'Acme Robotics India Pvt Ltd',
    companyType: 'foreign',
    internId: 'lead-1',
    leadIds: ['lead-1'],
    adminId: '',
    createdAt: '2026-10-01T09:00:00Z',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    ...over,
  } as Engagement;
}

describe('step codes', () => {
  it('numbers steps by their place in the catalog, as the prototype does', () => {
    expect(stepCode('pre-1')).toBe('Pre-1');
    expect(stepCode('pre-5')).toBe('Pre-5');
    expect(stepCode('pre-13')).toBe('Pre-6');
    expect(stepCode('pre-14')).toBe('Pre-7');
    expect(stepCode('pre-12')).toBe('Pre-14');
    expect(stepCode('post-1')).toBe('Post-1');
    expect(stepCode('reg-4')).toBe('Reg-1');
  });
});

describe('stage', () => {
  it('is incorporating until the COI, compliance after', () => {
    expect(stageOf({ stage: 'Pre-Incorporation' })).toBe('inc');
    expect(stageOf({ stage: 'Post-Incorporation' })).toBe('cmp');
    expect(stageOf({ stage: 'Operational Readiness' })).toBe('cmp');
  });
  it('keeps the live list rule: Operational Readiness is not listed', () => {
    expect(isListedOnClients({ stage: 'Operational Readiness' })).toBe(false);
    expect(isListedOnClients({ stage: 'Post-Incorporation' })).toBe(true);
  });
});

describe('client view', () => {
  const people = [{ id: 'lead-1', name: 'Arjun Mehta' }];

  it('a new project waits on the client for Client Details since the project started', () => {
    const v = buildClientView(eng(), {}, people, TODAY);
    expect(v.current?.id).toBe('pre-1');
    expect(v.holder.who).toBe('client');
    expect(holderText(v.holder)).toBe('Waiting on the client · 28d');
    expect(v.health.label).toBe('New');
    expect(v.day).toBe(29);
    expect(v.leads).toEqual([{ id: 'lead-1', name: 'Arjun Mehta' }]);
  });

  it('a step past its window makes the project stuck, with the reason', () => {
    const state: Record<string, ChecklistItemStateSlice> = { 'pre-1': { status: 'completed', completedOn: '2026-10-05' } };
    const e = eng({ schedule: { steps: { 'pre-2': { from: '2026-10-06', to: '2026-10-20', setBy: 'm', setAt: '' } } } });
    const v = buildClientView(e, state, people, TODAY);
    expect(v.health.key).toBe('stuck');
    expect(v.health.why).toContain('9 days late');
    expect(v.holder.since).toBe('2026-10-05');
  });

  it('a step due within three days is at risk; the stored health wins when set', () => {
    const state: Record<string, ChecklistItemStateSlice> = { 'pre-1': { status: 'completed', completedOn: '2026-10-05' } };
    const e = eng({ schedule: { steps: { 'pre-2': { from: '2026-10-06', to: '2026-10-31', setBy: 'm', setAt: '' } } } });
    const model = buildIncorporationModel(state, e.schedule ?? null, TODAY);
    expect(healthOf(e, model, model.current, TODAY).key).toBe('risk');
    expect(healthOf({ health: 'overdue' }, model, model.current, TODAY).key).toBe('stuck');
  });

  it('a step waiting on the manager is "Needs you"', () => {
    const state: Record<string, ChecklistItemStateSlice> = {
      'pre-1': { status: 'completed', completedOn: '2026-10-05' },
      'pre-2': { status: 'in-progress', reviewStatus: 'reviewing', reviewSource: 'lead_manager_request' },
    };
    const v = buildClientView(eng(), state, people, TODAY);
    expect(v.approvals.map((a) => a.itemId)).toContain('pre-2');
    expect(v.holder.who).toBe('you');
  });
});

describe('initials', () => {
  it('skips the legal words', () => {
    expect(companyInitials('Northwind Analytics India Pvt Ltd')).toBe('NA');
    expect(companyInitials('Pinewood Logistics LLP')).toBe('PL');
    expect(companyInitials('Routeware')).toBe('RO');
  });
});

describe('project lead seat', () => {
  const people = [{ id: 'lead-1', name: 'Arjun Mehta' }];
  it('the lead holds its own step, and a step waiting on the manager reads "With the manager"', () => {
    const state: Record<string, ChecklistItemStateSlice> = { 'pre-1': { status: 'completed', completedOn: '2026-10-05' } };
    expect(buildClientView(eng(), state, people, TODAY, 'lead').holder.long).toBe('Your step');
    const pending: Record<string, ChecklistItemStateSlice> = {
      ...state,
      'pre-2': { status: 'in-progress', reviewStatus: 'reviewing', reviewSource: 'lead_manager_request' },
    };
    const v = buildClientView(eng(), pending, people, TODAY, 'lead');
    expect(v.holder.who).toBe('manager');
    expect(v.holder.long).toBe('With the manager');
  });
  it('builds each seat’s links', () => {
    const m = clientPaths('/app/manager');
    const l = clientPaths('/app/intern');
    const e = { id: 'e-1', slug: 'acme' };
    expect(m.list).toBe('/app/manager/projects');
    expect(l.list).toBe('/app/intern/clients');
    expect(l.project(e)).toBe('/app/intern/projects/acme');
    expect(l.step(e, 'pre-14', 'Registered office')).toBe('/app/intern/projects/acme/step/registered-office-address?tab=Registered%20office');
    expect(l.docs(e, 'part-b')).toBe('/app/intern/projects/acme/documents?part=part-b');
    expect(l.boardResolution(e)).toBe('/app/intern/projects/acme/board-resolution');
  });
});
