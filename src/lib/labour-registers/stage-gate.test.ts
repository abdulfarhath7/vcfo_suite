import { describe, expect, it } from 'vitest';

import { labourBatchRefusal, NOT_INCORPORATED_MESSAGE } from './stage-gate';

describe('labourBatchRefusal', () => {
  it('refuses every period before the COI', () => {
    expect(labourBatchRefusal({ incorporated: false }, '2026-09-01')).toMatchObject({ status: 409, message: NOT_INCORPORATED_MESSAGE });
  });

  it('refuses a month before the month of incorporation, and allows that month and later', () => {
    const company = { incorporated: true, incorporationDate: '2026-06-10' };
    expect(labourBatchRefusal(company, '2026-05-01')).toMatchObject({ status: 422, code: 'before_incorporation' });
    expect(labourBatchRefusal(company, '2026-05-01')?.message).toContain('10 Jun 2026');
    expect(labourBatchRefusal(company, '2026-06-01')).toBeNull();
    expect(labourBatchRefusal(company, '2026-07-01')).toBeNull();
  });

  it('allows any period for a company incorporated before we met it, with no date on file', () => {
    expect(labourBatchRefusal({ incorporated: true, incorporationDate: null }, '2020-04-01')).toBeNull();
  });
});
