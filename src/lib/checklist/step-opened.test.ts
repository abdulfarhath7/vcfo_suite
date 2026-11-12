import { describe, expect, it } from 'vitest';
import { getActiveCatalogItems } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { canSendStepOpenedEmail, shouldAnnounceStepOpened } from './step-opened';

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

describe('DR-03 the Lead\'s "Send email" on Proposed directors', () => {
  it('shows for the Lead once the step is open', () => {
    expect(canSendStepOpenedEmail('intern', 'pre-15', doneBefore('pre-15'))).toBe(true);
  });

  it('is for the Lead only', () => {
    for (const role of ['manager', 'admin', 'super_admin', 'client', null]) {
      expect(canSendStepOpenedEmail(role, 'pre-15', doneBefore('pre-15'))).toBe(false);
    }
  });

  it('stays hidden on other steps and while the step is locked', () => {
    expect(canSendStepOpenedEmail('intern', 'pre-14', doneBefore('pre-14'))).toBe(false);
    const state = doneBefore('pre-15');
    delete state['pre-14'];
    expect(canSendStepOpenedEmail('intern', 'pre-15', state)).toBe(false);
  });
});
