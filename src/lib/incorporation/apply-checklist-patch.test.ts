import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/repositories/engagements', () => ({}));
vi.mock('@/lib/email/send-after-response', () => ({}));
vi.mock('@/db/repositories/expiry-items', () => ({}));
vi.mock('@/db/repositories/assist-filings', () => ({}));

const { ChecklistPatchRefused, checklistPatchForRole } = await import('./apply-checklist-patch');

const NOW = '2026-11-06T10:00:00.000Z';
const lead = { role: 'intern' as const, name: 'Divya' };
const client = { role: 'client' as const, name: 'Asha' };

describe('checklistPatchForRole', () => {
  it('keeps a lead from writing a client-only answer on a direct-flow step', () => {
    expect(() =>
      checklistPatchForRole(lead, 'pre-1', { responses: { director1FirstName: 'Asha', nicCode: '62011' } }, undefined, NOW),
    ).toThrow(ChecklistPatchRefused);
  });

  it('keeps a lead from stamping a review on a direct-flow step or the manager step', () => {
    for (const step of ['pre-15', 'pre-2']) {
      const patch = checklistPatchForRole(lead, step, { reviewStatus: 'reviewing', locked: true, responses: { stepRemarks: '1' } }, undefined, NOW);
      expect(patch.reviewStatus).toBeUndefined();
      expect(patch.locked).toBeUndefined();
    }
  });

  it('stamps who edited a direct-flow step', () => {
    // DR-04: Proposed directors assigned to the lead, so the lead's answers are kept.
    const patch = checklistPatchForRole(lead, 'pre-15', { responses: { directors: 'e1' } }, { fillAssignedTo: 'lead' } as never, NOW);
    expect(patch).toMatchObject({ lastEditedByName: 'Divya', lastEditedAt: NOW, responses: { directors: 'e1' } });
  });

  it('DR-02: refuses with 403 a lead who changes Proposed directors while the client fills it', () => {
    try {
      checklistPatchForRole(lead, 'pre-15', { responses: { directors: 'e1' } }, undefined, NOW);
      expect.unreachable('the save should be refused');
    } catch (error) {
      expect(error).toBeInstanceOf(ChecklistPatchRefused);
      expect((error as InstanceType<typeof ChecklistPatchRefused>).status).toBe(403);
    }
  });

  it('DR-02: refuses a manager and an admin on client-only fields, even after Assign to Lead', () => {
    for (const role of ['manager', 'admin', 'super_admin'] as const) {
      for (const slice of [undefined, { fillAssignedTo: 'lead' }]) {
        expect(() =>
          checklistPatchForRole({ role, name: 'M' }, 'pre-15', { responses: { 'directors.e1.name': 'X' } }, slice as never, NOW),
        ).toThrow(ChecklistPatchRefused);
      }
      expect(() =>
        checklistPatchForRole({ role, name: 'M' }, 'pre-1', { responses: { director1FirstName: 'X' } }, undefined, NOW),
      ).toThrow(ChecklistPatchRefused);
    }
  });

  it('DR-02: drops client-only keys sent with the stored value instead of refusing', () => {
    const prev = { responses: { director1FirstName: 'Asha' } } as never;
    const patch = checklistPatchForRole(lead, 'pre-1', { responses: { director1FirstName: 'Asha', nicCode: '62011' } }, prev, NOW);
    expect(patch.responses).toEqual({ nicCode: '62011' });
  });

  it('DR-02: keeps the DIN check fields writable by the lead', () => {
    const patch = checklistPatchForRole(lead, 'pre-15', { responses: { 'directors.e1.dinStatus': 'verified' } }, undefined, NOW);
    expect(patch.responses?.['directors.e1.dinStatus']).toBe('verified');
  });

  it('SA-02: refuses with 403 a client who changes the name approval expiry date; a lead may', () => {
    const prev = { responses: { nameApprovalDate: '2026-11-01', nameApprovalExpiryDate: '2026-11-21' } } as never;
    try {
      checklistPatchForRole(client, 'pre-5', { responses: { nameApprovalExpiryDate: '2026-12-31' } }, prev, NOW);
      expect.unreachable('the save should be refused');
    } catch (error) {
      expect((error as InstanceType<typeof ChecklistPatchRefused>).status).toBe(403);
    }
    const patch = checklistPatchForRole(lead, 'pre-5', { responses: { nameApprovalExpiryDate: '2026-12-31' } }, prev, NOW);
    expect(patch.responses?.nameApprovalExpiryDate).toBe('2026-12-31');
  });

  it('DR-02: lets the client change the Proposed directors', () => {
    const patch = checklistPatchForRole(client, 'pre-15', { responses: { 'directors.e1.name': 'Asha' } }, undefined, NOW);
    expect(patch.responses?.['directors.e1.name']).toBe('Asha');
  });

  it('refuses a client on a direct-flow step already submitted', () => {
    expect(() => checklistPatchForRole(client, 'pre-1', { responses: { a: '1' } }, { locked: true, clientSubmittedAt: NOW, responses: {} } as never, NOW)).toThrow(ChecklistPatchRefused);
  });

  it('strips review fields from a client patch on a reviewed step', () => {
    const patch = checklistPatchForRole(client, 'post-7', { reviewStatus: 'accepted', notes: 'n' }, undefined, NOW);
    expect(patch).toEqual({ notes: 'n' });
  });
});
