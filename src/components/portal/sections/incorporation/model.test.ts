import { describe, expect, it } from 'vitest';
import { buildIncorporationModel, type PortalStep } from '@/lib/client-portal/step-model';
import { getItem } from '@/data/checklist';
import { phaseInfo, protoOwner, protoState, resolveStepId, stepDescription, stepNeeds } from './model';

function step(over: Partial<PortalStep>): PortalStep {
  const model = buildIncorporationModel({}, null, '2026-10-28');
  return { ...model.byId['pre-1']!, ...over };
}

describe('incorporation model helpers', () => {
  it('resolves a step id or a catalog slug, and nothing else', () => {
    expect(resolveStepId('pre-13')).toBe('pre-13');
    expect(resolveStepId('capital-structure')).toBe('pre-13');
    expect(resolveStepId('board-resolution-execution')).toBe('pre-3');
    expect(resolveStepId('  ')).toBeUndefined();
    expect(resolveStepId('no-such-step')).toBeUndefined();
  });

  it('maps model kinds onto the prototype states', () => {
    expect(protoState(step({ kind: 'done' }))).toBe('done');
    expect(protoState(step({ kind: 'done', slice: { status: 'not-applicable' } as PortalStep['slice'] }))).toBe('na');
    expect(protoState(step({ kind: 'you', late: true }))).toBe('over');
    expect(protoState(step({ kind: 'done', late: true }))).toBe('done');
    expect(protoState(step({ kind: 'you' }))).toBe('you');
    expect(protoState(step({ kind: 'prog' }))).toBe('prog');
    expect(protoState(step({ kind: 'with' }))).toBe('prog');
    expect(protoState(step({ kind: 'next' }))).toBe('up');
    expect(protoState(step({ kind: 'up' }))).toBe('up');
  });

  it('maps owners: client → you, MCA → gov, else SBC', () => {
    expect(protoOwner(step({ owner: 'client' }))).toBe('you');
    expect(protoOwner(step({ owner: 'mca' }))).toBe('gov');
    expect(protoOwner(step({ owner: 'sbc' }))).toBe('sbc');
  });

  it('reads step text from the catalog', () => {
    const pre1 = getItem('pre-1')!;
    expect(stepDescription(pre1)).toBe(pre1.description);
    const post9 = getItem('post-9')!;
    expect(stepDescription(post9)).toBe(post9.notes);
    expect(stepNeeds(post9)[0]).toMatch(/^Company letterhead/);
  });

  it('summarises a phase with nothing done as not started, the first open step current', () => {
    const model = buildIncorporationModel({}, null, '2026-10-28');
    const f = phaseInfo(model.phases[0]!);
    expect(f.done).toBe(0);
    expect(f.pct).toBe(0);
    expect(f.app).toHaveLength(model.phases[0]!.steps.length);
    expect(f.cur?.id).toBe('pre-1');
  });
});
