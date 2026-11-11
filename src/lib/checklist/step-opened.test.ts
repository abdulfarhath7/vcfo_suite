import { describe, expect, it } from 'vitest';
import { getActiveCatalogItems } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { shouldAnnounceStepOpened } from './step-opened';

/** Every active step before `itemId` completed. */
function doneBefore(itemId: string): Record<string, ChecklistItemStateSlice> {
  const state: Record<string, ChecklistItemStateSlice> = {};
  for (const item of getActiveCatalogItems()) {
    if (item.id === itemId) break;
    state[item.id] = { status: 'completed' } as ChecklistItemStateSlice;
  }
  return state;
}

describe('DR-03 announce Proposed directors once when it opens', () => {
  it('announces when the step before it is complete', () => {
    expect(shouldAnnounceStepOpened('pre-15', doneBefore('pre-15'))).toBe(true);
  });

  it('stays quiet while the step is still locked', () => {
    const state = doneBefore('pre-15');
    delete state['pre-14'];
    expect(shouldAnnounceStepOpened('pre-15', state)).toBe(false);
  });

  it('announces only once', () => {
    const state = { ...doneBefore('pre-15'), 'pre-15': { openedNotifiedAt: '2026-11-11T10:00:00Z' } as ChecklistItemStateSlice };
    expect(shouldAnnounceStepOpened('pre-15', state)).toBe(false);
  });

  it('stays quiet for a finished step and for other steps', () => {
    const state = { ...doneBefore('pre-15'), 'pre-15': { status: 'completed' } as ChecklistItemStateSlice };
    expect(shouldAnnounceStepOpened('pre-15', state)).toBe(false);
    expect(shouldAnnounceStepOpened('pre-16', doneBefore('pre-16'))).toBe(false);
  });
});
