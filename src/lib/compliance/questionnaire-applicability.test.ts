import { describe, expect, it } from 'vitest';
import { generateComplianceInstances } from '@/lib/compliance/generate-instances';
import { obligationRuledOut, questionObligationIds, questionnaireExclusion } from '@/lib/compliance/questionnaire-applicability';

const ids = (exclude?: (id: string) => boolean, assumeRegistered = true) =>
  new Set(
    generateComplianceInstances({
      engagementId: 'e1',
      entityLegalForm: 'company',
      triggers: { incorporationDate: '2026-12-15' },
      ownerId: 'o1',
      asOfDate: new Date('2026-11-24T00:00:00Z'),
      assumeRegistered,
      exclude,
    }).map((i) => i.obligationId),
  );

describe('questionnaire applicability', () => {
  it('rules nothing out while the questionnaire is empty', () => {
    expect(obligationRuledOut('gst-gstr-3b', {})).toBe(false);
    expect(obligationRuledOut('gst-gstr-3b', null)).toBe(false);
    expect(obligationRuledOut('fema-fla', {})).toBe(false);
  });

  it('rules an obligation out only when its answers are all No', () => {
    expect(obligationRuledOut('gst-gstr-3b', { 'GST-01': false })).toBe(true);
    expect(obligationRuledOut('gst-gstr-3b', { 'GST-01': true })).toBe(false);
    expect(obligationRuledOut('labour-pf-payment', { 'EMP-03': false })).toBe(true);
    expect(obligationRuledOut('it-tds-payment', { 'TAX-01': false })).toBe(true);
  });

  it('keeps an obligation while any linked group still says Yes or is unanswered', () => {
    // FLA follows FI-01 and FI-04; one No alone does not remove it.
    expect(obligationRuledOut('fema-fla', { 'FI-01': false })).toBe(false);
    expect(obligationRuledOut('fema-fla', { 'FI-01': false, 'FI-04': false })).toBe(true);
    expect(obligationRuledOut('mca-msme-1-apr', { 'MSME-01': false, 'MSME-02': true })).toBe(false);
  });

  it('never rules out an obligation no question decides', () => {
    expect(obligationRuledOut('mca-aoc-4', { 'GST-01': false, 'TAX-01': false })).toBe(false);
  });

  it('generates every statutory compliance for a new company and drops the ruled-out ones', () => {
    const all = ids();
    expect(all.has('gst-gstr-3b')).toBe(true);
    expect(all.has('labour-pf-payment')).toBe(true);
    expect(all.has('it-tds-payment')).toBe(true);
    expect(ids(undefined, false).has('gst-gstr-3b')).toBe(false);

    const less = ids(questionnaireExclusion({ 'GST-01': false }));
    expect(less.has('gst-gstr-3b')).toBe(false);
    expect(less.has('gst-gstr-1')).toBe(false);
    expect(less.has('labour-pf-payment')).toBe(true);
  });

  it('lists the obligations a question decides', () => {
    expect(questionObligationIds('TAX-01')).toContain('it-tds-payment');
    expect(questionObligationIds('MSME-02')).toEqual(expect.arrayContaining(['mca-msme-1-apr', 'mca-msme-1-oct']));
    expect(questionObligationIds('NOT-A-QUESTION')).toEqual([]);
  });
});
