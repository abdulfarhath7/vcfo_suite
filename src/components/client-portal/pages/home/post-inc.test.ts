import { describe, expect, it } from 'vitest';
import { buildIncorporationModel } from '@/lib/client-portal/step-model';
import { buildPostInc, postIncDrill } from './derive';

const win = (from: string, to: string) => ({ from, to, setBy: 'm', setAt: '2026-09-01T00:00:00Z' });

describe('buildPostInc (After incorporation card)', () => {
  const schedule = { steps: Object.fromEntries(['post-1', 'post-2', 'post-3'].map((id) => [id, win('2026-09-01', '2026-09-20')])) };

  it('shows no due date and no overdue count before COI', () => {
    const model = buildIncorporationModel({}, schedule, '2026-11-01');
    const { open, dayN } = buildPostInc(model, undefined, '2026-11-01');
    expect(open.length).toBeGreaterThan(0);
    expect(dayN).toBeUndefined();
    for (const p of open) {
      expect(p.dueDate).toBeUndefined();
      expect(p.overDays).toBe(0);
    }
    const drill = postIncDrill(open, [], 2);
    expect(drill.tabs[1]!.rows.every((r) => r.chip !== 'Overdue' && !/overdue/.test(String(r.meta)))).toBe(true);
  });

  it('counts the statutory clock from the incorporation date after COI, as before', () => {
    const model = buildIncorporationModel({}, schedule, '2026-11-01');
    const { open, dayN } = buildPostInc(model, '2026-08-01', '2026-11-01');
    expect(dayN).toBe(92);
    expect(open.some((p) => p.dueDate)).toBe(true);
    expect(open.some((p) => p.overDays > 0)).toBe(true);
  });
});
