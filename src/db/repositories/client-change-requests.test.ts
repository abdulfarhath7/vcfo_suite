import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * A change request is the client's ONLY write against the engagement's work
 * surface, so it has to be tight:
 *   1. it refuses an engagement the caller cannot see, before writing anything,
 *   2. it writes against the id `assertEngagementAccess` approved — never the
 *      raw id the caller sent,
 *   3. the assignee comes from the engagement's own lead, so a caller cannot
 *      choose who to put work on,
 *   4. it never touches `checklist_state`.
 */

const assertEngagementAccess = vi.fn();
const recordAuditEvent = vi.fn();
const dbInsert = vi.fn();
const dbSelect = vi.fn();
let insertedValues: Record<string, unknown> | null = null;

vi.mock('@/db/client', () => ({
  db: {
    insert: (...args: unknown[]) => dbInsert(...args),
    select: (...args: unknown[]) => dbSelect(...args),
  },
}));

vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...args: unknown[]) => assertEngagementAccess(...args),
}));

vi.mock('@/db/repositories/audit-events', () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { createClientChangeRequest } = await import('@/db/repositories/client-change-requests');
const { getActiveCatalogItems } = await import('@/data/checklist');

const OWN_ENGAGEMENT = '11111111-1111-1111-1111-111111111101';
const OTHER_ENGAGEMENT = '22222222-2222-2222-2222-222222222202';
const STEP = getActiveCatalogItems()[0]!;

const clientCtx: AuthContext = {
  userId: 'user-client',
  email: 'client@vcfo.local',
  name: 'Client',
  role: 'client',
  clientId: 'c-a',
};

beforeEach(() => {
  vi.clearAllMocks();
  insertedValues = null;

  dbInsert.mockImplementation(() => ({
    values: (values: Record<string, unknown>) => {
      insertedValues = values;
      return {
        returning: () =>
          Promise.resolve([
            { id: 'task-1', createdAt: new Date('2026-03-01T00:00:00.000Z') },
          ]),
      };
    },
  }));

  dbSelect.mockImplementation(() => {
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.resolve([{ id: 'user-lead' }]),
    };
    return chain;
  });
});

describe('createClientChangeRequest', () => {
  it('refuses an engagement the client cannot see, writing nothing', async () => {
    assertEngagementAccess.mockResolvedValue({ ok: false, dbId: OTHER_ENGAGEMENT, forbidden: true });

    await expect(
      createClientChangeRequest(clientCtx, {
        engagementId: OTHER_ENGAGEMENT,
        stepId: STEP.id,
        note: 'Please fix the registered address.',
      }),
    ).resolves.toBeNull();

    expect(dbInsert).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('writes the task against the approved id and the engagement’s own lead', async () => {
    assertEngagementAccess.mockResolvedValue({
      ok: true,
      dbId: OWN_ENGAGEMENT,
      row: { internId: 'i1' },
    });

    const created = await createClientChangeRequest(clientCtx, {
      // Legacy app id in, approved uuid out.
      engagementId: 'e1',
      stepId: STEP.id,
      note: 'Please fix the registered address.',
    });

    expect(created?.stepId).toBe(STEP.id);
    expect(insertedValues).toMatchObject({
      engagementId: OWN_ENGAGEMENT,
      assignedTo: 'user-lead',
      stepId: STEP.id,
      status: 'open',
      description: 'Please fix the registered address.',
    });
    // The one thing it must never write.
    expect(insertedValues).not.toHaveProperty('checklistState');
    expect(recordAuditEvent).toHaveBeenCalledWith(
      clientCtx,
      expect.objectContaining({ action: 'client.change_request', engagementId: OWN_ENGAGEMENT }),
    );
  });

  it('leaves the task unassigned when the engagement has no lead', async () => {
    assertEngagementAccess.mockResolvedValue({
      ok: true,
      dbId: OWN_ENGAGEMENT,
      row: { internId: null },
    });

    await createClientChangeRequest(clientCtx, {
      engagementId: OWN_ENGAGEMENT,
      stepId: STEP.id,
      note: 'Please fix the registered address.',
    });

    expect(insertedValues).toMatchObject({ assignedTo: null });
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it('rejects an empty note and an unknown step before touching the database', async () => {
    assertEngagementAccess.mockResolvedValue({
      ok: true,
      dbId: OWN_ENGAGEMENT,
      row: { internId: 'i1' },
    });

    await expect(
      createClientChangeRequest(clientCtx, {
        engagementId: OWN_ENGAGEMENT,
        stepId: STEP.id,
        note: '   ',
      }),
    ).rejects.toThrow(/note/i);

    await expect(
      createClientChangeRequest(clientCtx, {
        engagementId: OWN_ENGAGEMENT,
        stepId: 'not-a-step',
        note: 'Please fix it.',
      }),
    ).rejects.toThrow(/step/i);

    expect(dbInsert).not.toHaveBeenCalled();
  });
});
