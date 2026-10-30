import { describe, expect, it } from 'vitest';
import { ACTIVITY_SEED, OBLIGATION_ACTIVITY } from './compliance-activities';
import { COMPLIANCE_OBLIGATIONS } from '@/lib/compliance/obligations-seed';

describe('the activity master (DR-01, COMPLIANCE-MODEL 3.1)', () => {
  it('has the owner documents: 43 activities, 32 statutory and 11 non-statutory', () => {
    expect(ACTIVITY_SEED).toHaveLength(43);
    expect(new Set(ACTIVITY_SEED.map((a) => a.id)).size).toBe(43);
    expect(ACTIVITY_SEED.filter((a) => a.group === 'statutory')).toHaveLength(32);
    expect(ACTIVITY_SEED.filter((a) => a.group === 'non-statutory')).toHaveLength(11);
    expect(ACTIVITY_SEED.filter((a) => a.from === 'manual')).toHaveLength(11);
  });

  it('defaults notify days by frequency and visibility by group', () => {
    const byId = new Map(ACTIVITY_SEED.map((a) => [a.id, a]));
    expect(byId.get('ACT-001-3B')).toMatchObject({ notifyDays: 5, visibility: 'both' });
    expect(byId.get('ACT-010')).toMatchObject({ notifyDays: 2, visibility: 'both' });
    expect(byId.get('ACT-004')).toMatchObject({ notifyDays: 5, visibility: 'firm' });
    expect(ACTIVITY_SEED.filter((a) => a.group === 'statutory').every((a) => a.visibility === 'both')).toBe(true);
    expect(ACTIVITY_SEED.filter((a) => a.confirm).map((a) => a.id).sort()).toEqual(['ACT-009', 'ACT-011', 'ACT-012', 'ACT-022', 'ACT-028']);
  });

  it('links only real obligations to real statutory activities', () => {
    const obligations = new Set(COMPLIANCE_OBLIGATIONS.map((o) => o.id));
    const byId = new Map(ACTIVITY_SEED.map((a) => [a.id, a]));
    for (const [obligationId, activityId] of Object.entries(OBLIGATION_ACTIVITY)) {
      expect(obligations.has(obligationId), obligationId).toBe(true);
      expect(byId.get(activityId)?.group, activityId).toBe('statutory');
    }
  });
});
