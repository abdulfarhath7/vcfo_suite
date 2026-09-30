// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderStatusBriefPdf } from '@/lib/ask/pdf-brief';
import { buildStatusBrief } from '@/lib/ask/status-brief';
import { SNAPSHOTS } from '../../../../tests/ask/evals/golden';

const SECRETS = ['ABCDE1234F', 'U12345KA2026PTC000001', '09876543', 'Z1234567', '12 MG Road', 'Priya Sharma', 'priya@example.com'];

const state = {
  'pre-1': {
    status: 'completed',
    completedOn: '2026-10-02',
    responses: { pan: 'ABCDE1234F', signatoryFirstName: 'Priya Sharma', companyMailId: 'priya@example.com', parentEntityAddress: '12 MG Road' },
  },
  'pre-2': { status: 'completed', completedOn: '2026-09-20' },
  'pre-12': { status: 'not-started', responses: { cin: 'U12345KA2026PTC000001' } },
  'pre-15': { status: 'not-started', responses: { din: '09876543', passportNumber: 'Z1234567' } },
} as never;

describe('C4 monthly status brief', () => {
  const now = new Date('2026-10-15T06:00:00Z');
  const brief = buildStatusBrief({ snapshot: SNAPSHOTS.foreignCompany, state, now });

  it('carries progress, this month, next step and the calendar', () => {
    expect(brief.monthLabel).toBe('October 2026');
    expect(brief.doneThisMonth).toEqual(['Client Details']);
    expect(brief.next).toEqual({ title: 'Registered Office Address', withWhom: 'you' });
    expect(brief.upcoming).toEqual([{ name: 'GSTR-3B', dueDate: '2026-10-20' }]);
    expect(brief.phases.length).toBe(4);
  });

  it('contains no ID numbers, addresses, names or emails', () => {
    const json = JSON.stringify(brief);
    for (const secret of SECRETS) expect(json).not.toContain(secret);
  });

  it('renders a PDF', async () => {
    const pdf = await renderStatusBriefPdf({ brief, firmName: 'SBC', now });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30_000);
});
