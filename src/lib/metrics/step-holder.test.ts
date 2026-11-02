import { describe, expect, it } from 'vitest';
import { checklist } from '@/data/checklist';
import { STEP_HOLDERS, stepHolderOf, stepHolders } from '@/lib/metrics/step-holder';

describe('stepHolders', () => {
  it('uses only the four words, or null', () => {
    const all = stepHolders({}, checklist.map((c) => c.id));
    for (const v of Object.values(all)) expect(v === null || STEP_HOLDERS.includes(v)).toBe(true);
  });

  it('gives the open client step to the client and the steps not open yet to sbc', () => {
    expect(stepHolders({}, ['pre-1', 'pre-2'])).toEqual({ 'pre-1': 'client', 'pre-2': 'sbc' });
  });

  it('a done step has no holder, and the firm step it opens goes to the lead', () => {
    expect(stepHolders({ 'pre-1': { status: 'completed' } }, ['pre-1', 'pre-2'])).toEqual({ 'pre-1': null, 'pre-2': 'lead' });
  });

  it('a firm step sent for approval goes to the manager', () => {
    const state = { 'pre-1': { status: 'completed' }, 'pre-2': { status: 'in-progress', reviewStatus: 'reviewing' } };
    expect(stepHolderOf(state, 'pre-2')).toBe('manager');
  });

  it('a step outside the model follows its own slice', () => {
    expect(stepHolderOf({ 'zz-unknown': { status: 'completed' } }, 'zz-unknown')).toBeNull();
    expect(stepHolderOf({ 'zz-unknown': { status: 'in-progress' } }, 'zz-unknown')).toBe('lead');
  });
});
