import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Engagement } from '@/data/engagements';

/**
 * The wrapper is the client shell's only call site, so this is where the
 * "derive preIncorporation from isIncorporated" contract is pinned down.
 * The shared views are stubbed to echo the scope they were handed.
 */

const useApp = vi.fn();
vi.mock('@/context/AppContext', () => ({ useApp: () => useApp() }));

vi.mock('@/views/compliances/ComplianceCalendarView', () => ({
  ComplianceCalendarView: (props: { basePath: string; preIncorporation?: unknown }) => (
    <div data-testid="calendar" data-base={props.basePath}>
      {JSON.stringify(props.preIncorporation ?? null)}
    </div>
  ),
}));
vi.mock('@/views/compliances/FilingsView', () => ({
  FilingsView: (props: { basePath: string; preIncorporation?: unknown }) => (
    <div data-testid="filings" data-base={props.basePath}>
      {JSON.stringify(props.preIncorporation ?? null)}
    </div>
  ),
}));

const { ClientComplianceCalendarPage, ClientFilingsPage } = await import(
  '@/views/client/ClientCompliancePages'
);

function engagement(patch: Partial<Engagement> = {}): Engagement {
  return {
    id: 'e-kestrel',
    clientId: 'c-kestrel',
    companyName: 'Kestrel Robotics India Pvt Ltd',
    companyType: 'foreign',
    internId: 'lead-1',
    adminId: 'admin',
    createdAt: '2026-01-05',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    clientUserId: 'u-client',
    incorporationDate: null,
    ...patch,
  };
}

function app(overrides: Record<string, unknown> = {}) {
  useApp.mockReturnValue({
    user: { id: 'u-client', role: 'client', clientId: 'c-kestrel' },
    engagements: [engagement()],
    engagementsSettled: true,
    getStateForEngagement: () => ({}),
    ...overrides,
  });
}

beforeEach(() => {
  useApp.mockReset();
});

describe('ClientCompliancePages', () => {
  it('hands the shared views a client pre-incorporation scope before COI', () => {
    app();
    render(<ClientComplianceCalendarPage />);
    const calendar = screen.getByTestId('calendar');
    expect(calendar.dataset.base).toBe('/app/client/compliances');
    expect(JSON.parse(calendar.textContent ?? 'null')).toEqual({
      audience: 'client',
      companyName: 'Kestrel Robotics India Pvt Ltd',
    });
  });

  it('passes no scope once the incorporation date is set', () => {
    app({ engagements: [engagement({ incorporationDate: '2026-06-18' })] });
    render(<ClientFilingsPage />);
    expect(JSON.parse(screen.getByTestId('filings').textContent ?? 'null')).toBeNull();
  });

  it('honours the COI-step fallback when the date is missing', () => {
    app({ getStateForEngagement: () => ({ 'pre-12': { status: 'completed' } }) });
    render(<ClientComplianceCalendarPage />);
    expect(JSON.parse(screen.getByTestId('calendar').textContent ?? 'null')).toBeNull();
  });

  it('shows the skeleton until the client engagement list has settled', () => {
    app({ engagements: [], engagementsSettled: false });
    render(<ClientComplianceCalendarPage />);
    expect(screen.queryByTestId('calendar')).toBeNull();
    expect(screen.getByLabelText('Loading calendar')).toHaveAttribute('aria-busy', 'true');
  });

  it('lets a super admin inspecting the portal fall through to the firm-wide view', () => {
    app({
      user: { id: 'u-super', role: 'super_admin', clientId: null },
      engagements: [engagement()],
      engagementsSettled: false,
    });
    render(<ClientFilingsPage />);
    expect(JSON.parse(screen.getByTestId('filings').textContent ?? 'null')).toBeNull();
  });
});
