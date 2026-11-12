import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * BR-01: the Lead's own step page renders the board resolution document cards (where "Generate
 * draft" is), not only the client-edit block. BR-02: the signed step passes the reload callback.
 */

const cards = vi.fn();
vi.mock('@/components/incorporation/BoardResolutionDocCards', () => ({
  BoardResolutionDocCards: (p: Record<string, unknown>) => {
    cards(p);
    return <div data-testid="doc-cards" data-step={String(p.step)} />;
  },
}));
vi.mock('@/components/incorporation/BoardResolutionClientEdit', () => ({ BoardResolutionClientEdit: () => <div data-testid="client-edit" /> }));
vi.mock('@/components/incorporation/ManagerBoardResolutionReview', () => ({ ManagerBoardResolutionReview: () => null }));

const { Phase1Pre2Panel, Phase1Pre3Panel } = await import('./Phase1StepPanelRoutePanels');

const base = {
  item: { id: 'pre-2' },
  engagement: { id: 'eng-1', slug: 'acme', companyName: 'Acme' },
  responses: {},
  role: 'intern',
  isClient: false,
  deliveredToClient: false,
  incorpDraftLabelOptions: { pre6: {} },
  getStateForEngagement: () => ({}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('Phase1Pre2Panel for the Lead', () => {
  it('renders the document cards with no draft yet', () => {
    render(<Phase1Pre2Panel {...base} isIntern brStatus="none" brDoc={null} />);
    expect(screen.getByTestId('doc-cards').dataset.step).toBe('draft');
    expect(cards.mock.calls.at(-1)![0]).toMatchObject({ viewerRole: 'intern', doc: null });
    expect(screen.queryByTestId('client-edit')).toBeNull();
  });

  it('adds the client-edit block once the draft is with the client', () => {
    render(<Phase1Pre2Panel {...base} isIntern brStatus="finalized" brDoc={{ content: '', status: 'finalized' }} />);
    expect(screen.getByTestId('doc-cards')).toBeTruthy();
    expect(screen.getByTestId('client-edit')).toBeTruthy();
  });
});

describe('Phase1Pre3Panel', () => {
  it('passes the reload callback to the signed cards', () => {
    const onBrDocChange = vi.fn();
    render(<Phase1Pre3Panel {...base} isIntern brStatus="finalized" brDoc={null} onBrDocChange={onBrDocChange} />);
    expect(cards.mock.calls.at(-1)![0]).toMatchObject({ step: 'signed', onDocChange: onBrDocChange });
  });
});
