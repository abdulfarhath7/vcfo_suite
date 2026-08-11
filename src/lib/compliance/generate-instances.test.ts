import { describe, expect, it } from 'vitest';

import { generateComplianceInstances } from '@/lib/compliance/generate-instances';

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
});
