import { describe, expect, it } from 'vitest';
import { planFill } from './plan';

const row = (id: string, stepId: string, action = 'checklist.setResponse', status = 'proposed') => ({ id, action, target: { stepId }, status });

describe('planFill', () => {
  const rows = [row('r1', 'pre-13'), row('r2', 'pre-1'), row('r3', 'pre-2'), row('r4', 'pre-1'), row('v1', 'pre-1', 'vault.upload'), row('r5', 'pre-3', 'checklist.setResponse', 'undone')];

  it('plans every step on the card in checklist order', () => {
    expect(planFill(rows).map((s) => [s.stepId, s.rowIds])).toEqual([
      ['pre-1', ['r2', 'r4']],
      ['pre-2', ['r3']],
      ['pre-13', ['r1']],
    ]);
  });

  it('plans only the scoped steps and leaves the other rows on the card', () => {
    expect(planFill(rows, ['pre-1', 'pre-2', 'pre-3', 'pre-4', 'pre-5']).map((s) => s.stepId)).toEqual(['pre-1', 'pre-2']);
    expect(planFill(rows, ['post-1'])).toEqual([]);
    expect(planFill(rows, []).map((s) => s.stepId)).toEqual(['pre-1', 'pre-2', 'pre-13']);
  });
});
