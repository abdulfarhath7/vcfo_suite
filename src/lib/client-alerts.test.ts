import { describe, expect, it } from 'vitest';

import { alertDueLabel, alertsWithin, buildClientAlerts } from '@/lib/client-alerts';
import type { ClientOverviewComplianceItem, ClientOverviewNeed } from '@/lib/client-overview';

const NOW = new Date(2026, 8, 12);

const needs: ClientOverviewNeed[] = [
  { stepId: 'pre-1', title: 'Client Details', action: 'fill', href: '/app/client/incorporation?step=pre-1', dueDate: '2026-09-19' },
  { stepId: 'pre-2', title: 'Undated step', action: 'upload', href: '/app/client/incorporation?step=pre-2' },
  { stepId: 'pre-3', title: 'Board resolution', action: 'sign', href: '/app/client/incorporation?step=pre-3', dueDate: '2026-09-10' },
];

const filings: ClientOverviewComplianceItem[] = [
  { id: 'f1', title: 'GSTR-3B', authority: 'GST', group: 'GST', dueDate: '2026-09-20', status: 'upcoming', periodLabel: 'Aug 2026' },
  { id: 'f2', title: 'Form ADT-1', authority: 'MCA', group: 'MCA', dueDate: '2026-10-08', status: 'upcoming' },
  { id: 'f3', title: 'Far away', authority: 'MCA', group: 'MCA', dueDate: '2026-12-31', status: 'upcoming' },
  { id: 'f4', title: 'TDS Payment', authority: 'IT', group: 'Income tax', dueDate: '2026-09-07', status: 'filed' },
];

describe('buildClientAlerts', () => {
  it('merges dated steps and unfiled filings, overdue first, inside 30 days', () => {
    const alerts = buildClientAlerts(needs, filings, NOW);

    expect(alerts.map((alert) => [alert.title, alert.daysLeft])).toEqual([
      ['Board resolution', -2],
      ['Client Details', 7],
      ['GSTR-3B', 8],
      ['Form ADT-1', 26],
    ]);
    expect(alerts[2]).toMatchObject({
      kind: 'filing',
      meta: 'GST · Aug 2026',
      href: '/app/client/compliances/calendar?date=2026-09-20',
    });
    expect(alerts[0]).toMatchObject({ kind: 'step', meta: 'Your step', href: '/app/client/incorporation?step=pre-3' });
  });

  it('keeps overdue items in every window', () => {
    const alerts = buildClientAlerts(needs, filings, NOW);
    expect(alertsWithin(alerts, 15).map((alert) => alert.title)).toEqual([
      'Board resolution',
      'Client Details',
      'GSTR-3B',
    ]);
    expect(alertsWithin(alerts, 30)).toHaveLength(4);
  });
});

describe('alertDueLabel', () => {
  it('reads as a deadline, not a number', () => {
    expect(alertDueLabel(-3)).toBe('Overdue 3d');
    expect(alertDueLabel(0)).toBe('Due today');
    expect(alertDueLabel(1)).toBe('Tomorrow');
    expect(alertDueLabel(9)).toBe('In 9 days');
  });
});
