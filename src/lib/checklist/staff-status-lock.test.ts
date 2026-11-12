import { describe, expect, it } from 'vitest';
import { getActiveCatalogItems } from '@/data/checklist';
import { sequentialLockMessage, staffStatusLockMessage } from '@/lib/checklist/checklist-step-gate';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';

/**
 * A locked checklist step is not in progress, overdue or done for anyone: staff may prepare its
 * answers ahead, but a save that moves it forward is refused with the sequential lock message.
 */

type State = Record<string, ChecklistItemStateSlice>;
const catalog = getActiveCatalogItems();
const FIRST = catalog[0]!.id;
const LOCKED = 'post-1';

describe('staffStatusLockMessage', () => {
  it('refuses a forward status move on a locked step with the lock message', () => {
    const lock = sequentialLockMessage(LOCKED, {});
    expect(lock).toMatch(/This opens after .+ is complete/);
    for (const status of ['in-progress', 'overdue', 'completed', 'awaiting-client'] as const) {
      expect(staffStatusLockMessage(LOCKED, { status }, {})).toBe(lock);
    }
  });

  it('refuses a request for approval, an accept, or a delivery stamp on a locked step', () => {
    expect(staffStatusLockMessage(LOCKED, { reviewStatus: 'reviewing' }, {})).not.toBeNull();
    expect(staffStatusLockMessage(LOCKED, { reviewStatus: 'accepted' }, {})).not.toBeNull();
    expect(staffStatusLockMessage(LOCKED, { deliveredToClientAt: '2026-11-12T00:00:00.000Z' }, {})).not.toBeNull();
    expect(staffStatusLockMessage(LOCKED, { completedOn: '2026-11-12' }, {})).not.toBeNull();
  });

  it('lets staff save answers and notes on a locked step (preparing ahead)', () => {
    expect(staffStatusLockMessage(LOCKED, { responses: { a: '1' } } as never, {})).toBeNull();
    const state: State = { [LOCKED]: { status: 'in-progress' } };
    // The same status it already has is no move.
    expect(staffStatusLockMessage(LOCKED, { status: 'in-progress' }, state)).toBeNull();
  });

  it('allows moving back, marking not applicable, a reject and a reopen of a done step', () => {
    expect(staffStatusLockMessage(LOCKED, { status: 'not-started' }, { [LOCKED]: { status: 'overdue' } })).toBeNull();
    expect(staffStatusLockMessage(LOCKED, { status: 'not-applicable' }, {})).toBeNull();
    expect(staffStatusLockMessage(LOCKED, { reviewStatus: 'rejected' }, {})).toBeNull();
    const done: State = { [LOCKED]: { status: 'completed', reviewStatus: 'accepted' } };
    expect(staffStatusLockMessage(LOCKED, { status: 'in-progress' }, done)).toBeNull();
  });

  it('leaves an open step to work as before', () => {
    expect(sequentialLockMessage(FIRST, {})).toBeNull();
    expect(staffStatusLockMessage(FIRST, { status: 'completed' }, {})).toBeNull();
    expect(staffStatusLockMessage(FIRST, { reviewStatus: 'reviewing', status: 'in-progress' }, {})).toBeNull();
  });
});
