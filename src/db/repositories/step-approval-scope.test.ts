import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * Role and tenant scoping for three-party step approval.
 *
 * Every actor must be unable to act out of turn, and unable to act on someone
 * else's engagement. Both checks live in the repository, not the routes, so
 * they are proved here rather than through HTTP:
 *   1. only the client may client-approve or ask for a change,
 *   2. a client may only do so on a step that is actually with them,
 *   3. an engagement the caller cannot see is "not found" — the same answer a
 *      missing one gives, so the error cannot confirm it exists.
 *
 * The fourth rule — reopening writes the same shape a manager rejection writes,
 * which is what re-locks downstream steps — is pure, and lives in
 * `checklist-step-approval.test.ts`.
 */

/** Rows the next `db.select(...)` chain resolves to. */
let selectRows: unknown[] = [];
const updateCalls: unknown[] = [];

/** Chainable stub: every builder method returns a thenable resolving to rows. */
function chain(): unknown {
  const thenable = {
    from: () => chain(),
    where: () => chain(),
    limit: () => chain(),
    orderBy: () => chain(),
    set: () => chain(),
    returning: () => chain(),
    then: (resolve: (value: unknown[]) => unknown) => resolve(selectRows),
  };
  return thenable;
}

vi.mock('@/db/client', () => ({
  db: {
    select: () => chain(),
    update: (...args: unknown[]) => {
      updateCalls.push(args);
      return chain();
    },
    insert: () => chain(),
    delete: () => chain(),
  },
}));

const { buildManagerApproval, buildClientApproval } = await import(
  '@/lib/checklist-step-approval'
);
const { getActiveCatalogItems } = await import('@/data/checklist');
const { clientApproveStep, clientRequestStepChange } = await import(
  '@/db/repositories/engagements'
);

const STEP = getActiveCatalogItems()[0]!;
const OWN = '11111111-1111-1111-1111-111111111101';
const NOW = '2026-09-01T10:00:00.000Z';

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

/** One engagement row, with the step carrying `approval`. */
function engagementRow(approval: unknown) {
  return {
    id: OWN,
    companyName: 'Demo Pvt Ltd',
    internId: 'i1',
    checklistState: { [STEP.id]: { status: 'completed', approval } },
  };
}

beforeEach(() => {
  selectRows = [];
  updateCalls.length = 0;
});

describe('only the client may act', () => {
  const staffRoles = ['intern', 'manager', 'admin', 'super_admin'] as const;

  it.each(staffRoles)('refuses %s on approve, before any read', async (role) => {
    await expect(clientApproveStep(ctx(role), OWN, STEP.id)).rejects.toThrow(
      /only the client/i,
    );
    expect(updateCalls).toHaveLength(0);
  });

  it.each(staffRoles)('refuses %s on request-a-change, before any read', async (role) => {
    await expect(
      clientRequestStepChange(ctx(role), OWN, STEP.id, 'fix this'),
    ).rejects.toThrow(/only the client/i);
    expect(updateCalls).toHaveLength(0);
  });

  it('refuses an empty change note', async () => {
    await expect(clientRequestStepChange(ctx('client'), OWN, STEP.id, '   ')).rejects.toThrow(
      /needs a note/i,
    );
    expect(updateCalls).toHaveLength(0);
  });
});

describe('another firm’s engagement is not found', () => {
  it('approve writes nothing when the scoped read returns no row', async () => {
    selectRows = []; // role-scoped query matched nothing
    await expect(clientApproveStep(ctx('client'), OWN, STEP.id)).rejects.toThrow(
      /not found or not permitted/i,
    );
    expect(updateCalls).toHaveLength(0);
  });

  it('request-a-change writes nothing when the scoped read returns no row', async () => {
    selectRows = [];
    await expect(
      clientRequestStepChange(ctx('client'), OWN, STEP.id, 'fix this'),
    ).rejects.toThrow(/not found or not permitted/i);
    expect(updateCalls).toHaveLength(0);
  });
});

describe('turn taking', () => {
  it('refuses a step the manager has not handed over yet', async () => {
    selectRows = [engagementRow(undefined)];
    await expect(clientApproveStep(ctx('client'), OWN, STEP.id)).rejects.toThrow(
      'step_not_awaiting_client_approval',
    );
    expect(updateCalls).toHaveLength(0);
  });

  it('a second approval is a no-op — not an error, and no write', async () => {
    selectRows = [engagementRow(buildClientApproval({ approvedBy: 'user-client', now: NOW }))];
    const out = await clientApproveStep(ctx('client'), OWN, STEP.id);
    expect(out.phaseCompleted).toBeNull();
    expect(updateCalls).toHaveLength(0);
  });

  it('refuses a change request on a step still in the firm’s hands', async () => {
    selectRows = [engagementRow(undefined)];
    await expect(
      clientRequestStepChange(ctx('client'), OWN, STEP.id, 'fix this'),
    ).rejects.toThrow('step_not_with_client');
    expect(updateCalls).toHaveLength(0);
  });

  it('accepts an approval on a step the manager handed over', async () => {
    selectRows = [engagementRow(buildManagerApproval({ approvedBy: 'mgr-1', now: NOW }))];
    await expect(clientApproveStep(ctx('client'), OWN, STEP.id)).resolves.toBeTruthy();
    expect(updateCalls.length).toBeGreaterThan(0);
  });
});
