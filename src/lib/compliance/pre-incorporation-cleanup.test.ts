import { describe, expect, it } from 'vitest';

import {
  filingCleanupReason,
  filingHasRecordedWork,
  selectPreIncorporationFilings,
  type FilingCleanupRow,
} from '@/lib/compliance/pre-incorporation-cleanup';

const row = (over: Partial<FilingCleanupRow>): FilingCleanupRow => ({
  id: 'f1',
  engagementId: 'e1',
  companyName: 'Emburse',
  particular: 'Advance Tax Payment Q3',
  periodLabel: 'Advance Tax Payment Q3 2025',
  dueDate: '2025-12-15',
  periodEnd: null,
  status: 'overdue',
  filedOn: null,
  evidenceUrl: null,
  filedNote: null,
  windowFrom: null,
  windowTo: null,
  incorporationDate: null,
  stage: 'Pre-Incorporation',
  coiStep: null,
  acknowledgementNo: null,
  amountPaid: null,
  filedBy: null,
  dataReceivedOn: null,
  preparingSince: null,
  approvedOn: null,
  workflowStage: null,
  submittedAt: null,
  linkedCount: 0,
  ...over,
});

describe('pre-incorporation filings cleanup', () => {
  it('marks a filing of a company that is not incorporated', () => {
    expect(filingCleanupReason(row({}))).toBe('not-incorporated');
  });

  it('marks a filing dated before the incorporation day, and keeps a real one', () => {
    expect(filingCleanupReason(row({ incorporationDate: '2026-10-20' }))).toBe('before-incorporation');
    expect(
      filingCleanupReason(row({ incorporationDate: '2026-10-20', dueDate: '2026-12-15', periodLabel: 'Advance Tax Payment Q3 2026' })),
    ).toBeNull();
    expect(filingCleanupReason(row({ incorporationDate: '2026-10-20', dueDate: '2026-11-07', periodEnd: '2026-09-30' }))).toBe(
      'before-incorporation',
    );
  });

  it('leaves a company that started at Registration or has a complete certificate step alone', () => {
    expect(filingCleanupReason(row({ stage: 'Post-Incorporation' }))).toBeNull();
    expect(filingCleanupReason(row({ coiStep: { status: 'completed' } as never }))).toBeNull();
  });

  it('counts any recorded work', () => {
    expect(filingHasRecordedWork(row({}))).toBe(false);
    expect(filingHasRecordedWork(row({ workflowStage: 'not-started', amountPaid: '0.00' }))).toBe(false);
    const worked: Partial<FilingCleanupRow>[] = [
      { status: 'filed' },
      { filedOn: '2026-01-01' },
      { evidenceUrl: 'https://example.test/proof.pdf' },
      { acknowledgementNo: 'ARN1' },
      { amountPaid: '1500.00' },
      { workflowStage: 'in-review' },
      { linkedCount: 1 },
    ];
    for (const over of worked) expect(filingHasRecordedWork(row(over))).toBe(true);
  });

  it('removes only the untouched bad filings', () => {
    const rows = [
      row({ id: 'bad-untouched' }),
      row({ id: 'bad-with-proof', linkedCount: 2 }),
      row({ id: 'bad-filed', status: 'filed', filedOn: '2026-01-01' }),
      row({ id: 'early', incorporationDate: '2026-10-20' }),
      row({ id: 'good', incorporationDate: '2026-10-20', dueDate: '2026-12-15' }),
      row({ id: 'registration-start', stage: 'Operational Readiness' }),
    ];
    const { remove, keep } = selectPreIncorporationFilings(rows);
    expect(remove.map((r) => [r.id, r.reason])).toEqual([
      ['bad-untouched', 'not-incorporated'],
      ['early', 'before-incorporation'],
    ]);
    expect(keep.map((r) => r.id)).toEqual(['bad-with-proof', 'bad-filed']);
  });
});
