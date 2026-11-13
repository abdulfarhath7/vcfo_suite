import { describe, expect, it } from 'vitest';
import { LATE_FEE_RULES } from '@/data/late-fee-rules';
import { COMPLIANCE_OBLIGATIONS } from '@/lib/compliance/obligations-seed';
import { computeLateFee, daysLate, lateFeeExplanation, lateFeeLabel, lateFeeRuleFor, totalLateFees } from './late-fees';

// 13 Nov 2026, 10:00 in India.
const NOW = new Date('2026-11-13T04:30:00Z');

describe('daysLate', () => {
  it('is zero on or before the due date', () => {
    expect(daysLate('2026-11-11', '2026-11-11', NOW)).toBe(0);
    expect(daysLate('2026-11-11', '2026-11-05', NOW)).toBe(0);
    expect(daysLate('2026-11-20', null, NOW)).toBe(0);
  });
  it('counts to the filed date, or to today in India while unfiled', () => {
    expect(daysLate('2026-10-11', '2026-10-20', NOW)).toBe(9);
    expect(daysLate('2026-11-11', null, NOW)).toBe(2);
  });
  it('uses the India date near midnight UTC', () => {
    // 12 Nov 2026 20:00 UTC is already 13 Nov in India.
    expect(daysLate('2026-11-12', null, new Date('2026-11-12T20:00:00Z'))).toBe(1);
  });
  it('treats an unreadable due date as not late', () => {
    expect(daysLate('', null, NOW)).toBe(0);
  });
});

describe('lateFeeRuleFor', () => {
  it('matches by obligation id, then by name', () => {
    expect(lateFeeRuleFor({ obligationId: 'gst-gstr-3b' })?.id).toBe('gst-gstr-3b');
    expect(lateFeeRuleFor({ particular: 'GSTR-1 Filing' })?.id).toBe('gst-gstr-1');
    expect(lateFeeRuleFor({ particular: 'TDS Return Filing Q3' })?.id).toBe('it-tds-return');
  });
  it('has no rule for an obligation the rules do not cover', () => {
    expect(lateFeeRuleFor({ obligationId: 'fema-fla', particular: 'FLA Return' })).toBeNull();
  });
  it('only names obligation ids that exist in the library', () => {
    const known = new Set(COMPLIANCE_OBLIGATIONS.map((o) => o.id));
    for (const rule of LATE_FEE_RULES) for (const id of rule.obligationIds) expect(known.has(id), `${rule.id}: ${id}`).toBe(true);
  });
  it('gives every rule a citation and a check date', () => {
    for (const rule of LATE_FEE_RULES) {
      expect(rule.citation.length, rule.id).toBeGreaterThan(10);
      expect(rule.asOf, rule.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('computeLateFee', () => {
  it('has no fee when filed on time', () => {
    expect(computeLateFee({ obligationId: 'gst-gstr-1', dueDate: '2026-10-11', filedOn: '2026-10-10' }, NOW)).toBeNull();
  });

  it('charges GSTR-3B ₹50 a day', () => {
    const fee = computeLateFee({ obligationId: 'gst-gstr-3b', dueDate: '2026-10-20', filedOn: '2026-10-30' }, NOW)!;
    expect(fee).toMatchObject({ daysLate: 10, amount: 500, capped: false, ongoing: false });
  });

  it('stops GSTR-1 at the ₹10,000 cap and says so', () => {
    const fee = computeLateFee({ obligationId: 'gst-gstr-1', dueDate: '2026-01-11', filedOn: null }, NOW)!;
    expect(fee.amount).toBe(10_000);
    expect(fee.capped).toBe(true);
    expect(fee.ongoing).toBe(true);
  });

  it('charges a TDS return ₹200 a day while unfiled', () => {
    const fee = computeLateFee({ particular: 'TDS Return Filing Q2', dueDate: '2026-10-31', filedOn: null }, NOW)!;
    expect(fee).toMatchObject({ ruleId: 'it-tds-return', daysLate: 13, amount: 2_600, ongoing: true });
  });

  it('charges AOC-4 ₹100 a day with no cap', () => {
    const fee = computeLateFee({ obligationId: 'mca-aoc-4', dueDate: '2025-10-30', filedOn: null }, NOW)!;
    expect(fee.daysLate).toBe(379);
    expect(fee.amount).toBe(37_900);
    expect(fee.capped).toBe(false);
  });

  it('charges DIR-3 KYC a fixed ₹5,000 however late', () => {
    expect(computeLateFee({ obligationId: 'mca-dir3-kyc', dueDate: '2026-09-30', filedOn: '2026-10-01' }, NOW)!.amount).toBe(5_000);
    expect(computeLateFee({ obligationId: 'mca-dir3-kyc', dueDate: '2025-09-30', filedOn: null }, NOW)!.amount).toBe(5_000);
  });

  it('reads MSME-1 as a maximum up to ₹3 lakh', () => {
    const early = computeLateFee({ obligationId: 'mca-msme-1-apr', dueDate: '2026-10-31', filedOn: null }, NOW)!;
    expect(early).toMatchObject({ kind: 'maximum', amount: 33_000 });
    expect(lateFeeLabel(early)).toBe('up to ₹33,000');
    const long = computeLateFee({ obligationId: 'mca-msme-1-oct', dueDate: '2025-04-30', filedOn: null }, NOW)!;
    expect(long.amount).toBe(300_000);
    expect(long.capped).toBe(true);
  });
});

describe('totalLateFees and labels', () => {
  it('adds only the filings that carry a fee', () => {
    const total = totalLateFees(
      [
        { obligationId: 'gst-gstr-3b', dueDate: '2026-10-20', filedOn: '2026-10-30' },
        { obligationId: 'gst-gstr-3b', dueDate: '2026-09-20', filedOn: '2026-09-19' },
        { obligationId: 'fema-fla', dueDate: '2026-07-15', filedOn: null },
        { obligationId: 'mca-dir3-kyc', dueDate: '2026-09-30', filedOn: null },
      ],
      NOW,
    );
    expect(total).toEqual({ amount: 5_500, count: 2 });
  });

  it('formats rupees the Indian way and explains the figure', () => {
    const fee = computeLateFee({ obligationId: 'mca-mgt-7', dueDate: '2025-11-28', filedOn: null }, NOW)!;
    expect(lateFeeLabel(fee)).toBe('₹35,000');
    const text = lateFeeExplanation(fee);
    expect(text).toContain('350 days late so far');
    expect(text).toContain('estimate');
  });
});
