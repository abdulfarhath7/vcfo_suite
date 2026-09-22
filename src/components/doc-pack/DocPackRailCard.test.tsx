import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DocPackRailCard } from '@/components/doc-pack/DocPackRailCard';
import { evaluateDocPack } from '@/lib/doc-pack/evaluate';
import { FINALIZED_BR, director, fullState } from '@/lib/doc-pack/__tests__/fixtures';

const hrefForMissing = (input: { stepId: string; tabId?: string }) =>
  `/step/${input.stepId}${input.tabId ? `?tab=${input.tabId}` : ''}`;

describe('DocPackRailCard', () => {
  it('shows counts, the pack link and the fastest unblock for this step', () => {
    const state = fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta', { panNumber: '' })]);
    const summary = evaluateDocPack({ state, brRow: FINALIZED_BR });
    render(
      <DocPackRailCard
        summary={summary}
        loading={false}
        error={false}
        packHref="/pack"
        currentStepId="pre-15"
        hrefForMissing={hrefForMissing}
      />,
    );
    expect(screen.getByText(`${summary.counts.ready} of ${summary.total} ready`)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open document pack' })).toHaveAttribute('href', '/pack');
    const unblock = screen.getByRole('link', { name: 'Director 2 · PAN' });
    expect(unblock).toHaveAttribute('href', '/step/pre-15?tab=directors');
    expect(screen.getByText(/in this step/)).toBeInTheDocument();
    expect(screen.getByText(/releases 3 documents/)).toBeInTheDocument();
  });

  it('keeps the link while readiness loads or fails', () => {
    const { rerender } = render(
      <DocPackRailCard summary={undefined} loading error={false} packHref="/pack" currentStepId="pre-1" hrefForMissing={hrefForMissing} />,
    );
    expect(screen.getByText('Checking readiness…')).toBeInTheDocument();
    rerender(
      <DocPackRailCard summary={undefined} loading={false} error packHref="/pack" currentStepId="pre-1" hrefForMissing={hrefForMissing} />,
    );
    expect(screen.getByText('Readiness could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open document pack' })).toBeInTheDocument();
  });
});
