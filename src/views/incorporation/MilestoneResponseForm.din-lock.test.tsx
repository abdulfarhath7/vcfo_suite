import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { getItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';

/**
 * DR-01 on the client's Proposed directors form: the DIN check is the project lead's. In the card
 * view the client reads it and cannot pick a value, as in the grid, while the director's own
 * answers stay editable. Before the fix the card view drew it as an open select, and the server
 * then dropped the client's choice without a word.
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

const engagement = {
  id: 'eng-1',
  clientId: 'client-1',
  companyName: 'Acme India Private Limited',
  ownershipType: 'independent',
} as unknown as Engagement;

const state = {
  'pre-15': {
    status: 'in-progress',
    responses: { directors: 'e1', 'directors.e1.hasDin': 'yes', 'directors.e1.firstName': 'Asha' },
  },
};

const useApp = vi.fn();
vi.mock('@/context/AppContext', () => ({ useApp: () => useApp() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/app/client/incorporation/step/pre-15',
}));
vi.mock('@/components/ask/FieldHelpButton', () => ({ FieldHelpButton: () => null }));
vi.mock('@/components/ask/WhatsThisButton', () => ({ WhatsThisButton: () => null }));
vi.mock('@/views/incorporation/milestone-form/field-review', () => ({ FieldReviewMark: () => null, FieldReviewControls: () => null }));

const { MilestoneResponseForm } = await import('@/views/incorporation/MilestoneResponseForm');

beforeEach(() => {
  useApp.mockReturnValue({
    getState: () => state,
    getStateForEngagement: () => state,
    updateItem: vi.fn().mockResolvedValue(undefined),
    submitChecklistItem: vi.fn().mockResolvedValue(undefined),
    setUnlockedFields: vi.fn().mockResolvedValue(undefined),
    user: { id: 'client-user', role: 'client', name: 'Asha', clientId: 'client-1' },
    engagements: [engagement],
  });
});

describe('Proposed directors cards on the client form', () => {
  it('shows the DIN check read-only and keeps the director fields editable', () => {
    render(
      <LazyMotion features={domAnimation}>
        <MilestoneResponseForm item={getItem('pre-15')!} clientId={engagement.clientId} engagementId={engagement.id} variant="client" open compactChrome sectionTabs />
      </LazyMotion>,
    );
    const dinStatusId = 'pre-15-directors.e1.dinStatus';
    expect(document.getElementById('pre-15-directors.e1.firstName')).not.toBeNull();
    const dinControl = document.getElementById(dinStatusId);
    expect(dinControl === null || dinControl.getAttribute('role') !== 'combobox').toBe(true);
    expect(screen.getAllByText('DIN check against MCA director master data').length).toBeGreaterThan(0);
  });
});
