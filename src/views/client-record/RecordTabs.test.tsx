import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Engagement } from '@/data/engagements';

/** The client record's tab row has a Calendar tab after Obligations, and it opens that client's calendar. */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('tab=calendar'),
  usePathname: () => '/app/admin/projects/bonterra',
}));
vi.mock('@/context/AppContext', () => ({ useApp: () => ({ getStateForEngagement: () => ({}) }) }));
vi.mock('@/components/notes/use-engagement-notes', () => ({ useEngagementNotes: () => ({ data: [] }) }));
vi.mock('@/components/notes/EngagementNotesPanel', () => ({ EngagementNotesPanel: () => null }));
vi.mock('@/views/client-record/RecordDocuments', () => ({ useRecordDocuments: () => ({ data: [] }), RecordDocumentsPanel: () => null }));
vi.mock('@/views/compliances/use-register', () => ({ useRegister: () => ({ rows: [] }) }));
vi.mock('@/views/compliances/registration-rows', () => ({ registrationRows: () => [] }));
vi.mock('@/views/compliances/RegistrationsView', () => ({ RegistrationsView: () => null }));
vi.mock('@/views/compliances/ObligationsView', () => ({ ObligationsView: () => null }));
vi.mock('@/views/board-meetings/DirectorsPanel', () => ({ DirectorsPanel: () => null }));
vi.mock('@/components/client-portal/pages/team', () => ({ StaffClientTeam: () => null }));
vi.mock('@/components/client-portal/pages/compliances', () => ({ StaffClientFilings: () => null }));
const calendarProps = vi.fn();
vi.mock('@/views/compliances/ComplianceCalendarView', () => ({
  ComplianceCalendarView: (props: unknown) => {
    calendarProps(props);
    return <div data-testid="calendar" />;
  },
}));
vi.mock('@/views/compliances/compliance-scope', () => ({
  preIncorporationIdsOf: (engagements: Engagement[]) => new Set(engagements.map((e) => e.id)),
}));

const { RecordTabBar, RecordTabPanel, useRecordTab } = await import('./RecordTabs');

const bonterra = { id: 'bonterra', companyName: 'Bonterra Private Limited' } as Engagement;

describe('RecordTabs Calendar', () => {
  it('lists Calendar right after Obligations, and ?tab=calendar opens it', () => {
    function Bar() {
      const [tab, setTab] = useRecordTab();
      return <RecordTabBar engagement={bonterra} value={tab} onChange={setTab} />;
    }
    render(<Bar />);
    const labels = screen.getAllByRole('tab').map((tab) => tab.textContent?.replace(/\d+/g, '').trim());
    expect(labels.indexOf('Calendar')).toBe(labels.indexOf('Obligations') + 1);
    expect(screen.getByRole('tab', { name: /Calendar/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders the compliance calendar scoped to this one client, embedded', () => {
    render(<RecordTabPanel tab="calendar" engagement={bonterra} shellBase="/app/admin" />);
    expect(screen.getByTestId('calendar')).toBeInTheDocument();
    const props = calendarProps.mock.calls.at(-1)![0] as { basePath: string; embedded: boolean; scope: { engagements: Engagement[]; preIncorporationIds: Set<string> } };
    expect(props.basePath).toBe('/app/admin/compliances');
    expect(props.embedded).toBe(true);
    expect(props.scope.engagements.map((e) => e.id)).toEqual(['bonterra']);
    // Not incorporated yet: the calendar shows its "Compliance begins after incorporation" notice.
    expect(props.scope.preIncorporationIds.has('bonterra')).toBe(true);
  });
});
