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
});
