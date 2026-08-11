import { describe, expect, it } from 'vitest';

import {
  buildMoaClause5Fields,
  buildMoaMergeFields,
  collectMoaMissingFields,
  paidUpEquityShareCountFromPre1,
} from '@/lib/incorporation-docs/moa';

const pre1ShareCapital = {
  authorisedShareCapital: '1000000',
  paidUpShareCapital: '100000',
  nominalValuePerEquityShare: '10',
};

describe('buildMoaClause5Fields', () => {
  it('maps pre-1 share capital to clause V placeholders with Indian formatting', () => {
    const fields = buildMoaClause5Fields(pre1ShareCapital);

    expect(fields.AUTHORISED_SHARE_CAPITAL).toContain('10,00,000');
    expect(fields.AUTHORISED_SHARE_CAPITAL).toMatch(/Indian Rupees/i);
    expect(fields.PAID_UP_SHARE_CAPITAL).toContain('1,00,000');
    expect(fields.NOMINAL_VALUE_PER_EQUITY_SHARE).toBe('10');
    expect(fields.PAID_UP_EQUITY_SHARES).toBe('10,000');
    expect(fields.MOA_CLAUSE_5).toContain('10,00,000');
    expect(fields.MOA_CLAUSE_5).toContain('INR 10');
    expect(fields.MOA_CLAUSE_5).toContain('1,00,000');
  });
});

describe('paidUpEquityShareCountFromPre1', () => {
  it('computes share count as paid-up divided by nominal value', () => {
    expect(paidUpEquityShareCountFromPre1(pre1ShareCapital)).toBe('10,000');
    expect(
      paidUpEquityShareCountFromPre1({
        paidUpShareCapital: '50,000',
        nominalValuePerEquityShare: '10',
      }),
    ).toBe('5,000');
  });
});

describe('buildMoaMergeFields', () => {
  it('includes clause 2 and clause 5 fields', () => {
    const fields = buildMoaMergeFields({
      director: 'non-resident',
      pre1: { proposedName1: 'ABC India Private Limited', ...pre1ShareCapital },
      pre6: { registeredOfficeCompleteAddress: '12 MG Road, Bengaluru, India' },
    });

    expect(fields.PROPOSED_COMPANY_NAME).toBe('ABC India Private Limited');
    expect(fields.MOA_CLAUSE_2).toBe('12 MG Road, Bengaluru, India');
    expect(fields.MOA_REGISTERED_OFFICE_STATE).toBe('Bengaluru');
    expect(fields.PAID_UP_EQUITY_SHARES).toBe('10,000');
    expect(fields.MOA_CLAUSE_5).toMatch(/share capital of the company/i);
  });
});

describe('collectMoaMissingFields', () => {
  it('requires pre-1 share capital fields', () => {
    const missing = collectMoaMissingFields({
      director: 'non-resident',
      pre1: { proposedName1: 'ABC India Private Limited' },
      pre6: { registeredOfficeCompleteAddress: 'Office address' },
    });

    expect(missing).toContain('Authorized Share Capital (Pre-1)');
    expect(missing).toContain('Initial Paid-up Share Capital (Pre-1)');
    expect(missing).toContain('Nominal Value of Each Equity Share (Pre-1)');
  });
});
