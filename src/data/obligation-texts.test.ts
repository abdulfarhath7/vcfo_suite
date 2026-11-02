import { describe, expect, it } from 'vitest';
import { COMPLIANCE_OBLIGATIONS } from '@/lib/compliance/obligations-seed';
import { OBLIGATION_TEXTS, obligationText } from '@/data/obligation-texts';

describe('OBLIGATION_TEXTS', () => {
  it('has all three texts for every seeded obligation', () => {
    for (const o of COMPLIANCE_OBLIGATIONS) {
      const t = obligationText(o.id);
      expect(t, o.id).not.toBeNull();
      expect(t!.about.trim().length, `${o.id} about`).toBeGreaterThan(20);
      expect(t!.whyItApplies.trim().length, `${o.id} whyItApplies`).toBeGreaterThan(20);
      expect(t!.ifLate.trim().length, `${o.id} ifLate`).toBeGreaterThan(20);
    }
  });

  it('holds no text for an obligation the register does not seed', () => {
    const seeded = new Set(COMPLIANCE_OBLIGATIONS.map((o) => o.id));
    expect(Object.keys(OBLIGATION_TEXTS).filter((id) => !seeded.has(id))).toEqual([]);
  });

  it('writes plain sentences (R-38: no "please")', () => {
    for (const t of Object.values(OBLIGATION_TEXTS)) {
      for (const line of [t.about, t.whyItApplies, t.ifLate]) {
        expect(line).toMatch(/\.$/);
        expect(line.toLowerCase()).not.toContain('please');
      }
    }
  });
});
