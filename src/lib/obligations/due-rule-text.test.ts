import { describe, expect, it } from 'vitest';
import { COMPLIANCE_OBLIGATIONS } from '@/lib/compliance/obligations-seed';
import { dueRuleSentence } from '@/lib/obligations/due-rule-text';

describe('dueRuleSentence', () => {
  it('reads 0-based months as the generator does', () => {
    expect(dueRuleSentence({ kind: 'fixed-calendar-date', month: 5, day: 15 })).toBe('Due by 15 Jun each year.');
    expect(dueRuleSentence({ kind: 'fixed-calendar-date', month: 11, day: 31 }, { fyEnd: true })).toBe(
      'Due by 31 Dec after each financial year.',
    );
  });

  it('rolls a day past the month end over like Date does', () => {
    expect(dueRuleSentence({ kind: 'fixed-calendar-date', month: 5, day: 31 })).toBe('Due by 1 Jul each year.');
  });

  it('writes the other kinds in plain words', () => {
    expect(dueRuleSentence({ kind: 'nth-day-next-month', day: 7 })).toBe('Due by the 7th of the following month.');
    expect(dueRuleSentence({ kind: 'nth-day-next-month', day: 11 })).toBe('Due by the 11th of the following month.');
    expect(dueRuleSentence({ kind: 'nth-day-next-month', day: 22 })).toBe('Due by the 22nd of the following month.');
    expect(dueRuleSentence({ kind: 'days-after-fy-end', days: 122 })).toBe(
      'Due 122 days after the financial year ends on 31 Mar, which is 31 Jul.',
    );
    expect(dueRuleSentence({ kind: 'days-after-agm', days: 30 })).toBe('Due within 30 days of the annual general meeting.');
    expect(dueRuleSentence({ kind: 'quarterly-calendar', quarters: [{ month: 6, day: 31, label: 'Q1' }] })).toBe(
      'Due each quarter: 31 Jul (Q1).',
    );
  });

  it('returns null for a missing or unknown rule', () => {
    expect(dueRuleSentence(null)).toBeNull();
    expect(dueRuleSentence({})).toBeNull();
    expect(dueRuleSentence({ kind: 'lunar' })).toBeNull();
  });

  it('has a sentence for every seeded obligation', () => {
    for (const o of COMPLIANCE_OBLIGATIONS) {
      expect(dueRuleSentence(o.dueRule, { fyEnd: o.triggerType === 'fy_end' }), o.id).toMatch(/^Due /);
    }
  });
});
