import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { LabourRegistersPage } = await import('./LabourRegistersPage');

/** Open is disabled, with the reason beside it, for a company that is not incorporated yet. */
describe('LabourRegistersPage open action before the COI', () => {
  const openButton = () => screen.getByRole('button', { name: /^Open Telangana/ });

  it('disables Open with a short reason before the COI', () => {
    render(
      <LabourRegistersPage
        shellBase="/app/lead"
        stateCode="TG"
        period="2026-09"
        engagements={[{ id: 'e1', name: 'Acme', incorporated: false, incorporationDate: null }]}
      />,
    );
    expect(openButton()).toBeDisabled();
    expect(screen.getByText(/start after the Certificate of Incorporation/)).toBeInTheDocument();
  });

  it('enables Open once the company is incorporated', () => {
    render(
      <LabourRegistersPage
        shellBase="/app/lead"
        stateCode="TG"
        period="2026-09"
        engagements={[{ id: 'e1', name: 'Acme', incorporated: true, incorporationDate: '2026-06-10' }]}
      />,
    );
    expect(openButton()).toBeEnabled();
    expect(screen.queryByText(/start after the Certificate of Incorporation/)).toBeNull();
  });
});
