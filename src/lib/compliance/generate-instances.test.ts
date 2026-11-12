import { describe, expect, it } from 'vitest';

import { generateComplianceInstances, periodAfterIncorporation } from '@/lib/compliance/generate-instances';

describe('generateComplianceInstances', () => {
  it('does not generate GST returns before GST registration date', () => {
    const instances = generateComplianceInstances({
      engagementId: 'e-test',
      entityLegalForm: 'company',
      ownerId: 'tm1',
      asOfDate: new Date('2027-06-01'),
      triggers: {
        incorporationDate: '2026-11-15',
        gstRegistrationDate: '2026-12-01',
        tanRegistrationDate: '2026-11-20',
      },
    });

    const gst = instances.filter((i) => i.obligationId.startsWith('gst-'));
    expect(gst.some((i) => i.dueDate.startsWith('2026-11'))).toBe(false);
    expect(gst.some((i) => i.periodLabel === 'Dec 2026')).toBe(true);
  });

  it('generates ROC filings after short FY end', () => {
    const instances = generateComplianceInstances({
      engagementId: 'e-test',
      entityLegalForm: 'company',
      ownerId: 'tm1',
      asOfDate: new Date('2027-12-31'),
      triggers: {
        incorporationDate: '2026-11-15',
      },
    });

    const aoc4 = instances.find((i) => i.obligationId === 'mca-aoc-4');
    expect(aoc4?.fyLabel).toContain('Short');
    expect(aoc4?.dueDate >= '2027-09-01').toBe(true);
  });

  // Owner report (Emburse, 2026-11): a company still in pre-incorporation showed advance tax,
  // DIR-3 KYC, DPT-3 and MSME-1 filings back to 2025 as overdue.
  const asOf = new Date('2026-11-12T12:00:00');

  it('generates no filing for a company that is not incorporated', () => {
    expect(
      generateComplianceInstances({ engagementId: 'e-pre', entityLegalForm: 'company', ownerId: 'tm1', asOfDate: asOf, triggers: {} }),
    ).toEqual([]);
    expect(
      generateComplianceInstances({
        engagementId: 'e-pre',
        entityLegalForm: 'company',
        ownerId: 'tm1',
        asOfDate: asOf,
        triggers: { incorporationDate: null },
        incorporated: false,
      }),
    ).toEqual([]);
  });

  it('still generates for a company that started at Registration, incorporated before we met it', () => {
    const ids = generateComplianceInstances({
      engagementId: 'e-reg',
      entityLegalForm: 'company',
      ownerId: 'tm1',
      asOfDate: asOf,
      triggers: {},
      incorporated: true,
    }).map((i) => i.obligationId);
    expect(ids).toContain('it-advance-tax-q3');
    expect(ids).toContain('mca-dir3-kyc');
  });

  it('never dates a filing before the incorporation day', () => {
    const instances = generateComplianceInstances({
      engagementId: 'e-new',
      entityLegalForm: 'company',
      ownerId: 'tm1',
      asOfDate: asOf,
      triggers: { incorporationDate: '2026-10-20', gstRegistrationDate: '2026-10-25', tanRegistrationDate: '2026-10-20' },
    });
    expect(instances.length).toBeGreaterThan(0);
    for (const i of instances) {
      expect(i.dueDate >= '2026-10-20').toBe(true);
      if (i.periodEnd) expect(i.periodEnd >= '2026-10-20').toBe(true);
    }
    const titles = instances.map((i) => i.periodLabel);
    expect(titles).not.toContain('Advance Tax Payment Q3 2025');
    expect(titles).not.toContain('DPT-3 Filing 2026');
    expect(titles).toContain('Advance Tax Payment Q3 2026');
  });

  it('keeps a period that straddles the incorporation day and drops one that ends before it', () => {
    expect(periodAfterIncorporation({ dueDate: '2026-11-07', periodEnd: '2026-10-31' }, '2026-10-20')).toBe(true);
    expect(periodAfterIncorporation({ dueDate: '2026-10-07', periodEnd: '2026-09-30' }, '2026-10-20')).toBe(false);
    expect(periodAfterIncorporation({ dueDate: '2026-11-07', periodEnd: '2026-09-30' }, '2026-10-20')).toBe(false);
    expect(periodAfterIncorporation({ dueDate: '2026-06-15', periodEnd: null }, '2026-10-20')).toBe(false);
    expect(periodAfterIncorporation({ dueDate: '2026-06-15' }, null)).toBe(true);
  });
});
