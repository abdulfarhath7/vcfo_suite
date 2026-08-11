import { describe, expect, it } from 'vitest';

import { buildAoaMergeFields, collectAoaMissingFields } from '@/lib/incorporation-docs/aoa';

describe('buildAoaMergeFields', () => {
  it('builds numbered director list from Pre-6', () => {
    const fields = buildAoaMergeFields({
      director: 'company',
      pre1: { proposedName1: 'ABC India Private Limited', directorCount: '2' },
      pre6: {
        nrDirectorFirstName: 'Justin',
        nrDirectorLastName: 'Hsu',
        residentDirectorFirstName: 'Priya',
        residentDirectorLastName: 'Sharma',
      },
    });

    expect(fields.PROPOSED_COMPANY_NAME).toBe('ABC India Private Limited');
    expect(fields.AOA_DIRECTORS_LIST).toContain('Justin');
    expect(fields.AOA_DIRECTORS_LIST).toContain('Priya');
  });
});

describe('collectAoaMissingFields', () => {
  it('requires company name and at least one director', () => {
    const missing = collectAoaMissingFields({
      director: 'company',
      pre1: {},
      pre6: {},
    });

    expect(missing).toContain('Approved company name (Pre-5) or proposed name (Pre-1)');
    expect(missing).toContain('At least one director full name (Pre-6)');
  });
});
