import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PreIncorporationNotice,
  PreIncorporationPortfolioNote,
} from '@/components/compliances/PreIncorporationNotice';

describe('PreIncorporationNotice', () => {
  it('prints the reassuring client copy as a polite status, never a lock-out', () => {
    render(<PreIncorporationNotice scope={{ audience: 'client', companyName: 'Acme' }} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Compliance begins after incorporation');
    expect(status).toHaveTextContent(
      'Your compliance calendar and filings begin once your company is incorporated. Nothing’s due yet — this fills in automatically after your Certificate of Incorporation is issued.',
    );
    expect(status.textContent).not.toMatch(/denied|no access|locked/i);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('names the company for staff', () => {
    render(
      <PreIncorporationNotice
        scope={{ audience: 'staff', companyName: 'Kestrel Robotics India Pvt Ltd' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Kestrel Robotics India Pvt Ltd isn’t incorporated yet. Its compliance calendar and filings generate automatically once the Certificate of Incorporation is recorded.',
    );
  });

  it('falls back to "This company" when staff copy has no name', () => {
    render(<PreIncorporationNotice scope={{ audience: 'staff', companyName: '  ' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('This company isn’t incorporated yet.');
  });

  it('is a tinted callout, not a page fill', () => {
    render(<PreIncorporationNotice scope={{ audience: 'client' }} />);
    const status = screen.getByRole('status');
    expect(status.className).toContain('bg-info-light');
    expect(status.className).toContain('border-l-info');
  });
});

describe('PreIncorporationPortfolioNote', () => {
  it('renders nothing for zero', () => {
    const { container } = render(<PreIncorporationPortfolioNote count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts honestly, singular and plural', () => {
    const { rerender } = render(<PreIncorporationPortfolioNote count={1} />);
    expect(screen.getByText('1 engagement begins compliance after incorporation.')).toBeInTheDocument();
    rerender(<PreIncorporationPortfolioNote count={3} />);
    expect(screen.getByText('3 engagements begin compliance after incorporation.')).toBeInTheDocument();
  });
});
