import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '@/components/staff/today/work-actions';
import { engagementChangedAt, workItemChangedAt } from '@/components/staff/today/today-rows';

describe('work action helpers', () => {
  it('quotes CSV cells only when they need it', () => {
    expect(csvCell('GSTR-3B')).toBe('GSTR-3B');
    expect(csvCell('Acme, India')).toBe('"Acme, India"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
    expect(toCsv(['A', 'B'], [[1, 'x,y']])).toBe('A,B\r\n1,"x,y"');
  });

  it('takes the latest real change time of a row and skips what cannot be read', () => {
    expect(
      workItemChangedAt(
        { startedAt: '2026-10-01T10:00:00Z' },
        { status: 'in-progress', lastEditedAt: '2026-10-20T09:00:00Z', reviewedAt: 'bad' },
        '2026-10-12T09:00:00Z',
      ),
    ).toBe('2026-10-20T09:00:00Z');
    expect(workItemChangedAt({}, undefined)).toBeUndefined();
    expect(
      engagementChangedAt({
        a: { status: 'completed', clientSubmittedAt: '2026-10-02T00:00:00Z' },
        b: { status: 'in-progress', deliveredToClientAt: '2026-10-28T00:00:00Z' },
      }),
    ).toBe('2026-10-28T00:00:00Z');
  });
});
