import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { getItem } from '@/data/checklist';
import { ClientStepFieldPreview } from '@/components/client/ClientStepFieldPreview';

const pre2 = getItem('pre-2')!;
const pre12 = getItem('pre-12')!;

describe('ClientStepFieldPreview', () => {
  it('lists what the step will capture instead of saying nothing is here', () => {
    render(<ClientStepFieldPreview item={pre12} />);

    expect(screen.getByText('Corporate Identification Number (CIN)')).toBeInTheDocument();
    expect(screen.getByText('Date of Incorporation')).toBeInTheDocument();
    // Every unfilled field reads as an em dash, not as absent.
    expect(screen.getAllByText('—').length).toBeGreaterThan(5);
  });

  it('never surfaces the firm’s internal working notes', () => {
    render(<ClientStepFieldPreview item={pre2} />);

    expect(screen.queryByText(/Draft\/review notes/i)).toBeNull();
    // The rest of the step is still previewed.
    expect(screen.getByText('Draft generated on')).toBeInTheDocument();
  });

  it('withholds firm values until the step is delivered to the client', () => {
    const responses = { cin: 'U74999KA2026PTC123456' };

    const { rerender } = render(
      <ClientStepFieldPreview item={pre12} responses={responses} />,
    );
    expect(screen.queryByText('U74999KA2026PTC123456')).toBeNull();

    rerender(
      <ClientStepFieldPreview
        item={pre12}
        responses={responses}
        itemState={{ status: 'completed', deliveredToClientAt: '2026-04-02T10:00:00.000Z' }}
      />,
    );
    expect(screen.getByText('U74999KA2026PTC123456')).toBeInTheDocument();
  });

  it('names firm-held documents but never links them', () => {
    const { container } = render(
      <ClientStepFieldPreview
        item={pre12}
        responses={{ certificateOfIncorporationFinalUrl: 'eng/coi/1-coi.pdf' }}
        itemState={{ status: 'completed', deliveredToClientAt: '2026-04-02T10:00:00.000Z' }}
      />,
    );

    expect(screen.getByText('Certificate of Incorporation')).toBeInTheDocument();
    // A released document is offered through the documents surface, not here —
    // this preview must never become a way to reach an unreleased file.
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByText('eng/coi/1-coi.pdf')).toBeNull();
  });

  it('shows the client’s own field even before the firm has started', () => {
    render(<ClientStepFieldPreview item={pre2} responses={{ stepRemarks: 'Please hurry' }} />);
    expect(screen.getByText('Please hurry')).toBeInTheDocument();
  });
});
