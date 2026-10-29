import { beforeEach, describe, expect, it, vi } from 'vitest';

const validate = vi.fn();
vi.mock('@/lib/checklist/checklist-step-validation', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/checklist/checklist-step-validation')>();
  return {
    ...real,
    validateStepAgainstState: (...args: Parameters<typeof real.validateStepAgainstState>) => validate(...args),
  };
});

const { stepCompletionVerdict } = await import('@/lib/work/step-completion');
const real = await vi.importActual<typeof import('@/lib/checklist/checklist-step-validation')>(
  '@/lib/checklist/checklist-step-validation',
);

beforeEach(() => {
  validate.mockReset();
  validate.mockImplementation(real.validateStepAgainstState);
});

describe('stepCompletionVerdict', () => {
  it('sends a step outside the direct flow to its form', () => {
    expect(stepCompletionVerdict({ stepId: 'post-1', role: 'intern', state: {} })).toEqual({
      mode: 'form',
      reason: 'not_direct_flow',
    });
    expect(stepCompletionVerdict({ stepId: 'pre-2', role: 'intern', state: {} })).toMatchObject({ mode: 'form' });
    expect(stepCompletionVerdict({ stepId: 'nope', role: 'intern', state: {} })).toEqual({
      mode: 'form',
      reason: 'unknown_step',
    });
  });

  it('reads a completed direct-flow step as done', () => {
    expect(
      stepCompletionVerdict({ stepId: 'pre-1', role: 'intern', state: { 'pre-1': { status: 'completed' } } }),
    ).toEqual({ mode: 'done' });
  });

  it('never lets a manager or admin complete a direct-flow step from the drawer', () => {
    for (const role of ['manager', 'admin', 'super_admin']) {
      expect(stepCompletionVerdict({ stepId: 'pre-1', role, state: {} })).toEqual({ mode: 'form', reason: 'role' });
    }
  });

  it('reports a locked step without validating it', () => {
    const verdict = stepCompletionVerdict({ stepId: 'pre-3', role: 'intern', state: {} });
    expect(verdict.mode).toBe('locked');
    expect(validate).not.toHaveBeenCalled();
  });

  it('uses the shared validator: missing answers block, a clean step may be completed', () => {
    const blocked = stepCompletionVerdict({ stepId: 'pre-1', role: 'intern', state: {} });
    expect(blocked).toMatchObject({ mode: 'direct', canComplete: false });
    expect(blocked.mode === 'direct' && blocked.missing).toBeGreaterThan(0);
    expect(validate).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'pre-1' }));

    validate.mockReturnValue({ ok: true, errors: {}, warnings: {} });
    expect(stepCompletionVerdict({ stepId: 'pre-1', role: 'intern', state: {} })).toEqual({
      mode: 'direct',
      canComplete: true,
      missing: 0,
    });
  });
});
