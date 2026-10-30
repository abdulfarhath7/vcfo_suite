import { describe, expect, it } from 'vitest';
import { incorporatingCountFor, showsComplianceCount, showsIncorporationCount } from './practice-counts';

/** R-51 counts: only real, cheap numbers, on the roles the prototype shows them for. */
describe('practice block counts', () => {
  it('counts the clients still incorporating from the scoped engagements', () => {
    const rows = [
      { id: 'a', stage: 'Pre-Incorporation' },
      { id: 'b', stage: 'Pre-Incorporation', incorporationDate: '2026-04-01' },
      { id: 'c', stage: 'Post-Incorporation' },
      { id: 'd', stage: 'Pre-Incorporation' },
    ];
    expect(incorporatingCountFor(rows, () => ({}))).toBe(2);
  });

  it('shows the Incorporation count to lead, manager and admin, the Compliances count to lead and manager', () => {
    expect(['intern', 'manager', 'admin', 'super_admin', 'client', 'developer'].map((r) => showsIncorporationCount(r as never))).toEqual([
      true, true, true, false, false, false,
    ]);
    expect(['intern', 'manager', 'admin', 'super_admin', 'client', 'developer'].map((r) => showsComplianceCount(r as never))).toEqual([
      true, true, false, false, false, false,
    ]);
  });
});
