import { describe, expect, it } from 'vitest';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { checkResponseRow, rowCanApply } from './rules';

/**
 * The card's gate rule (PLAN K): a step that is only not open yet takes a draft save of a card
 * value; a finished step and a field another role owns are still held.
 */

const engagement = { ownershipType: 'independent' };
const done = { status: 'completed', reviewStatus: 'accepted', locked: true } as unknown as ChecklistItemStateSlice;
const gate = (checks: ReturnType<typeof checkResponseRow>['checks']) => checks.find((check) => check.rule === 'gate')!;

describe('checkResponseRow gate', () => {
  it('lets a step that is not open yet take the value as a draft', () => {
    // Nothing is submitted, so Name Application (pre-4) opens only after Client Details.
    const result = checkResponseRow({ role: 'intern', target: { engagementId: 'e', stepId: 'pre-4', fieldId: 'acknowledgementNumber' }, value: 'AB1234567', state: {}, engagement });
    expect(gate(result.checks)).toMatchObject({ ok: true, message: expect.stringMatching(/^Saved as a draft: "Name Application" opens after/) });
    expect(result.heldReason).toBeNull();
    expect(rowCanApply(result.checks)).toBe(true);
  });

  it('still holds a finished step', () => {
    const state = { 'pre-1': done, 'pre-2': done, 'pre-3': done, 'pre-4': done };
    const result = checkResponseRow({ role: 'intern', target: { engagementId: 'e', stepId: 'pre-4', fieldId: 'acknowledgementNumber' }, value: 'AB1234567', state, engagement });
    expect(result.heldReason).toMatch(/is finished/);
    expect(rowCanApply(result.checks)).toBe(false);
  });

  it("still holds a field another role owns, on a step not open yet", () => {
    // Capital Structure answers are the client's; a manager may not write them (DR-02/DR-04).
    const result = checkResponseRow({ role: 'manager', target: { engagementId: 'e', stepId: 'pre-13', fieldId: 'equityShares' }, value: 'Yes', state: {}, engagement });
    expect(gate(result.checks).ok).toBe(true);
    expect(result.checks.find((check) => check.rule === 'owner')).toMatchObject({ ok: false });
    expect(result.heldReason).toMatch(/fills this field/);
  });
});
