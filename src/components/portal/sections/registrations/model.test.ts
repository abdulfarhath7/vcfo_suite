import { describe, expect, it } from 'vitest';
import { buildIncorporationModel, type PortalStep } from '@/lib/client-portal/step-model';
import { registrationSopFor } from '@/data/registration-sops';
import { groupRegistrations, processStates, regStatus, registrationReference, requiredPapers } from './model';

const TODAY = '2026-10-28';
function reg(id: string, state: Record<string, unknown> = {}): PortalStep {
  const model = buildIncorporationModel(state as never, null, TODAY);
  return model.byId[id]!;
}

describe('registration status', () => {
  it('maps the step model onto the five registration states', () => {
    expect(regStatus({ ...reg('reg-4'), kind: 'done' }, 0)).toBe('live');
    expect(regStatus({ ...reg('reg-4'), kind: 'with' }, 0)).toBe('sbc');
    expect(regStatus({ ...reg('reg-4'), kind: 'with' }, 1)).toBe('you'); // an open file request is the client's move
    expect(regStatus({ ...reg('reg-4'), kind: 'you' }, 0)).toBe('you');
    expect(regStatus({ ...reg('reg-4'), kind: 'up' }, 0)).toBe('queued');
    expect(regStatus(reg('reg-13', { 'reg-13': { status: 'not-applicable' } }), 0)).toBe('na');
  });

  it('reads the reference SBC recorded from the step fields', () => {
    const s = reg('reg-4', { 'reg-4': { status: 'completed', responses: { gstinNumber: '36AADCN8821Q1Z4' } } });
    expect(registrationReference(s)).toEqual({ label: 'GSTIN', value: '36AADCN8821Q1Z4' });
    expect(registrationReference(reg('reg-4'))).toBeUndefined();
  });
});

describe('process chain', () => {
  const gst = registrationSopFor('reg-4')!;
  it('marks the whole chain for live / queued / not applicable', () => {
    expect(new Set(processStates(gst, 'live', false))).toEqual(new Set(['done']));
    expect(new Set(processStates(gst, 'queued', false))).toEqual(new Set(['up']));
    expect(new Set(processStates(gst, 'na', false))).toEqual(new Set(['na']));
  });
  it('puts the client collection step on "now" when the client holds it', () => {
    const st = processStates(gst, 'you', false);
    expect(st[0]).toBe('done'); // Eligibility Review (SBC)
    expect(st[1]).toBe('now'); // Document Collection (YOU)
    expect(st[2]).toBe('up');
  });
  it('moves to SBC after collection and to the last step once a reference exists', () => {
    const st = processStates(gst, 'sbc', false);
    expect(st[1]).toBe('done');
    expect(st[2]).toBe('now'); // Document Verification (SBC)
    const late = processStates(gst, 'sbc', true);
    expect(late.at(-1)).toBe('now');
    expect(late.slice(0, -1).every((x) => x === 'done')).toBe(true);
  });
});

describe('grouping and papers', () => {
  it('groups phase-4 steps in the agreed order and keeps unknown ones under Other', () => {
    const steps = buildIncorporationModel({}, null, TODAY).phases[3]!.steps;
    const groups = groupRegistrations([...steps, { ...steps[0]!, id: 'reg-99' }]);
    expect(groups[0]!.name).toBe('General');
    expect(groups[0]!.steps[0]!.id).toBe('reg-4');
    expect(groups.at(-1)!.name).toBe('Other');
    expect(groups.at(-1)!.steps[0]!.id).toBe('reg-99');
  });
  it('shortens the catalog paper names to their first clause', () => {
    expect(requiredPapers(reg('reg-9'))).toContain('Name board in Telugu & English');
    expect(requiredPapers(reg('reg-13')).some((p) => p.includes('(if applicable)'))).toBe(true);
  });
});
