import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Engagement } from '@/data/engagements';
import type { FilingRow } from '@/lib/compliance/filings';

/**
 * Render checks for the staff compliance calendar: the bar (month picker and
 * FY chip), the day popover, and the Timeline view of filing windows, which
 * writes through the existing window route only for a manager.
 */

const push = vi.fn();
let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  useSearchParams: () => search,
  usePathname: () => '/app/manager/compliances/calendar',
}));
vi.mock('@/components/SEO', () => ({ SEO: () => null }));
vi.mock('@/components/shell/PageTransition', () => ({ PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/ask/WhatsThisButton', () => ({ WhatsThisButton: () => null }));
vi.mock('@/components/admin/StatutoryCalendar', () => ({ StatutoryCalendar: () => null }));

let mayWrite = true;
vi.mock('@/views/compliances/use-register', () => ({ useMayWriteFilings: () => mayWrite }));

const setWindow = vi.fn(async (id: string, w: { from: string; to: string } | null) => ({ id, windowFrom: w?.from ?? null, windowTo: w?.to ?? null }));
vi.mock('@/lib/projects/engagements-db', () => ({ setFilingWindowInDb: (id: string, w: { from: string; to: string } | null) => setWindow(id, w) }));
const toastUndo = vi.fn();
vi.mock('@/components/ui/undo-toast', () => ({ toastUndo: (...a: unknown[]) => toastUndo(...a) }));

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

const rows = [
  row({ id: 'a', filedOn: '2099-10-11' }),
  row({ id: 'b', engagementId: 'birch', companyName: 'Birch LLP' }),
  row({ id: 'c', obligationId: 'tds', particular: 'TDS payment', compliance: 'Income Tax', authority: 'IT', dueDate: '2099-11-07' }),
];

vi.mock('@/hooks/use-filings', () => ({
  useFilings: () => ({ data: { rows, companies: [] }, isPending: false, isError: false }),
}));
vi.mock('@/components/client-portal/pages/compliances/api', () => ({
  useCompFilings: () => ({ data: { rows: [] } }),
  useReminder: () => ({ set: { mutate: vi.fn(), isPending: false }, clear: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock('@tanstack/react-query', async (orig) => ({
  ...(await orig<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({ invalidateQueries: vi.fn(async () => undefined) }),
}));

function engagement(id: string, name: string): Engagement {
  return { id, clientId: `c-${id}`, companyName: name, companyType: 'domestic', internId: 'lead-1', adminId: 'admin', createdAt: '2026-01-05', stage: 'Post-Incorporation', health: 'on-track', incorporationDate: '2026-06-01' } as Engagement;
}

const scope = {
  audience: 'staff' as const,
  engagements: [engagement('acme', 'Acme Pvt Ltd'), engagement('birch', 'Birch LLP')],
  preIncorporationIds: new Set<string>(),
};

const { ComplianceCalendarView } = await import('@/views/compliances/ComplianceCalendarView');

beforeEach(() => {
  setWindow.mockClear();
  toastUndo.mockClear();
  push.mockClear();
  mayWrite = true;
});

describe('ComplianceCalendarView bar', () => {
  it('shows the FY chip and the month picker with a month grid and Today', () => {
    search = new URLSearchParams('date=2099-10-20');
    render(<ComplianceCalendarView basePath="/app/manager/compliances" scope={scope} />);
    expect(screen.getByText('FY 2099-00')).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'Choose month' }).click());
    const picker = screen.getByRole('dialog', { name: 'Choose month and year' });
    expect(within(picker).getByRole('button', { name: 'October 2099' })).toHaveAttribute('aria-current', 'date');
    act(() => within(picker).getByRole('button', { name: 'December 2099' }).click());
    expect(screen.getByRole('button', { name: 'Choose month' })).toHaveTextContent('December');
  });

  it('opens a day popover with the filings of that day and links to the record', () => {
    search = new URLSearchParams('date=2099-10-20');
    render(<ComplianceCalendarView basePath="/app/manager/compliances" scope={scope} />);
    const pop = screen.getByRole('dialog', { name: '20 October' });
    expect(pop).toHaveTextContent('Tuesday 20 October');
    expect(pop).toHaveTextContent('2 filings');
    const link = within(pop).getAllByRole('link').find((a) => a.textContent?.includes('Birch LLP'));
    expect(link?.getAttribute('href')).toBe('/app/manager/compliances/obligations/gst-3b?company=birch');
  });

  it('groups one filing for several clients in Coming up', () => {
    search = new URLSearchParams('date=2099-10-01');
    render(<ComplianceCalendarView basePath="/app/manager/compliances" scope={scope} />);
    const coming = screen.getByRole('region', { name: 'Coming up' });
    expect(within(coming).getByText('TDS payment')).toBeInTheDocument();
    expect(within(coming).getByText('GSTR-3B')).toBeInTheDocument();
  });
});

describe('Timeline view', () => {
  function openTimeline() {
    search = new URLSearchParams('date=2099-10-01');
    render(<ComplianceCalendarView basePath="/app/manager/compliances" scope={scope} />);
    act(() => screen.getByRole('tab', { name: 'Timeline' }).click());
  }

  it('draws one lane per filing grouped by area, with zoom controls', () => {
    openTimeline();
    expect(screen.getByRole('group', { name: 'Zoom the timeline' })).toBeInTheDocument();
    expect(screen.getAllByText('GSTR-3B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Income tax').length).toBeGreaterThan(1);
    const bars = screen.getAllByRole('slider');
    expect(bars).toHaveLength(2);
    expect(bars[0]!.getAttribute('aria-label')).toContain('GSTR-3B · 20 Oct · 2 clients');
  });

  it('moves a window for a manager through the window route, unfiled clients only, with Undo', async () => {
    openTimeline();
    const bar = screen.getAllByRole('slider')[0]!;
    await act(async () => {
      fireEvent.keyDown(bar, { key: 'ArrowRight' });
    });
    expect(setWindow).toHaveBeenCalledTimes(1);
    expect(setWindow).toHaveBeenCalledWith('b', { from: '2099-10-16', to: '2099-10-21' });
    expect(toastUndo).toHaveBeenCalledWith('Window · 16 Oct to 21 Oct', expect.any(Function));
    await act(async () => {
      (toastUndo.mock.calls[0]![1] as () => void)();
    });
    expect(setWindow).toHaveBeenLastCalledWith('b', null);
  });

  it('keeps the bars read-only for a project lead', async () => {
    mayWrite = false;
    openTimeline();
    const bar = screen.getAllByRole('slider')[0]!;
    expect(bar).toHaveAttribute('aria-readonly', 'true');
    await act(async () => {
      fireEvent.keyDown(bar, { key: 'ArrowRight' });
    });
    expect(setWindow).not.toHaveBeenCalled();
    act(() => {
      fireEvent.keyDown(bar, { key: 'Enter' });
    });
    expect(push).toHaveBeenCalledWith('/app/manager/compliances/obligations/gst-3b?company=acme');
  });
});
