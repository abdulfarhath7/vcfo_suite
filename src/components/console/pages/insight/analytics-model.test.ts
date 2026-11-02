import { describe, expect, it } from 'vitest';
import { checklist } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { FilingRow } from '@/lib/filings';
import type { TodayModel } from '../today/model';
import { buildKpis, buildTrends, filingMonths, leadCards, monthsBack, rateColor } from './analytics-model';

const eng = (id: string, createdAt: string): Engagement => ({ id, companyName: `Co ${id}`, createdAt } as unknown as Engagement);
const [a, b, c] = checklist.map((i) => i.id);

describe('monthsBack', () => {
  it('ends with the month of today, oldest first, with real month ends', () => {
    const m = monthsBack('2026-10-29', 6);
    expect(m.map((x) => x.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(m[0]!.end).toBe('2026-05-31');
    expect(monthsBack('2024-03-02', 2)[0]).toMatchObject({ key: '2024-02', end: '2024-02-29', label: 'Feb 2024' });
    expect(monthsBack('2026-01-10', 12)[0]!.key).toBe('2025-02');
  });
});

describe('buildKpis — the live view’s loop', () => {
  const e1 = eng('e1', '2026-03-01T10:00:00Z');
  const state: Record<string, Record<string, { status: string; completedOn?: string }>> = {
    e1: { [a!]: { status: 'completed', completedOn: '2026-09-10' }, [b!]: { status: 'not-applicable' }, [c!]: { status: 'awaiting-client' } },
  };
  const k = buildKpis([e1], (e) => state[e.id]);
  it('skips not-applicable, counts completed / awaiting-client as stored', () => {
    expect(k.projects).toBe(1);
    expect(k.stepsTotal).toBe(checklist.length - 1);
    expect(k.stepsDone).toBe(1);
    expect(k.pct).toBe(Math.round((1 / (checklist.length - 1)) * 100));
    expect(k.waiting.map((s) => s.itemId)).toEqual([c]);
    expect(k.overdue).toEqual([]);
    expect(k.dated[0]!.doneOn).toBe('2026-09-10');
  });
  it('is 0% with no projects', () => {
    expect(buildKpis([], () => ({})).pct).toBe(0);
  });
});

describe('buildTrends', () => {
  it('counts projects by the month they were set up, and dated steps by month end', () => {
    const e1 = eng('e1', '2026-03-01T10:00:00Z');
    const e2 = eng('e2', '2026-08-15T10:00:00Z');
    const st: Record<string, Record<string, { status: string; completedOn?: string }>> = {
      e1: { [a!]: { status: 'completed', completedOn: '2026-06-02' }, [b!]: { status: 'completed' } },
      e2: { [a!]: { status: 'completed', completedOn: '2026-09-30' } },
    };
    const k = buildKpis([e1, e2], (e) => st[e.id]);
    const t = buildTrends([e1, e2], k, monthsBack('2026-10-29', 6));
    expect(t.projects).toEqual([1, 1, 1, 2, 2, 2]);
    expect(t.added.map((e) => e.id)).toEqual(['e2']);
    expect(t.steps).toEqual([0, 1, 1, 1, 2, 2]);
    expect(t.doneInRange).toHaveLength(2);
    expect(k.undated).toBe(1);
  });
});

describe('filingMonths', () => {
  const row = (id: string, due: string, filed: string | null): FilingRow => ({ id, dueDate: due, filedOn: filed, particular: 'GSTR-3B', periodLabel: null, companyName: 'Co', engagementId: 'e1' } as unknown as FilingRow);
  const months = monthsBack('2026-10-20', 2);
  const fm = filingMonths(
    [row('1', '2026-09-11', '2026-09-10'), row('2', '2026-09-20', '2026-09-23'), row('3', '2026-09-30', null), row('4', '2026-10-25', null), row('5', '2026-10-11', null)],
    months,
    '2026-10-20',
  );
  it('settles on time, late and open; leaves out what is not due yet', () => {
    expect(fm[0]).toMatchObject({ onTime: 1, late: 1, open: 1, rate: 33 });
    // delays: 0, 3, 20 (open since 30 Sep) → 7.7
    expect(fm[0]!.delay).toBe(7.7);
    expect(fm[1]).toMatchObject({ onTime: 0, late: 0, open: 1, rate: 0, delay: 9 });
  });
  it('is null for a month with nothing due', () => {
    expect(filingMonths([], months, '2026-10-20')[0]).toMatchObject({ rate: null, delay: null });
  });
});

describe('leadCards', () => {
  it('counts what the lead’s clients closed in 14 days and the share on time', () => {
    const m = {
      leads: [{ key: 'L1', name: 'Asha', initials: 'AS', open: [{ id: 't1', st: 'over' }, { id: 't2', st: 'run' }], overdue: 1, clientIds: ['c1'] }],
      clients: [
        {
          id: 'c1',
          leadKey: 'L1',
          model: {
            steps: [
              { id: 'pre-1', title: 'A', kind: 'done', doneOn: '2026-10-20', due: '2026-10-22' },
              { id: 'pre-2', title: 'B', kind: 'done', doneOn: '2026-10-21', due: '2026-10-18' },
              { id: 'pre-3', title: 'C', kind: 'done', doneOn: '2026-10-21' },
              { id: 'pre-4', title: 'D', kind: 'done', doneOn: '2026-09-01', due: '2026-09-02' },
            ],
          },
          filings: [{ id: 'f1', name: 'GSTR-1', st: 'f', filedOn: '2026-10-20', due: '2026-10-20' }],
        },
      ],
    } as unknown as Pick<TodayModel, 'leads' | 'clients'>;
    const [card] = leadCards(m, '2026-10-29');
    expect(card!.done).toHaveLength(4);
    expect(card!.dated).toBe(3);
    expect(card!.onTime).toBe(2);
    expect(card!.rate).toBe(67);
    expect(card!.overdue).toHaveLength(1);
    expect(rateColor(67)).toBe('var(--over)');
    expect(rateColor(92)).toBe('var(--mx-ok)');
  });
});
