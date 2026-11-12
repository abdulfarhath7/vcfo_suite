import { describe, expect, it } from 'vitest';
import { meetingReadyCompanies } from './view-model';

describe('meetingReadyCompanies (stage gate for New meeting)', () => {
  it('drops companies before the Certificate of Incorporation and keeps the incorporated ones', () => {
    const companies = [
      { id: 'a', name: 'Pre COI', preIncorporation: true },
      { id: 'b', name: 'Incorporated', preIncorporation: false, incorporatedOn: '2026-09-01' },
      { id: 'c', name: 'Legacy row' },
    ];
    expect(meetingReadyCompanies(companies).map((c) => c.id)).toEqual(['b', 'c']);
    expect(meetingReadyCompanies([{ id: 'a', name: 'Pre COI', preIncorporation: true }])).toEqual([]);
  });
});
