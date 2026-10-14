import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * The one pre-incorporation approval: the lead sends the board resolution,
 * a manager or admin approves it (or sends it back). Role and state rules live
 * in the repository, so they are proved here without HTTP.
 */

let selectRows: unknown[] = [];
const updateCalls: unknown[] = [];

function chain(): unknown {
  return {
    from: () => chain(),
    where: () => chain(),
    limit: () => chain(),
    orderBy: () => chain(),
    set: () => chain(),
    values: () => chain(),
    onConflictDoUpdate: () => chain(),
    returning: () => chain(),
    then: (resolve: (value: unknown[]) => unknown) => resolve(selectRows),
  };
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => chain(),
    update: (...args: unknown[]) => {
      updateCalls.push(args);
      return chain();
    },
    insert: (...args: unknown[]) => {
      updateCalls.push(args);
      return chain();
    },
    delete: () => chain(),
  },
}));

const {
  approveBoardResolution,
  requestBoardResolutionApproval,
  saveBoardResolutionDraft,
  BOARD_RESOLUTION_WITH_MANAGER,
} = await import('@/db/repositories/board-resolution');

const OWN = '11111111-1111-1111-1111-111111111101';

function ctx(role: AuthContext['role']): AuthContext {
  return {
    userId: `user-${role}`,
    email: `${role}@vcfo.local`,
    name: role,
    role,
    internId: role === 'intern' ? 'i1' : null,
    clientId: role === 'client' ? 'c1' : null,
  } as AuthContext;
}

function row(pre2: unknown) {
  return {
    id: OWN,
    companyName: 'Demo Pvt Ltd',
    internId: 'i1',
    managerId: 'user-manager',
    createdAt: new Date(),
    checklistState: { 'pre-2': pre2 },
  };
}

const PENDING = { status: 'in-progress', reviewStatus: 'reviewing', reviewSource: 'lead_manager_request', locked: true };

beforeEach(() => {
  selectRows = [];
  updateCalls.length = 0;
});

describe('approveBoardResolution', () => {
  it.each(['intern', 'client'] as const)('refuses a %s before any read', async (role) => {
    await expect(approveBoardResolution(ctx(role), OWN)).rejects.toThrow(/only the project manager or admin/i);
    expect(updateCalls).toHaveLength(0);
  });

  it('fails when the lead has not sent it for approval', async () => {
    selectRows = [row({ status: 'in-progress' })];
    await expect(approveBoardResolution(ctx('manager'), OWN)).rejects.toThrow('board_resolution_not_pending');
    expect(updateCalls).toHaveLength(0);
  });

  it('fails after it was sent back', async () => {
    selectRows = [row({ status: 'in-progress', reviewStatus: 'rejected', reviewSource: 'lead_manager_request' })];
    await expect(approveBoardResolution(ctx('admin'), OWN)).rejects.toThrow('board_resolution_not_pending');
  });

  it('is not found for an engagement outside the caller scope', async () => {
    selectRows = [];
    await expect(approveBoardResolution(ctx('manager'), OWN)).rejects.toThrow(/not found or not permitted/i);
  });
});

describe('requestBoardResolutionApproval', () => {
  it('is the lead’s action only', async () => {
    await expect(requestBoardResolutionApproval(ctx('manager'), OWN)).rejects.toThrow(/only the project lead/i);
    expect(updateCalls).toHaveLength(0);
  });

  it('refuses a second send while the manager decides', async () => {
    selectRows = [row(PENDING)];
    await expect(requestBoardResolutionApproval(ctx('intern'), OWN)).rejects.toThrow(BOARD_RESOLUTION_WITH_MANAGER);
    expect(updateCalls).toHaveLength(0);
  });
});

describe('lead edits while with the manager', () => {
  it('saveBoardResolutionDraft refuses the lead', async () => {
    selectRows = [row(PENDING)];
    await expect(saveBoardResolutionDraft(ctx('intern'), OWN, 'text')).rejects.toThrow(BOARD_RESOLUTION_WITH_MANAGER);
    expect(updateCalls).toHaveLength(0);
  });
});
