import { describe, expect, it } from 'vitest';
import { getPreIncPhases } from '@/data/checklist';
import { gateActiveCatalog } from '@/lib/checklist/checklist-step-gate';
import { journeyRailItems } from './helpers';

describe('SB-01 step side rail', () => {
  const partB = getPreIncPhases()[1]!.items;
  const gates = gateActiveCatalog({}, 'staff');

  it('lists Part B in MCA form order with MCA section codes, and the rest in checklist order', () => {
    const rows = journeyRailItems(partB, gates, {}, null, undefined, undefined, false);
    expect(rows.map((r) => r.item.id).slice(0, 5)).toEqual(['pre-13', 'pre-14', 'pre-16', 'pre-15', 'pre-7']);
    expect(rows.slice(0, 4).map((r) => r.stepCode)).toEqual(['MCA 3A', 'MCA 4', 'MCA 5–6', 'MCA 7']);
    expect(rows[4]!.stepCode).toMatch(/^Step \d+$/);
  });

  it('keeps each step number at its checklist (gating) position', () => {
    const rows = journeyRailItems(partB, gates, {}, null, undefined, undefined, true);
    const byId = Object.fromEntries(rows.map((r) => [r.item.id, r.stepNumber]));
    expect(byId['pre-15']).toBe(3);
    expect(byId['pre-16']).toBe(4);
    expect(rows[0]!.stepCode).toBeUndefined();
  });
});
