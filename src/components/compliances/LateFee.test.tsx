import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LateFeeAmount } from './LateFee';

const NOW = new Date('2026-11-13T04:30:00Z');

describe('LateFeeAmount', () => {
  it('shows the amount so far, marked as an estimate, with the working on hover', () => {
    render(<LateFeeAmount filing={{ particular: 'GSTR-3B Filing', dueDate: '2026-10-20', filedOn: null }} now={NOW} />);
    const cell = screen.getByText('₹1,200', { exact: false });
    expect(cell.textContent).toContain('est.');
    expect(cell.getAttribute('title')).toContain('24 days late so far');
    expect(cell.getAttribute('title')).toContain('CGST Act, 2017, section 47');
  });

  it('shows a dash when the filing was on time', () => {
    render(<LateFeeAmount filing={{ obligationId: 'gst-gstr-1', dueDate: '2026-10-11', filedOn: '2026-10-11' }} now={NOW} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('shows a dash when the obligation has no fee rule', () => {
    render(<LateFeeAmount filing={{ obligationId: 'fema-fla', dueDate: '2026-07-15', filedOn: null }} now={NOW} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
