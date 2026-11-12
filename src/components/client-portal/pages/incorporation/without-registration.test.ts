import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/client-portal/PortalProvider', () => ({ usePortal: () => ({}) }));
vi.mock('@/context/app-provider', () => ({ useApp: () => ({}) }));

const { buildIncorporationModel } = await import('@/lib/client-portal/step-model');
const { withoutRegistration } = await import('./data');

describe('withoutRegistration (D1)', () => {
  it('drops the Registration phase and recounts the steps that are left', () => {
    const model = buildIncorporationModel({});
    const out = withoutRegistration(model);
    expect(out.phases.map((p) => p.no)).toEqual([1, 2, 3]);
    expect(out.steps.every((s) => s.phaseNo <= 3)).toBe(true);
    expect(out.all.total).toBe(out.steps.length);
    expect(Object.keys(out.byId)).toHaveLength(out.steps.length);
    expect(out.spice).toEqual(model.spice);
  });

  it('does not count locked Phase 3 steps as late, but still counts the open late step', () => {
    const win = (from: string, to: string) => ({ from, to, setBy: 'm', setAt: '2026-09-01T00:00:00Z' });
    const locked = withoutRegistration(buildIncorporationModel({}, { steps: { 'post-1': win('2026-09-01', '2026-09-20') } }, '2026-11-01'));
    expect(locked.counts.late).toBe(0);
    const open = withoutRegistration(buildIncorporationModel({}, { steps: { 'pre-1': win('2026-09-01', '2026-09-20') } }, '2026-11-01'));
    expect(open.counts.late).toBe(1);
  });
});
