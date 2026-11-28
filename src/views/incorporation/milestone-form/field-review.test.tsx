import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StepFieldState, StepFieldStateWord } from '@/lib/steps/field-states';
import { FieldReviewControls } from './field-review';

/**
 * The per-field review shows its state as a chip only. Project leads read the old outlined square
 * before the label as a checkbox to tick, so no state may render a mark or anything tickable.
 */

let states: StepFieldState[] = [];

vi.mock('@/context/AppContext', () => ({ useApp: () => ({ user: { role: 'intern' } }) }));
vi.mock('@/hooks/use-step-field-states', () => ({
  stepFieldStatesKey: () => ['step-field-states'],
  useStepFieldStates: () => ({ isSuccess: true, data: states }),
}));

function row(state: StepFieldStateWord): StepFieldState {
  return {
    engagementId: 'eng-1',
    itemId: 'pre-1',
    fieldId: 'businessDescription',
    state,
    askedAt: new Date().toISOString(),
    reviewedAt: null,
    actorId: null,
    updatedAt: new Date().toISOString(),
  };
}

function renderControls() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <FieldReviewControls engagementId="eng-1" itemId="pre-1" fieldId="businessDescription" label="Business description" />
    </QueryClientProvider>,
  );
}

function expectNothingTickable(container: HTMLElement) {
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('img')).toBeNull();
  expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  expect(container.querySelector('.rounded-mark')).toBeNull();
}

describe('FieldReviewControls', () => {
  beforeEach(() => {
    states = [];
  });

  it('shows only the Ask client button and no mark when the field is not asked', () => {
    const { container } = renderControls();
    expect(screen.getByRole('button', { name: 'Ask client' })).toBeTruthy();
    expect(screen.queryByText('Not asked')).toBeNull();
    expectNothingTickable(container);
  });

  it.each([
    ['asked', 'Asked · 0d'],
    ['answered', 'Review'],
    ['approved', 'Accepted'],
    ['sent_back', 'Sent back'],
  ] as const)('shows the %s state as a chip with nothing tickable', (state, chip) => {
    states = [row(state)];
    const { container } = renderControls();
    // The chip shows its short word and keeps the full state in its title when the two differ.
    expect(screen.queryByText(chip) ?? screen.queryByTitle(chip)).toBeTruthy();
    expectNothingTickable(container);
  });
});
