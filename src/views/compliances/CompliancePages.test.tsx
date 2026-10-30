import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Engagement } from '@/data/engagements';

/**
 * The wrapper is every shell's only call site of the shared module, so this
 * pins the contract: the scoped roster passed through untouched, the pre-COI
 * ids derived from `isIncorporated`, and the audience keyed off the role for
 * the notice wording alone.
 */

const useApp = vi.fn();
vi.mock('@/context/AppContext', () => ({ useApp: () => useApp() }));

type Echo = {
  basePath: string;
  scope: { audience: string; engagements: Engagement[]; preIncorporationIds: Set<string> };
};
function echo(testId: string) {
  return function EchoView(props: Echo) {
    return (
      <div data-testid={testId} data-base={props.basePath} data-audience={props.scope.audience}>
        {JSON.stringify({
          roster: props.scope.engagements.map((e) => e.id),
          pre: [...props.scope.preIncorporationIds],
        })}
      </div>
    );
  };
}
vi.mock('@/views/compliances/ComplianceCalendarView', () => ({
  ComplianceCalendarView: echo('calendar'),
}));
vi.mock('@/views/compliances/FilingsView', () => ({ FilingsView: echo('filings') }));
vi.mock('@/views/compliances/ObligationsView', () => ({ ObligationsView: echo('obligations') }));
vi.mock('@/views/compliances/ObligationView', () => ({ ObligationView: echo('obligation') }));
vi.mock('@/views/compliances/RegistrationsView', () => ({
  RegistrationsView: (props: Echo & { shellBase: string }) =>
    echo('registrations')({ ...props, basePath: props.shellBase }),
}));
vi.mock('@/views/compliances/RegistrationView', () => ({
  RegistrationView: (props: Echo & { shellBase: string; recordKey: string }) => (
    <div data-testid="registration" data-base={props.shellBase} data-key={props.recordKey} />
  ),
}));

vi.mock('@/components/routing/RedirectTo', () => ({
  RedirectTo: ({ href }: { href: string }) => <div data-testid="redirect" data-href={href} />,
}));

const { ComplianceCalendarPage, FilingsPage, ObligationsPage, ObligationPage, RegistrationsPage, RegistrationPage } =
  await import('@/views/compliances/CompliancePages');

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

describe('CompliancePages', () => {
  it('hands the calendar the scoped roster and the pre-COI ids', () => {
    app();
    render(<ComplianceCalendarPage basePath="/app/manager/compliances" />);
    const el = screen.getByTestId('calendar');
    expect(el.dataset.base).toBe('/app/manager/compliances');
    expect(el.dataset.audience).toBe('staff');
    expect(JSON.parse(el.textContent ?? '{}')).toEqual({
      roster: ['kestrel', 'solstice'],
      pre: ['kestrel'],
    });
  });

  it('gives a client the client wording over the same views', () => {
    app({ user: { id: 'u-client', role: 'client', clientId: 'c-kestrel' }, engagements: [engagement({ id: 'kestrel' })] });
    render(<FilingsPage basePath="/app/client/compliances" />);
    const el = screen.getByTestId('filings');
    expect(el.dataset.base).toBe('/app/client/compliances');
    expect(el.dataset.audience).toBe('client');
    expect(JSON.parse(el.textContent ?? '{}')).toEqual({ roster: ['kestrel'], pre: ['kestrel'] });
  });

  it('honours the COI-step fallback when the date is missing', () => {
    app({ getStateForEngagement: () => ({ 'pre-12': { status: 'completed' } }) });
    render(<FilingsPage basePath="/app/admin/compliances" />);
    expect(JSON.parse(screen.getByTestId('filings').textContent ?? '{}').pre).toEqual([]);
  });

  it('keeps a super admin in the portal on the firm-wide roster with staff wording', () => {
    app({ user: { id: 'u-super', role: 'super_admin', clientId: null } });
    render(<ComplianceCalendarPage basePath="/app/client/compliances" />);
    expect(screen.getByTestId('calendar').dataset.audience).toBe('staff');
  });

  it('shows the skeleton until the roster has settled', () => {
    app({ engagements: [], engagementsSettled: false });
    render(<FilingsPage basePath="/app/intern/compliances" />);
    expect(screen.queryByTestId('filings')).toBeNull();
    expect(screen.getByLabelText('Loading filings')).toHaveAttribute('aria-busy', 'true');
  });

  it('hands Obligations and an obligation record the same scoped roster', () => {
    app();
    render(<ObligationsPage basePath="/app/manager/compliances" />);
    const list = screen.getByTestId('obligations');
    expect(list.dataset.base).toBe('/app/manager/compliances');
    expect(JSON.parse(list.textContent ?? '{}')).toEqual({ roster: ['kestrel', 'solstice'], pre: ['kestrel'] });
    render(<ObligationPage basePath="/app/manager/compliances" obligationId="gst-3b" />);
    expect(screen.getByTestId('obligation').dataset.base).toBe('/app/manager/compliances');
  });

  it('roots Registrations at the shell and passes the record key through', () => {
    app();
    render(<RegistrationsPage shellBase="/app/admin" />);
    expect(screen.getByTestId('registrations').dataset.base).toBe('/app/admin');
    render(<RegistrationPage shellBase="/app/admin" recordKey="solstice~reg-4" />);
    const record = screen.getByTestId('registration');
    expect(record.dataset.base).toBe('/app/admin');
    expect(record.dataset.key).toBe('solstice~reg-4');
  });

  it('sends a lead with no incorporated company from Registrations to Today', () => {
    app({ user: { id: 'u-lead', role: 'intern' }, engagements: [engagement({ id: 'kestrel' })] });
    render(<RegistrationsPage shellBase="/app/intern" />);
    expect(screen.queryByTestId('registrations')).toBeNull();
    expect(screen.getByTestId('redirect').dataset.href).toBe('/app/intern/today');
  });

  it('R-51: shows a lead with no incorporated company an empty state on every Compliances page', () => {
    app({ user: { id: 'u-lead', role: 'intern' }, engagements: [engagement({ id: 'kestrel' })] });
    for (const page of [
      <ComplianceCalendarPage key="c" basePath="/app/intern/compliances" />,
      <FilingsPage key="f" basePath="/app/intern/compliances" />,
      <ObligationsPage key="o" basePath="/app/intern/compliances" />,
      <ObligationPage key="r" basePath="/app/intern/compliances" obligationId="gst-3b" />,
    ]) {
      const { unmount } = render(page);
      expect(screen.getByText('No incorporated clients yet')).toBeTruthy();
      expect(screen.queryByTestId('redirect')).toBeNull();
      unmount();
    }
  });
});

