import { describe, expect, it } from 'vitest';
import { acceptanceByAction, type CardRowCount } from './acceptance';

const count = (status: string, rows: number, extra: Partial<CardRowCount> = {}): CardRowCount => ({ action: 'reminders.sendClient', trigger: 'schedule', status, edited: false, expired: false, rows, ...extra });

describe('acceptance per action', () => {
  it('counts what people did, and rates only what they answered', () => {
    const [row] = acceptanceByAction([
      count('applied', 6),
      count('applied', 2, { edited: true }),
      count('skipped', 1),
      count('undone', 1),
      count('proposed', 3),
      count('proposed', 2, { expired: true }),
      count('held', 1),
      count('failed', 4),
    ]);
    expect(row).toMatchObject({ proposed: 20, accepted: 8, acceptedEdited: 2, turnedDown: 1, undone: 1, expired: 2, waiting: 4, failed: 4 });
    expect(row!.acceptedRate).toBeCloseTo(8 / 12);
    expect(row!.uneditedRate).toBeCloseTo(6 / 12);
  });

  it('gives no rate before anything is answered', () => {
    expect(acceptanceByAction([count('proposed', 3)])[0]).toMatchObject({ waiting: 3, acceptedRate: null, uneditedRate: null });
    expect(acceptanceByAction([])).toEqual([]);
  });

  it('keeps chat and overnight apart, largest first, because they earn trust separately', () => {
    const rows = acceptanceByAction([count('applied', 1, { trigger: 'chat' }), count('applied', 3), count('skipped', 9, { action: 'documents.review' })]);
    expect(rows.map((row) => [row.action, row.trigger, row.proposed])).toEqual([
      ['documents.review', 'schedule', 9],
      ['reminders.sendClient', 'schedule', 3],
      ['reminders.sendClient', 'chat', 1],
    ]);
  });
});
