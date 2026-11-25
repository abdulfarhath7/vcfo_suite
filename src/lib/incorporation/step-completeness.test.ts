import { describe, expect, it } from 'vitest';
import { completenessLabel, stepCompleteness } from './step-completeness';

/** The completeness marks read the step's own validator: a tick only when Submit would pass. */
describe('stepCompleteness', () => {
  it('lists the required answers still missing, by label', () => {
    const mark = stepCompleteness({ stepId: 'pre-5', state: { 'pre-5': { status: 'in-progress', responses: { approvedCompanyName: 'Bonterra Private Limited' } } as never }, engagement: { ownershipType: 'independent' } })!;
    expect(mark.complete).toBe(false);
    expect(mark.missing).toBe(mark.labels.length);
    expect(mark.labels.length).toBeGreaterThan(0);
    expect(mark.labels.join(' ')).toMatch(/date/i);
    expect(completenessLabel(mark)).toBe(`${mark.missing} to fill`);
  });

  it('is complete when nothing required is missing, and absent for a step with no rules', () => {
    expect(completenessLabel({ complete: true, missing: 0 })).toBe('All required answers filled');
    expect(stepCompleteness({ stepId: 'pre-2', state: {} })).toBeNull();
    expect(stepCompleteness({ stepId: 'no-such-step', state: {} })).toBeNull();
  });
});
