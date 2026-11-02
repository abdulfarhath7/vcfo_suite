import { describe, expect, it } from 'vitest';
import type { InternWorkItem } from '@/lib/intern/intern-work';
import type { PlannerBlockDto } from '@/lib/planner-blocks';
import { blockTimesError, cleanBlockInput, cleanBlockPatch, isMissingTableError } from '@/lib/planner-blocks';
import {
  anchorDay,
  applyFilter,
  areaBars,
  csv,
  dueLabel,
  fmtRange,
  fmtTime,
  fromTask,
  fromWork,
  monthGrid,
  onTimeRate,
  parseTime,
  planDays,
  planWeek,
  stepArea,
  summarize,
  taskStatus,
  timeline,
  workStatus,
  type PlanItem,
  type WorkCtx,
} from './model';

const TODAY = '2026-10-29'; // Thursday

const ctx: WorkCtx = {
  today: TODAY,
  seat: 'mgr',
  stepTitle: (id) => (id === 'reg-4' ? 'GST Registration' : 'Registered Office Address'),
  stepCode: (id) => (id === 'pre-7' ? 'Pre-7' : 'Reg-4'),
  lockFor: (w) => (w.catalogId === 'pre-7' ? { from: '2026-10-26', to: '2026-10-30', setBy: 'mgr-1' } : undefined),
  areaForFiling: () => 'GST',
  board: () => 'progress',
  cta: (w) => (w.kind === 'waiting-manager' ? { label: 'Email manager again', action: 'nudge-manager' } : { label: 'Continue', action: 'open' }),
};
const work = (over: Partial<InternWorkItem>): InternWorkItem => ({
  id: 'step:e1:pre-7',
  source: 'step',
  engagementId: 'e1',
  companyName: 'Northwind Analytics India Private Limited',
  title: 'Pre-7 · Registered Office Address',
  kind: 'in-progress',
  href: '/x',
  why: 'Day 3',
  isOverdue: false,
  isCritical: false,
  catalogId: 'pre-7',
  dueAt: '2026-10-30',
  startedAt: '2026-10-20T10:00:00Z',
  ...over,
});
const item = (over: Partial<PlanItem>): PlanItem => ({ ...fromWork(work({}), ctx), ...over });

describe('status words', () => {
  it('maps the live queue to the console vocabulary', () => {
    expect(workStatus({ kind: 'done', isOverdue: false, source: 'step' }, TODAY)).toBe('done');
    expect(workStatus({ kind: 'in-progress', isOverdue: true, source: 'step' }, TODAY)).toBe('over');
    expect(workStatus({ kind: 'waiting-client', isOverdue: false, source: 'step', dueAt: '2026-10-30' }, TODAY)).toBe('wait');
    expect(workStatus({ kind: 'review', isOverdue: false, source: 'step', dueAt: '2026-11-03' }, TODAY)).toBe('due');
    expect(workStatus({ kind: 'filing', isOverdue: false, source: 'filing', dueAt: '2026-11-20' }, TODAY)).toBe('none');
    expect(workStatus({ kind: 'in-progress', isOverdue: false, source: 'step' }, TODAY)).toBe('run');
  });
  it('maps team tasks like Today does', () => {
    expect(taskStatus({ status: 'completed' }, TODAY)).toBe('done');
    expect(taskStatus({ status: 'in-progress', dueAt: '2026-10-27T06:30:00Z' }, TODAY)).toBe('over');
    expect(taskStatus({ status: 'not-started', dueAt: '2026-11-02T06:30:00Z' }, TODAY)).toBe('due');
    expect(taskStatus({ status: 'awaiting-client' }, TODAY)).toBe('wait');
    expect(taskStatus({ status: 'not-started' }, TODAY)).toBe('none');
  });
  it('writes due tags in README words', () => {
    expect(dueLabel('over', '2026-10-26', TODAY)).toBe('Overdue 3d');
    expect(dueLabel('due', TODAY, TODAY)).toBe('Today');
    expect(dueLabel('due', '2026-10-30', TODAY)).toBe('Fri 30 Oct');
    expect(dueLabel('none', '2026-11-20', TODAY)).toBe('20 Nov');
    expect(dueLabel('none', undefined, TODAY)).toBe('No date');
    expect(dueLabel('done', '2026-10-20', TODAY)).toBe('Done');
  });
});

describe('rows', () => {
  it('builds a step row with the clients chain code, the lock and its window start', () => {
    const r = fromWork(work({}), ctx);
    expect(r).toMatchObject({ kind: 'step', code: 'Pre-7', title: 'Registered Office Address', locked: true, lockSetBy: 'mgr-1', start: '2026-10-26', due: '2026-10-30', st: 'due', area: 'MCA' });
  });
  it('a step waiting on the manager reads Review on the manager seat, Email manager again on the lead seat', () => {
    expect(fromWork(work({ kind: 'waiting-manager' }), ctx).cta).toEqual({ label: 'Review', action: 'open' });
    expect(fromWork(work({ kind: 'waiting-manager' }), { ...ctx, seat: 'lead' }).cta.action).toBe('nudge-manager');
  });
  it('builds a team task row with Mark done', () => {
    const r = fromTask({ id: 't1', engagementId: 'e1', checklistKey: '', title: 'Collect KYC', status: 'not-started', dueAt: '2026-11-02T06:30:00Z' }, 'Northwind', TODAY);
    expect(r).toMatchObject({ id: 'task:t1', kind: 'task', st: 'due', board: 'action', cta: { label: 'Mark done', action: 'done' }, due: '2026-11-02' });
  });
  it('names areas of law from step titles', () => {
    expect(stepArea('GST Registration')).toBe('GST');
    expect(stepArea('PF Registration')).toBe('PAY');
    expect(stepArea('FC-GPR Filing')).toBe('FEMA');
    expect(stepArea('PAN and TAN')).toBe('IT');
    expect(stepArea('Bank Account Opening')).toBe('MCA');
  });
});

describe('filters and counts', () => {
  const a = item({ id: 'a', clientId: 'e1', kind: 'step', st: 'over', due: '2026-10-20' });
  const b = item({ id: 'b', clientId: 'e2', kind: 'filing', area: 'GST', st: 'due', due: '2026-11-02' });
  const c = item({ id: 'c', clientId: 'e2', kind: 'step', st: 'wait', due: '2026-11-20' });
  it('filters by clients, kind and the live day anchor', () => {
    expect(applyFilter([a, b, c], { clients: ['e2'], show: 'all' }, TODAY).map((i) => i.id)).toEqual(['b', 'c']);
    expect(applyFilter([a, b, c], { clients: [], show: 'filings' }, TODAY).map((i) => i.id)).toEqual(['b']);
    expect(anchorDay(a, TODAY)).toBe(TODAY); // overdue work sits on today
    expect(applyFilter([a, b, c], { clients: [], show: 'all', day: '2026-11-02' }, TODAY).map((i) => i.id)).toEqual(['b']);
  });
  it('counts the summary strip from the same rows and the week’s blocks', () => {
    const blocks = [{ day: '2026-10-28', startMin: 600, endMin: 690 }, { day: '2026-11-03', startMin: 600, endMin: 660 }] as PlannerBlockDto[];
    const s = summarize([a, b, c, item({ id: 'd', st: 'done' })], blocks, TODAY);
    expect([s.open.length, s.over.length, s.due.length, s.wait.length, s.hours]).toEqual([3, 1, 1, 1, 1.5]);
  });
  it('bars by area and the on-time rate', () => {
    expect(areaBars([a, b, c]).find((x) => x.area === 'MCA')).toMatchObject({ over: 1, pending: 1, total: 2 });
    expect(onTimeRate([])).toEqual({ pct: null, n: 0 });
    expect(onTimeRate([{ doneOn: '2026-10-01', due: '2026-10-02' }, { doneOn: '2026-10-05', due: '2026-10-02' }])).toEqual({ pct: 50, n: 2 });
  });
});

describe('timeline and month', () => {
  it('draws two weeks from this Monday, clips bars and sends later work below', () => {
    const t = timeline([item({ id: 'x', start: '2026-10-20', due: '2026-10-30' }), item({ id: 'late', st: 'none', start: '2026-11-20', due: '2026-11-25' })], TODAY);
    expect(t.days[0]).toBe('2026-10-26');
    expect(t.days[13]).toBe('2026-11-08');
    expect(t.rows[0]).toMatchObject({ a: 0, z: 4, dueCol: 4, bar: 'm' });
    expect(t.later.map((i) => i.id)).toEqual(['late']);
  });
  it('builds a Mon-first month grid with the worst status per day', () => {
    const g = monthGrid('2026-10-15', [item({ id: 'o', st: 'over', due: '2026-10-20' })], []);
    expect(g[0]!.day).toBe('2026-09-28');
    expect(g.find((c) => c.day === '2026-10-20')!.worst).toBe('over');
    expect(g.length % 7).toBe(0);
  });
});

describe('times', () => {
  it('reads typed times like the prototype', () => {
    expect(parseTime('2:30 pm')).toBe(870);
    expect(parseTime('14:30')).toBe(870);
    expect(parseTime('230')).toBe(870);
    expect(parseTime('9')).toBe(540);
    expect(parseTime('3')).toBe(900);
    expect(Number.isNaN(parseTime('25:00'))).toBe(true);
    expect(fmtTime(870)).toBe('2:30 pm');
    expect(fmtRange(870, 960)).toBe('2:30 to 4:00 pm');
    expect(fmtRange(690, 780)).toBe('11:30 am to 1:00 pm');
  });
  it('checks block rules on both sides', () => {
    expect(blockTimesError(540, 555)).toBeNull();
    expect(blockTimesError(480, 600)).toBe('outside_day');
    expect(blockTimesError(600, 610)).toBe('too_short');
    expect(() => cleanBlockInput({ title: ' ', day: TODAY, startMin: 600, endMin: 660 })).toThrow('title_required');
    expect(() => cleanBlockInput({ title: 'x', day: '2026-02-30', startMin: 600, endMin: 660 })).toThrow('day_invalid');
    expect(() => cleanBlockInput({ title: 'x', day: TODAY, startMin: 600, endMin: 660, itemRef: 'bad ref' })).toThrow('ref_invalid');
    expect(cleanBlockInput({ title: ' GST ', day: TODAY, startMin: 600, endMin: 660, itemRef: 'step:e1:pre-7' })).toMatchObject({ title: 'GST', itemRef: 'step:e1:pre-7', engagementId: null });
    expect(cleanBlockPatch({ endMin: 700 }, { day: TODAY, startMin: 600, endMin: 660, title: 'x' })).toEqual({ day: TODAY, startMin: 600, endMin: 700, title: 'x' });
    expect(isMissingTableError({ cause: { code: '42P01' } })).toBe(true);
    expect(isMissingTableError(new Error('boom'))).toBe(false);
  });
});

describe('plan my week', () => {
  const days = planDays(TODAY);
  it('plans five weekdays from today', () => {
    expect(days).toEqual(['2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04']);
  });
  it('keeps 9 to 11 free for step work, never overlaps a block, puts overdue and filings first', () => {
    const blocks = [{ day: TODAY, startMin: 660, endMin: 720, itemRef: null }] as PlannerBlockDto[];
    const out = planWeek(
      [
        item({ id: 's1', kind: 'step', st: 'run', locked: false, due: '2026-11-04' }),
        item({ id: 'f1', kind: 'filing', st: 'due', locked: false, due: '2026-10-30' }),
        item({ id: 'w1', st: 'wait' }),
      ],
      blocks,
      days,
      { deep: true, first: true, group: false },
    );
    expect(out.map((s) => s.item.id)).toEqual(['f1', 's1']);
    expect(out[0]).toMatchObject({ day: TODAY, a: 540, z: 600 });
    expect(out[1]).toMatchObject({ day: TODAY, a: 720, z: 810 });
  });
  it('refuses work whose manager window ended before the plan starts', () => {
    const out = planWeek([item({ id: 'old', locked: true, st: 'over', due: '2026-10-20' })], [], days, { deep: false, first: true, group: false });
    expect(out[0]!.refused).toMatch(/Outside the task span/);
  });
  it('skips items that already have a block', () => {
    const out = planWeek([item({ id: 'p1', st: 'run' })], [{ day: TODAY, startMin: 600, endMin: 660, itemRef: 'p1' }] as PlannerBlockDto[], days, { deep: false, first: false, group: false });
    expect(out).toEqual([]);
  });
});

it('writes CSV with quoting', () => {
  expect(csv([['a', 'b,c'], ['"q"', 'x']])).toBe('a,"b,c"\n"""q""",x');
});
