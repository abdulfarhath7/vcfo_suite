/** @vitest-environment jsdom */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamTasksCard } from '@/components/staff/today/TeamTasksCard';
import { TaskStatusCard, WorkloadByLeadCard } from '@/components/staff/today/TodayCharts';
import type { TeamTaskRow } from '@/components/staff/today/today-rows';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const rows: TeamTaskRow[] = [
  {
    id: 'a:1',
    engagementId: 'e1',
    companyName: 'Acme India',
    title: 'Name approval',
    leadId: 'a',
    leadName: 'Asha Rao',
    area: 'Incorporation',
    dueAt: '2026-08-10',
    status: 'Overdue',
    withClient: false,
    href: '/app/manager/projects/acme/step/name',
  },
  {
    id: 'b:2',
    engagementId: 'e2',
    companyName: 'Beta Labs',
    title: 'GSTR-3B · Jul',
    leadId: 'b',
    leadName: 'Ravi Kumar',
    area: 'GST',
    dueAt: '2026-08-20',
    status: 'Waiting',
    withClient: true,
    href: '/app/manager/compliances/calendar',
  },
];

describe('TeamTasksCard', () => {
  it('lists every task with its lead, area and status, and switches to the board', () => {
    render(<TeamTasksCard rows={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('link', { name: 'Name approval' })).toHaveAttribute(
      'href',
      '/app/manager/projects/acme/step/name',
    );
    expect(within(table).getByText('Overdue')).toBeInTheDocument();
    expect(within(table).getByText('GST')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Board' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Waiting' })).toHaveTextContent('GSTR-3B · Jul');
  });
});

describe('Today charts', () => {
  it('draws the task status legend with counts and one workload bar per lead', () => {
    render(
      <>
        <TaskStatusCard rows={rows} />
        <WorkloadByLeadCard rows={rows} rebalanceHref="/app/manager/team" />
      </>,
    );
    expect(screen.getByRole('link', { name: 'Rebalance' })).toHaveAttribute('href', '/app/manager/team');
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
  });
});
