import { describe, expect, it } from 'vitest';
import type { FilingRow } from '@/lib/compliance/filings';
import type { PortalFiling } from '@/lib/client-portal/compliances';
import {
  dueWithinSoon,
  flowCounts,
  groupObligations,
  matchesFilter,
  waitingOnClient,
} from '@/views/compliances/obligation-groups';

const NOW = new Date('2026-10-16T09:00:00Z');

function row(patch: Partial<FilingRow> & { id: string }): FilingRow {
  return {
    engagementId: 'acme',
    companyName: 'Acme Pvt Ltd',
    compliance: 'GST',
    particular: 'GSTR-3B',
    authority: 'GST',
    frequency: 'monthly',
    dueDate: '2026-10-20',
    filedOn: null,
    periodLabel: 'Sep 2026',
    fyLabel: 'FY 2026-27',
    rawStatus: 'upcoming',
    obligationId: 'gst-3b',
    windowFrom: null,
    windowTo: null,
    ...patch,
  };
}

function detail(id: string, patch: Partial<PortalFiling> = {}): PortalFiling {
  return { id, dataReceivedOn: null, acknowledgementNo: null, ...patch } as PortalFiling;
}

describe('groupObligations', () => {
  it('bands each obligation on its earliest unfiled due date and counts that period', () => {
    const rows = [
      row({ id: 'a-sep', dueDate: '2026-10-20', filedOn: '2026-10-12' }),
      row({ id: 'b-sep', engagementId: 'birch', companyName: 'Birch LLP', dueDate: '2026-10-20' }),
      row({ id: 'a-oct', dueDate: '2026-11-20', periodLabel: 'Oct 2026' }),
      row({ id: 'a-aug', dueDate: '2026-09-20', filedOn: '2026-09-18', periodLabel: 'Aug 2026' }),
    ];
    const [group] = groupObligations(rows, new Map(), NOW);
    expect(group?.dueDate).toBe('2026-10-20');
    expect(group?.total).toBe(2);
    expect(group?.filed).toBe(1);
    expect(group?.status).toBe('due-soon');
    expect(group?.rows.map((r) => r.key)).toEqual(['a-sep', 'b-sep']);
    // Acme filed September, so its next due is October; its last filing is the latest one.
    expect(group?.rows[0]?.nextDue).toBe('2026-11-20');
    expect(group?.rows[0]?.lastFiled).toBe('2026-10-12');
    expect(group?.instances).toHaveLength(4);
  });

  it('shows the latest period when every period is filed', () => {
    const rows = [
      row({ id: 'x1', dueDate: '2026-08-20', filedOn: '2026-08-19' }),
      row({ id: 'x2', dueDate: '2026-09-20', filedOn: '2026-09-19' }),
    ];
    const [group] = groupObligations(rows, new Map(), NOW);
    expect(group?.dueDate).toBe('2026-09-20');
    expect(group?.filed).toBe(1);
    expect(group?.status).toBe('filed');
  });

  it('sorts obligations by band date and marks a late band overdue', () => {
    const rows = [
      row({ id: 'g1', dueDate: '2026-11-11', obligationId: 'gstr1', particular: 'GSTR-1' }),
      row({ id: 't1', dueDate: '2026-10-07', obligationId: 'tds', particular: 'TDS payment', compliance: 'Income Tax' }),
    ];
    const groups = groupObligations(rows, new Map(), NOW);
    expect(groups.map((g) => g.obligationId)).toEqual(['tds', 'gstr1']);
    expect(groups[0]?.status).toBe('overdue');
    expect(groups[0]?.rows[0]?.word).toBe('Overdue');
  });
});

describe('rail rules', () => {
  it('counts due in the next 15 days only for unfiled rows', () => {
    expect(dueWithinSoon(row({ id: '1', dueDate: '2026-10-31' }), NOW)).toBe(true);
    expect(dueWithinSoon(row({ id: '2', dueDate: '2026-11-01' }), NOW)).toBe(false);
    expect(dueWithinSoon(row({ id: '3', dueDate: '2026-10-20', filedOn: '2026-10-10' }), NOW)).toBe(false);
    expect(dueWithinSoon(row({ id: '4', dueDate: '2026-10-10' }), NOW)).toBe(false);
  });

  it('waits on the client only when no data is recorded and the filing is near or late', () => {
    const near = row({ id: 'n', dueDate: '2026-10-25' });
    const far = row({ id: 'f', dueDate: '2026-12-25' });
    expect(waitingOnClient(near, detail('n'), NOW)).toBe(true);
    expect(waitingOnClient(far, detail('f'), NOW)).toBe(false);
    expect(waitingOnClient(near, { ...detail('n'), dataReceivedOn: '2026-10-14' }, NOW)).toBe(false);
    // Without the side-table facts nothing is claimed.
    expect(waitingOnClient(near, undefined, NOW)).toBe(false);
  });

  it('filters client rows by the strip keys', () => {
    const [group] = groupObligations([row({ id: 'o', dueDate: '2026-10-01' })], new Map([['o', detail('o')]]), NOW);
    const r = group!.rows[0]!;
    expect(matchesFilter(r, 'overdue', NOW)).toBe(true);
    expect(matchesFilter(r, 'waiting', NOW)).toBe(true);
    expect(matchesFilter(r, 'done', NOW)).toBe(false);
    expect(matchesFilter(r, '', NOW)).toBe(true);
  });

  it('splits the progress flow by data received, filed and acknowledged', () => {
    const rows = [
      row({ id: 'd' }),
      row({ id: 'p' }),
      row({ id: 'f', filedOn: '2026-10-10' }),
      row({ id: 'k', filedOn: '2026-10-11' }),
      row({ id: 'none' }),
    ];
    const details = new Map([
      ['d', detail('d')],
      ['p', { ...detail('p'), dataReceivedOn: '2026-10-05' }],
      ['f', detail('f')],
      ['k', { ...detail('k'), acknowledgementNo: 'AA2910260012345' }],
    ]);
    expect(flowCounts(rows, details)).toEqual({ data: 1, prepared: 1, filed: 1, acknowledged: 1 });
  });
});
