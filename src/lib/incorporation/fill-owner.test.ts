import { describe, expect, it } from 'vitest';
import { canRoleEditField, isClientOnlyField, stripClientOnlyResponses } from './pre-inc-direct-flow';

/**
 * Owner decision 2026-11-24: the lead can fill any data. Proposed directors and Part A are no
 * longer client-only; "Assign to Lead" (DR-04) only says who is expected to fill the step.
 */
describe('Proposed directors ownership', () => {
  it('the lead and the client can both change a field by default', () => {
    expect(canRoleEditField('intern', 'pre-15', 'directors')).toBe(true);
    expect(canRoleEditField('client', 'pre-15', 'directors')).toBe(true);
    expect(isClientOnlyField('pre-15', 'directors.e1.firstName')).toBe(false);
  });

  it("the server keeps a lead's save on the client's section", () => {
    expect(stripClientOnlyResponses('pre-15', { 'directors.e1.firstName': 'Asha', stepRemarks: 'note' })).toEqual({
      'directors.e1.firstName': 'Asha',
      stepRemarks: 'note',
    });
  });

  it('after "Assign to Lead" the lead and the client can still both edit', () => {
    const slice = { fillAssignedTo: 'lead' as const };
    expect(canRoleEditField('intern', 'pre-15', 'directors', slice)).toBe(true);
    expect(canRoleEditField('client', 'pre-15', 'directors', slice)).toBe(true);
    expect(stripClientOnlyResponses('pre-15', { 'directors.e1.firstName': 'Asha' }, slice)).toEqual({ 'directors.e1.firstName': 'Asha' });
  });

  it('the lead fills the client answers of Part A as well as the NIC codes', () => {
    expect(canRoleEditField('intern', 'pre-1', 'proposedName1')).toBe(true);
    expect(canRoleEditField('intern', 'pre-1', 'businessDescription')).toBe(true);
  });
});
