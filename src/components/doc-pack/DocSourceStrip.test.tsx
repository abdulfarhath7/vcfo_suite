import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DocSourceStrip } from '@/components/doc-pack/DocSourceStrip';
import { evaluateDocPack } from '@/lib/doc-pack/evaluate';
import { FINALIZED_BR, director, fullState } from '@/lib/doc-pack/__tests__/fixtures';

describe('DocSourceStrip', () => {
  const summary = evaluateDocPack({
    state: fullState([director('e1', 'no', 'Alpha'), director('e2', 'yes', 'Beta', { panNumber: '' })]),
    brRow: FINALIZED_BR,
  });

  it('names how many documents read the step and links to the pack', () => {
    render(<DocSourceStrip summary={summary} stepId="pre-15" packHref="/pack" />);
    expect(screen.getByText(/documents use/)).toBeInTheDocument();
    expect(screen.getByText(/3 need inputs/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in document pack' })).toHaveAttribute('href', '/pack');
  });

  it('renders nothing on a step no document reads', () => {
    const { container } = render(<DocSourceStrip summary={summary} stepId="pre-9" packHref="/pack" />);
    expect(container).toBeEmptyDOMElement();
  });
});
