import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import { clientRowFacts } from './client-row-facts';

const win = (from: string, to: string) => ({ from, to, setBy: 'm', setAt: '2026-09-01T00:00:00Z' });

function engagement(steps: Record<string, ReturnType<typeof win>>): Engagement {
  return { id: 'e1', health: 'on-track', createdAt: '2026-08-01T00:00:00Z', schedule: { steps } } as unknown as Engagement;
}

describe('clientRowFacts health and locked steps', () => {
  const now = new Date('2026-11-01T06:00:00Z');

  it('is not Overdue when only locked Phase 3 and 4 steps are past their window end', () => {
    const f = clientRowFacts(engagement({ 'post-1': win('2026-09-01', '2026-09-20'), 'reg-1': win('2026-09-01', '2026-09-20') }), {}, now);
    expect(f.health).not.toBe('Overdue');
  });

  it('is Overdue when the open step is past its window end, as before', () => {
    const f = clientRowFacts(engagement({ 'pre-1': win('2026-09-01', '2026-09-20') }), {}, now);
    expect(f.health).toBe('Overdue');
  });
});
