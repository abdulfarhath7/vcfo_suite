import { describe, expect, it } from 'vitest';
import { gateActiveCatalog } from '@/lib/checklist/checklist-step-gate';
import { internPhaseStepCounts, internOverviewPhases } from '@/lib/intern/intern-overview-progress';
import { shownDoneGate, shownStepGates } from './shown-step-gates';

describe('shownStepGates', () => {
  const state = {
    'pre-1': { status: 'in-progress', responses: { proposedName1: 'Emburse India' } },
    'pre-2': { status: 'completed' },
  } as never;

  it('marks a step done when its own status is Done, behind an open step', () => {
    const raw = gateActiveCatalog(state, 'client');
    expect(raw['pre-2']!.kind).toBe('locked');
    const shown = shownStepGates(raw, state);
    expect(shown['pre-2']!.kind).toBe('done');
    // Only the mark changes; what the viewer may do stays the gate's.
    expect(shown['pre-2']!.canEdit).toBe(raw['pre-2']!.canEdit);
    expect(shown['pre-1']).toEqual(raw['pre-1']);
  });

  it('gives the record card the same count for every staff viewer', () => {
    const phase1 = internOverviewPhases()[0]!.items;
    const admin = internPhaseStepCounts(phase1, shownStepGates(gateActiveCatalog(state, 'client'), state));
    const lead = internPhaseStepCounts(phase1, shownStepGates(gateActiveCatalog(state, 'intern'), state));
    expect(admin.done).toBe(1);
    expect(lead).toEqual(admin);
  });

  it('never turns a step done when its status is not completed', () => {
    const gate = { kind: 'locked' as const, canOpen: false, canEdit: false, message: null };
    expect(shownDoneGate(gate, 'in-progress')).toBe(gate);
    expect(shownDoneGate(gate, 'completed').kind).toBe('done');
  });
});
