import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Engagement } from '@/data/engagements';

/**
 * The staff wrapper is the firm shells' only call site of the shared module in
 * staff mode, so this pins the contract: `audience="staff"`, the scoped roster
 * passed through untouched, and the pre-COI ids derived from `isIncorporated`.
 */

const useApp = vi.fn();
vi.mock('@/context/AppContext', () => ({ useApp: () => useApp() }));

type Echo = {
  basePath: string;
  audience?: string;
  staff?: { engagements: Engagement[]; preIncorporationIds: Set<string> };
};
function echo(testId: string) {
  return function EchoView(props: Echo) {
    return (
      <div data-testid={testId} data-base={props.basePath} data-audience={props.audience}>
        {JSON.stringify({
          roster: props.staff?.engagements.map((e) => e.id) ?? null,
          pre: props.staff ? [...props.staff.preIncorporationIds] : null,
        })}
      </div>
    );
  };
}
vi.mock('@/views/compliances/ComplianceCalendarView', () => ({
  ComplianceCalendarView: echo('calendar'),
}));
vi.mock('@/views/compliances/FilingsView', () => ({ FilingsView: echo('filings') }));

const { StaffComplianceCalendarPage, StaffFilingsPage } = await import(
  '@/views/compliances/StaffCompliancePages'
);

function engagement(patch: Partial<Engagement> & { id: string }): Engagement {
  return {
    clientId: `c-${patch.id}`,
    companyName: `${patch.id} Pvt Ltd`,
    companyType: 'foreign',
    internId: 'lead-1',
    adminId: 'admin',
    createdAt: '2026-01-05',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    incorporationDate: null,
    ...patch,
  } as Engagement;
}

function app(overrides: Record<string, unknown> = {}) {
  useApp.mockReturnValue({
    user: { id: 'u-manager', role: 'manager' },
    engagements: [engagement({ id: 'kestrel' }), engagement({ id: 'solstice', incorporationDate: '2026-06-18' })],
    engagementsSettled: true,
    getStateForEngagement: () => ({}),
    ...overrides,
  });
}

beforeEach(() => useApp.mockReset());

describe('StaffCompliancePages', () => {
  it('renders the shared calendar in staff mode with the scoped roster and pre-COI ids', () => {
    app();
    render(<StaffComplianceCalendarPage basePath="/app/manager/compliances" />);
    const el = screen.getByTestId('calendar');
    expect(el.dataset.base).toBe('/app/manager/compliances');
    expect(el.dataset.audience).toBe('staff');
    expect(JSON.parse(el.textContent ?? '{}')).toEqual({
      roster: ['kestrel', 'solstice'],
      pre: ['kestrel'],
    });
  });

  it('honours the COI-step fallback when the date is missing', () => {
    app({ getStateForEngagement: () => ({ 'pre-12': { status: 'completed' } }) });
    render(<StaffFilingsPage basePath="/app/admin/compliances" />);
    const el = screen.getByTestId('filings');
    expect(el.dataset.base).toBe('/app/admin/compliances');
    expect(JSON.parse(el.textContent ?? '{}').pre).toEqual([]);
  });

  it('shows the skeleton until the roster has settled', () => {
    app({ engagements: [], engagementsSettled: false });
    render(<StaffFilingsPage basePath="/app/intern/compliances" />);
    expect(screen.queryByTestId('filings')).toBeNull();
    expect(screen.getByLabelText('Loading filings')).toHaveAttribute('aria-busy', 'true');
  });
});
