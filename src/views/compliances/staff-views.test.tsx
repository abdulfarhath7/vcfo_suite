import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import type { Engagement } from '@/data/engagements';
import type { FilingRow } from '@/lib/compliance/filings';

/**
 * Render checks for the new staff screens: the obligations list bands real
 * register rows by filing, and the registrations list reads the roster's step
 * state. Data hooks are stubbed; the views and their pure logic are real.
 */

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => search,
  usePathname: () => '/app/manager/compliances/obligations',
}));
vi.mock('@/components/SEO', () => ({ SEO: () => null }));
vi.mock('@/components/shell/PageTransition', () => ({ PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/ask/WhatsThisButton', () => ({ WhatsThisButton: () => null }));

const appState = {
  user: { id: 'u-manager', role: 'manager' },
  getStateForEngagement: (e: Engagement) =>
    e.id === 'acme' ? { 'reg-4': { status: 'completed', completedOn: '2026-10-10' }, 'reg-1': { status: 'awaiting-client' } } : {},
  internOptions: [],
  teamMembers: [],
  refreshEngagementChecklist: vi.fn(),
};
vi.mock('@/context/AppContext', () => ({ useApp: () => appState }));

function row(patch: Partial<FilingRow> & { id: string }): FilingRow {
  return {
    engagementId: 'acme',
    companyName: 'Acme Pvt Ltd',
    compliance: 'GST',
    particular: 'GSTR-3B',
    authority: 'GST',
    frequency: 'monthly',
    dueDate: '2099-10-20',
    filedOn: null,
    periodLabel: 'Sep 2099',
    fyLabel: 'FY 2099-00',
    rawStatus: 'upcoming',
    obligationId: 'gst-3b',
    windowFrom: null,
    windowTo: null,
    ...patch,
  };
}

const register = {
  rows: [
    row({ id: 'a', filedOn: '2099-10-11' }),
    row({ id: 'b', engagementId: 'birch', companyName: 'Birch LLP' }),
    row({ id: 'c', obligationId: 'tds', particular: 'TDS payment', compliance: 'Income Tax', dueDate: '2099-11-07' }),
  ],
  details: new Map(),
  fyStartYear: 2099,
  isPending: false,
  isError: false,
};
vi.mock('@/views/compliances/use-register', () => ({
  useRegister: () => register,
  useMayWriteFilings: () => false,
}));

vi.mock('@/hooks/use-filings', () => ({
  useFilings: () => ({ data: { rows: register.rows, companies: [] }, isPending: false, isError: false }),
}));
vi.mock('@/components/client-portal/pages/compliances/api', () => ({
  useCompFilings: () => ({ data: { rows: [] } }),
  useReminder: () => ({ set: { mutate: vi.fn(), isPending: false }, clear: { mutate: vi.fn(), isPending: false } }),
}));
// The slim registration facts read (G-05, G-06): a number typed on the workbook and an
// expiry 10 days out for Acme's GST registration.
const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
vi.mock('@/hooks/use-registration-facts', () => ({
  useRegistrationFacts: () => ({
    data: {
      acme: {
        'reg-4': {
          stepId: 'reg-4',
          rowKey: 'gst',
          number: '29ABCDE1234F1Z5',
          registeredOn: null,
          certificate: null,
          issuedOn: null,
          expiresOn: soon,
          renewEveryMonths: null,
        },
      },
    },
  }),
  useSetRegistrationDates: () => ({ mutateAsync: vi.fn(), isPending: false }),
  openRegistrationCertificate: vi.fn(),
}));
vi.mock('@tanstack/react-query', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

function engagement(id: string, name: string): Engagement {
  return {
    id,
    clientId: `c-${id}`,
    companyName: name,
    companyType: 'domestic',
    internId: 'lead-1',
    adminId: 'admin',
    createdAt: '2026-01-05',
    stage: 'Post-Incorporation',
    health: 'on-track',
    incorporationDate: '2026-06-01',
  } as Engagement;
}

const scope = {
  audience: 'staff' as const,
  engagements: [engagement('acme', 'Acme Pvt Ltd'), engagement('birch', 'Birch LLP')],
  preIncorporationIds: new Set<string>(),
};

const { ObligationsView } = await import('@/views/compliances/ObligationsView');
const { RegistrationsView } = await import('@/views/compliances/RegistrationsView');
const { FilingsView } = await import('@/views/compliances/FilingsView');
const { ComplianceCalendarView } = await import('@/views/compliances/ComplianceCalendarView');

describe('ObligationsView', () => {
  it('bands each obligation with its filed count and lists the clients under it', () => {
    search = new URLSearchParams();
    render(<ObligationsView basePath="/app/manager/compliances" scope={scope} />);
    const grid = screen.getByRole('region', { name: 'Obligations' });
    expect(within(grid).getByText('1 of 2 filed')).toBeInTheDocument();
    expect(within(grid).getByText('TDS payment')).toBeInTheDocument();
    expect(within(grid).getByText('Birch LLP')).toBeInTheDocument();
    const link = within(grid).getAllByRole('link').find((a) => a.textContent?.includes('Birch LLP'));
    expect(link?.getAttribute('href')).toBe('/app/manager/compliances/obligations/gst-3b?company=birch');
  });

  it('filters the list from the number strip', () => {
    search = new URLSearchParams('state=done');
    render(<ObligationsView basePath="/app/manager/compliances" scope={scope} />);
    const grid = screen.getAllByRole('region', { name: 'Obligations' }).at(-1)!;
    expect(within(grid).queryByText('Birch LLP')).toBeNull();
    expect(within(grid).getByText('Acme Pvt Ltd')).toBeInTheDocument();
  });
});

describe('RegistrationsView', () => {
  it('lists registration steps per client with the six words', () => {
    search = new URLSearchParams('company=acme');
    render(<RegistrationsView shellBase="/app/manager" scope={scope} />);
    const grid = screen.getByRole('region', { name: 'Registrations' });
    const gst = within(grid).getAllByRole('link').find((a) => a.textContent?.includes('GST Registration'));
    expect(gst?.getAttribute('href')).toBe(`/app/manager/registrations/${encodeURIComponent('acme~reg-4')}`);
    expect(within(grid).getAllByText('Done').length).toBeGreaterThan(0);
    expect(within(grid).getAllByText('Waiting').length).toBeGreaterThan(0);
  });

  it('shows the stored number and the renewal from the slim facts read', () => {
    search = new URLSearchParams('company=acme');
    render(<RegistrationsView shellBase="/app/manager" scope={scope} />);
    const grid = screen.getByRole('region', { name: 'Registrations' });
    expect(within(grid).getByText('29ABCDE1234F1Z5')).toBeInTheDocument();
    expect(within(grid).getByText('Due soon')).toBeInTheDocument();
    const renewals = screen.getByRole('heading', { name: 'Renewals and expiry' }).closest('section')!;
    expect(within(renewals).getByText('GST Registration')).toBeInTheDocument();
  });

  it('keeps filter state in memory when embedded in the client record', () => {
    search = new URLSearchParams();
    replace.mockClear();
    render(<RegistrationsView shellBase="/app/manager" scope={{ ...scope, engagements: [scope.engagements[0]!] }} embedded />);
    act(() => screen.getByRole('tab', { name: 'Grid' }).click());
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Grid' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('FilingsView and ComplianceCalendarView', () => {
  it('draws the register month in a T1 grid with the six words', () => {
    search = new URLSearchParams('period=2099-10&fy=2099');
    render(<FilingsView basePath="/app/manager/compliances" scope={scope} />);
    const grid = screen.getByRole('region', { name: 'Filings · Oct 2099' });
    expect(within(grid).getAllByText('GSTR-3B').length).toBe(2);
    expect(within(grid).getByText('Done')).toBeInTheDocument();
    expect(within(grid).getByText('Not started')).toBeInTheDocument();
    expect(within(grid).getByRole('button', { name: /Export/ })).toBeEnabled();
  });

  it('plots the month with day tags and the coming-up rail', () => {
    search = new URLSearchParams('date=2099-10-20');
    render(<ComplianceCalendarView basePath="/app/manager/compliances" scope={scope} />);
    expect(screen.getByRole('button', { name: '20 October, 1 filing' })).toBeInTheDocument();
    const coming = screen.getByRole('region', { name: 'Coming up' });
    expect(within(coming).getByText('TDS payment')).toBeInTheDocument();
  });
});
