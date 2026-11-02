import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '@/auth/guards';

/**
 * C-218: the client saves a draft of the answers on its own open step. The draft stays inside
 * the caller's own engagement (another company's engagement is "not found" and nothing is
 * written), keeps only text answers the client may fill, and refuses staff and closed steps.
 */

const assertEngagementAccess = vi.fn();
const patchChecklistItem = vi.fn();
let persisted: Record<string, unknown> = {};

vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/db/repositories/engagements', () => ({
  assertEngagementAccess: (...args: unknown[]) => assertEngagementAccess(...args),
  getMyEngagement: vi.fn(),
  checklistStateForViewer: (_ctx: unknown, s: unknown) => s,
  checklistStateFromRow: () => persisted,
  patchChecklistItem: (...args: unknown[]) => patchChecklistItem(...args),
}));
vi.mock('@/db/repositories/board-resolution', () => ({ getBoardResolutionByEngagementId: vi.fn() }));

const { clientSaveStepDraft } = await import('@/db/repositories/client-incorporation');

const OWN = '11111111-1111-1111-1111-111111111101';
const OTHER = '22222222-2222-2222-2222-222222222202';
const STEP = 'pre-13';
const clientCtx: AuthContext = { userId: 'user-client', email: 'client@vcfo.local', name: 'Asha', role: 'client', clientId: 'c-a' };
const leadCtx: AuthContext = { userId: 'user-lead', email: 'lead@vcfo.local', name: 'Bharath', role: 'intern', internId: 'i-1' } as AuthContext;

beforeEach(() => {
  vi.clearAllMocks();
  persisted = {};
  assertEngagementAccess.mockImplementation(async (_ctx: unknown, id: string) =>
    id === OWN ? { ok: true, dbId: OWN, row: { id: OWN } } : { ok: false, dbId: id, notFound: true },
  );
  patchChecklistItem.mockImplementation(async () => ({ [STEP]: { status: 'in-progress' } }));
});

describe('clientSaveStepDraft', () => {
  it('saves only the text answers the client may fill', async () => {
    const out = await clientSaveStepDraft(clientCtx, OWN, STEP, { equityQuantity: ' 10000 ', notAField: 'x', equityTotal: 5 });
    expect(out.saved).toEqual(['equityQuantity']);
    const [, eng, step, patch] = patchChecklistItem.mock.calls[0]!;
    expect(eng).toBe(OWN);
    expect(step).toBe(STEP);
    expect(patch.responses).toEqual({ equityQuantity: '10000' });
    expect(patch.lastEditedByName).toBe('Asha');
    expect(patch).not.toHaveProperty('locked');
    expect(patch).not.toHaveProperty('reviewStatus');
  });

  it('refuses another company’s engagement and writes nothing', async () => {
    await expect(clientSaveStepDraft(clientCtx, OTHER, STEP, { equityQuantity: '1' })).rejects.toMatchObject({ status: 404 });
    expect(patchChecklistItem).not.toHaveBeenCalled();
  });

  it('refuses staff callers', async () => {
    await expect(clientSaveStepDraft(leadCtx, OWN, STEP, { equityQuantity: '1' })).rejects.toMatchObject({ status: 403 });
    expect(assertEngagementAccess).not.toHaveBeenCalled();
  });

  it('refuses a completed step', async () => {
    persisted = { [STEP]: { status: 'completed' } };
    await expect(clientSaveStepDraft(clientCtx, OWN, STEP, { equityQuantity: '1' })).rejects.toMatchObject({ status: 409 });
    expect(patchChecklistItem).not.toHaveBeenCalled();
  });

  it('refuses a step the client does not fill', async () => {
    await expect(clientSaveStepDraft(clientCtx, OWN, 'step-1', { anything: '1' })).rejects.toMatchObject({ status: expect.any(Number) });
    expect(patchChecklistItem).not.toHaveBeenCalled();
  });
});
