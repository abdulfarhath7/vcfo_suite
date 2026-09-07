import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import type { FilingRow } from '@/lib/filings';
import {
  ALL_COMPANIES,
  isFilingStatusFilter,
  normaliseCompanyParam,
  pickedCompany,
  preIncorporationIdsOf,
  rowsForCompany,
  rowsForStatus,
  soleCompany,
} from '@/views/compliances/compliance-scope';

const NOW = new Date('2026-09-01T00:00:00Z');

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

function row(patch: Partial<FilingRow> & { id: string; dueDate: string }): FilingRow {
  return {
    engagementId: 'e1',
    companyName: 'e1 Pvt Ltd',
    compliance: 'GST',
    particular: 'GSTR-3B',
    authority: 'GST',
    frequency: 'monthly',
    filedOn: null,
    periodLabel: null,
    fyLabel: null,
    rawStatus: 'upcoming',
    ...patch,
  };
}

describe('preIncorporationIdsOf', () => {
  it('collects only the engagements isIncorporated rejects', () => {
    const rows = [
      engagement({ id: 'dated', incorporationDate: '2026-06-18' }),
      engagement({ id: 'coi-step' }),
      engagement({ id: 'pre' }),
    ];
    const ids = preIncorporationIdsOf(rows, (e) =>
      e.id === 'coi-step' ? { 'pre-12': { status: 'completed' } } : {},
    );
    expect([...ids]).toEqual(['pre']);
  });
});

describe('company narrowing', () => {
  const rows = [
    row({ id: '1', dueDate: '2026-09-20', engagementId: 'e1' }),
    row({ id: '2', dueDate: '2026-09-20', engagementId: 'e2', companyName: 'e2 Pvt Ltd' }),
  ];
  const roster = [engagement({ id: 'e1' }), engagement({ id: 'e2' })];

  it('leaves the portfolio whole on "all" and filters by engagement otherwise', () => {
    expect(rowsForCompany(rows, ALL_COMPANIES)).toHaveLength(2);
    expect(rowsForCompany(rows, 'e2').map((r) => r.id)).toEqual(['2']);
  });

  it('falls back to the whole portfolio for an id outside the roster', () => {
    expect(normaliseCompanyParam('e2', roster)).toBe('e2');
    expect(normaliseCompanyParam('someone-elses', roster)).toBe(ALL_COMPANIES);
    expect(normaliseCompanyParam(null, roster)).toBe(ALL_COMPANIES);
    expect(pickedCompany(roster, 'e1')?.id).toBe('e1');
    expect(pickedCompany(roster, ALL_COMPANIES)).toBeNull();
  });
});

describe('soleCompany', () => {
  it('is the one engagement in scope, or null once there is a choice', () => {
    expect(soleCompany([engagement({ id: 'only' })])?.id).toBe('only');
    expect(soleCompany([engagement({ id: 'a' }), engagement({ id: 'b' })])).toBeNull();
    expect(soleCompany([])).toBeNull();
  });
});

describe('status filter', () => {
  it('accepts the register vocabulary and "all" only', () => {
    expect(isFilingStatusFilter('overdue')).toBe(true);
    expect(isFilingStatusFilter('all')).toBe(true);
    expect(isFilingStatusFilter('in-progress')).toBe(false);
    expect(isFilingStatusFilter(null)).toBe(false);
  });

  it('keeps rows by their derived status', () => {
    const rows = [
      row({ id: 'late', dueDate: '2026-08-20' }),
      row({ id: 'soon', dueDate: '2026-09-10' }),
      row({ id: 'done', dueDate: '2026-08-20', filedOn: '2026-08-18' }),
    ];
    expect(rowsForStatus(rows, 'all', NOW).map((r) => r.id)).toEqual(['late', 'soon', 'done']);
    expect(rowsForStatus(rows, 'overdue', NOW).map((r) => r.id)).toEqual(['late']);
    expect(rowsForStatus(rows, 'due-soon', NOW).map((r) => r.id)).toEqual(['soon']);
    expect(rowsForStatus(rows, 'filed', NOW).map((r) => r.id)).toEqual(['done']);
  });
});
