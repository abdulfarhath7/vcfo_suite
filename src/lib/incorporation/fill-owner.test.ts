import { describe, expect, it } from 'vitest';
import { canRoleEditField, isClientOnlyField, stripClientOnlyResponses } from './pre-inc-direct-flow';

/** DR-02, DR-04: only the client fills Proposed directors, unless a manager or admin assigns it to the lead. */
describe('Proposed directors ownership', () => {
  it('the lead cannot change a field by default; the client can', () => {
    expect(canRoleEditField('intern', 'pre-15', 'directors')).toBe(false);
    expect(canRoleEditField('client', 'pre-15', 'directors')).toBe(true);
    expect(isClientOnlyField('pre-15', 'directors.e1.firstName')).toBe(true);
  });

  it("the server drops a lead's save on the client's section", () => {
    expect(stripClientOnlyResponses('pre-15', { 'directors.e1.firstName': 'Asha', stepRemarks: 'note' })).toEqual({ stepRemarks: 'note' });
  });

  it('after "Assign to Lead" the lead can edit and save, and the client still can', () => {
    const slice = { fillAssignedTo: 'lead' as const };
    expect(canRoleEditField('intern', 'pre-15', 'directors', slice)).toBe(true);
    expect(canRoleEditField('client', 'pre-15', 'directors', slice)).toBe(true);
    expect(stripClientOnlyResponses('pre-15', { 'directors.e1.firstName': 'Asha' }, slice)).toEqual({ 'directors.e1.firstName': 'Asha' });
  });

  it('assigning does not touch Part A, where the lead fills only the NIC codes', () => {
    expect(canRoleEditField('intern', 'pre-1', 'proposedName1', { fillAssignedTo: 'lead' })).toBe(false);
  });
});
