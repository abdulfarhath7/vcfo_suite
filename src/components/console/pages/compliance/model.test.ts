import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import type { FilingRow } from '@/lib/compliance/filings';
import {
  buildBook,
  cadenceOf,
  catCounts,
  catParam,
  comingUp,
  comingUpTasks,
  countSt,
  fallbackLine,
  filterRows,
  filterTasks,
  moveDay,
  nextDeadline,
  nextItem,
  parseCat,
  parseStatus,
  periodMatrix,
  registerCsv,
  sbcRows,
  showStat,
  showTasks,
  statusParam,
  taskBars,
  taskItem,
  taskPath,
  taskRow,
  taskRows,
  winShort,
  worstOf,
  type ConsoleTask,
} from './model';

const TODAY = '2026-10-29';

function eng(id: string, name: string, extra: Partial<Engagement> = {}): Engagement {
  return {
    id,
    clientId: `c-${id}`,
    companyName: name,
    companyType: 'domestic',
    internId: `lead-${id}`,
    adminId: 'a',
    createdAt: '2026-04-01T00:00:00Z',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    ...extra,
  } as Engagement;
}

function reg(id: string, engagementId: string, dueDate: string, extra: Partial<FilingRow> = {}): FilingRow {
  return {
    id,
    engagementId,
    companyName: 'Northwind Technologies Pvt Ltd',
    compliance: 'GST',
    particular: 'GSTR-3B Filing',
    authority: 'GST',
    frequency: 'monthly',
    dueDate,
    filedOn: null,
    periodLabel: null,
    fyLabel: 'FY 2026-27',
    rawStatus: 'upcoming',
    obligationId: 'gstr3b',
    windowFrom: null,
    windowTo: null,
    ...extra,
  };
}

const NW = eng('e1', 'Northwind Technologies Pvt Ltd', { incorporationDate: '2026-05-10', stage: 'Post-Incorporation' });
const OL = eng('e2', 'Orchid Lane Foods Pvt Ltd');

function book(register: FilingRow[], scope: 'all' | 'inc' | 'cmp' = 'all') {
  return buildBook({ today: TODAY, fy: 2026, scope, engagements: [NW, OL], stateFor: () => ({}), register, leads: [{ internId: 'lead-e1', name: 'Arjun Mehta' }] });
}

describe('buildBook', () => {
  it('register rows win; a client with no register rows gets SBC calendar lines', () => {
    const b = book([reg('r1', 'e1', '2026-10-20'), reg('r2', 'e1', '2026-11-20', { filedOn: '2026-11-18' })]);
    const nw = b.rows.filter((r) => r.clientId === 'e1');
    expect(nw).toHaveLength(2);
    expect(nw.every((r) => !r.cal)).toBe(true);
    expect(nw[0]!.st).toBe('o');
    expect(nw[1]!.st).toBe('f');
    const ol = b.rows.filter((r) => r.clientId === 'e2');
    expect(ol.length).toBeGreaterThan(0);
    expect(ol.every((r) => r.cal && r.st === 'c' && r.due >= TODAY)).toBe(true);
    expect(new Set(ol.map((r) => r.id)).size).toBe(ol.length);
    expect(b.fallback.map((c) => c.id)).toEqual(['e2']);
    expect(b.fallback[0]!.fallback).toBe('pre');
    expect(b.byId.e1!.leadName).toBe('Arjun Mehta');
  });

  it('follows the Stage filter and keeps register rows of a company off the roster', () => {
    const cmp = book([reg('r1', 'e1', '2026-10-20'), reg('r9', 'e9', '2026-10-25')], 'cmp');
    expect(cmp.clients.map((c) => c.id).sort()).toEqual(['e1', 'e9']);
    expect(cmp.rows.some((r) => r.clientId === 'e2')).toBe(false);
    const inc = book([reg('r1', 'e1', '2026-10-20')], 'inc');
    expect(inc.clients.map((c) => c.id)).toEqual(['e2']);
  });

  it('drops register rows outside the financial year', () => {
    const b = book([reg('r1', 'e1', '2027-04-20')]);
    expect(b.rows.some((r) => r.id === 'r1')).toBe(false);
  });
});

describe('filters and counts', () => {
  const b = book([reg('r1', 'e1', '2026-10-20'), reg('r2', 'e1', '2026-11-02'), reg('r3', 'e1', '2026-10-05', { filedOn: '2026-10-07', frequency: 'quarterly' })]);
  it('status params keep the live values', () => {
    expect(parseStatus('due-soon')).toBe('d');
    expect(parseStatus('filed')).toBe('f');
    expect(parseStatus('nonsense')).toBe('all');
    expect(statusParam('c')).toBe('calendar');
  });
  it('filters by company, status, cadence and month', () => {
    expect(filterRows(b.rows, { company: 'e1', status: 'f' }).map((r) => r.id)).toEqual(['r3']);
    expect(filterRows(b.rows, { company: 'e1', cadence: 'monthly', month: '2026-10' }).map((r) => r.id)).toEqual(['r1']);
    expect(countSt(filterRows(b.rows, { company: 'e1' }))).toMatchObject({ o: 1, d: 1, l: 1 });
  });
  it('next deadline prefers the register; coming up is the next 14 days', () => {
    expect(nextDeadline(b.rows, TODAY)?.id).toBe('r2');
    expect(comingUp(b.rows, TODAY).some((r) => r.id === 'r2')).toBe(true);
    expect(worstOf(['f', 'c', 'd'])).toBe('d');
  });
  it('cadence follows the live tabs', () => {
    expect(cadenceOf('half-yearly')).toBe('quarterly');
    expect(cadenceOf('one-time')).toBe('annual');
  });
});

describe('matrix, csv, words', () => {
  it('builds one matrix row per obligation and client', () => {
    const b = book([reg('r1', 'e1', '2026-10-20'), reg('r2', 'e1', '2026-11-20')]);
    const mx = periodMatrix(b.rows.filter((r) => !r.cal), ['2026-10', '2026-11'], (r) => r.due.slice(0, 7), true);
    expect(mx).toHaveLength(1);
    expect(mx[0]!.cells.map((c) => c?.id)).toEqual(['r1', 'r2']);
  });
  it('escapes csv cells and names the source', () => {
    const b = book([reg('r1', 'e1', '2026-10-20', { particular: '=HYPERLINK("x")' })]);
    const csv = registerCsv(b.rows.filter((r) => r.id === 'r1'));
    expect(csv.split('\r\n')[0]).toContain('Client');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('Register');
  });
  it('words', () => {
    expect(winShort({ from: '2026-10-01', to: '2026-10-20' }, TODAY)).toBe('1–20 Oct');
    expect(moveDay('2026-10-31', 'ArrowRight')).toBeNull();
    expect(moveDay('2026-10-08', 'ArrowUp')).toBe('2026-10-01');
    expect(moveDay('2026-10-08', 'End')).toBe('2026-10-31');
    const b = book([]);
    expect(fallbackLine(b.fallback, b.fyLabel)).toContain('Northwind and Orchid Lane have no filings');
  });
});

function task(id: string, start: string, due: string, extra: Partial<ConsoleTask> = {}): ConsoleTask {
  return {
    id,
    engagementId: 'e1',
    companyName: 'Northwind Technologies Pvt Ltd',
    activityName: 'Monthly MIS',
    name: 'Monthly MIS',
    periodLabel: 'Oct 2026',
    title: 'Monthly MIS · Oct 2026',
    startDate: start,
    dueDate: due,
    urgency: 'High',
    urgencyBars: 3,
    visibility: 'firm',
    stage: 'in-progress',
    stageLabel: 'In progress',
    word: 'In progress',
    hidden: false,
    owner: { id: 'p1', name: 'Arjun Mehta' },
    attachmentCount: 0,
    deliverable: null,
    completedAt: null,
    ...extra,
  };
}

describe('non-statutory tasks (C-1..C-4, F-1..F-3)', () => {
  it('a task sits on its END date, with the start date and urgency as its hover and the six-word chip', () => {
    const t = taskRow(task('t1', '2026-10-20', '2026-11-05'), TODAY);
    expect(t.id).toBe('task:t1');
    expect(t.due).toBe('2026-11-05');
    expect(t.start).toBe('2026-10-20');
    expect(t.hint).toBe('Starts 20 Oct · High');
    expect(t.word).toBe('In progress');
    expect(t.days).toBe(7);
    expect(t.st).toBe('u');
    const it = taskItem(t, true);
    expect(it.kind).toBe('task');
    expect(it.tag).toBe('Task');
    expect(it.area).toBeNull();
    expect(it.due).toBe('2026-11-05');
    expect(it.sub).toBe('Northwind Technologies Pvt Ltd · Arjun Mehta');
    expect(taskPath('/app/manager', 't1')).toBe('/app/manager/compliances/obligations/tasks/t1');
  });

  it('calendar colour by the filing rule: done = filed, past = overdue, within 6 days = due this week', () => {
    expect(taskRow(task('a', '2026-10-01', '2026-10-28'), TODAY).st).toBe('o');
    expect(taskRow(task('b', '2026-10-01', '2026-11-03'), TODAY).st).toBe('d');
    expect(taskRow(task('c', '2026-10-01', '2026-11-30'), TODAY).st).toBe('u');
    const done = taskRow(task('d', '2026-10-01', '2026-10-15', { stage: 'completed', stageLabel: 'Completed', word: 'Done', completedAt: '2026-10-14T10:00:00Z' }), TODAY);
    expect(done.st).toBe('f');
    expect(done.done).toBe(true);
    expect(done.completedOn).toBe('2026-10-14');
  });

  it('rows drop hidden (not applicable) tasks and clients outside the Stage filter, sorted by end date', () => {
    const rows = taskRows(
      [task('late', '2026-10-01', '2026-12-01'), task('na', '2026-10-01', '2026-10-05', { hidden: true }), task('out', '2026-10-01', '2026-10-06', { engagementId: 'e2' }), task('soon', '2026-10-01', '2026-10-30')],
      TODAY,
      (id) => id !== 'e2',
    );
    expect(rows.map((r) => r.taskId)).toEqual(['soon', 'late']);
  });

  it('category switch: ?cat= values, what each shows, and the counts of the window in view', () => {
    expect(parseCat('non-statutory')).toBe('non-statutory');
    expect(parseCat('statutory')).toBe('statutory');
    expect(parseCat('nonsense')).toBe('all');
    expect(catParam('all')).toBeNull();
    expect(catParam('statutory')).toBe('statutory');
    expect(showStat('non-statutory')).toBe(false);
    expect(showTasks('statutory')).toBe(false);
    expect(showStat('all') && showTasks('all')).toBe(true);
    expect(catCounts([1, 2, 3], [1])).toEqual({ all: 4, statutory: 3, 'non-statutory': 1 });
  });

  it('filters tasks by company, end month, done and the register status filter', () => {
    const rows = taskRows(
      [
        task('t1', '2026-10-01', '2026-10-20', { stage: 'completed', word: 'Done', completedAt: '2026-10-19T00:00:00Z' }),
        task('t2', '2026-10-25', '2026-11-20'),
        task('t3', '2026-10-25', '2026-11-02', { engagementId: 'e2', companyName: 'Orchid Lane Foods Pvt Ltd' }),
      ],
      TODAY,
    );
    expect(filterTasks(rows, { company: 'e1' }).map((t) => t.taskId)).toEqual(['t1', 't2']);
    expect(filterTasks(rows, { month: '2026-11' }).map((t) => t.taskId)).toEqual(['t3', 't2']);
    expect(filterTasks(rows, { done: true }).map((t) => t.taskId)).toEqual(['t1']);
    expect(filterTasks(rows, { status: 'f' }).map((t) => t.taskId)).toEqual(['t1']);
    expect(filterTasks(rows, { status: 'd' }).map((t) => t.taskId)).toEqual(['t3']);
    expect(filterTasks(rows, { status: 'c' })).toEqual([]);
    expect(countSt(rows)).toMatchObject({ f: 1, d: 1, u: 1 });
  });

  it('next deadline is the earlier of the next filing and the next open task; coming up lists open tasks of 14 days', () => {
    const b = book([reg('r1', 'e1', '2026-11-10')]);
    const rows = b.rows.filter((r) => !r.cal);
    const tasks = taskRows([task('t1', '2026-10-01', '2026-11-05'), task('done', '2026-10-01', '2026-11-01', { stage: 'completed', word: 'Done' })], TODAY);
    const ni = nextItem(rows, tasks, TODAY);
    expect(ni?.kind).toBe('task');
    expect(ni?.kind === 'task' && ni.t.taskId).toBe('t1');
    expect(nextItem(rows, [], TODAY)).toMatchObject({ kind: 'filing' });
    const later = taskRows([task('t9', '2026-10-01', '2026-12-05')], TODAY);
    expect(nextItem(rows, later, TODAY)).toMatchObject({ kind: 'filing' });
    expect(nextItem([], [], TODAY)).toBeUndefined();
    expect(comingUpTasks(tasks, TODAY).map((t) => t.taskId)).toEqual(['t1']);
  });

  it('timeline bars run from the start date to the end date, clipped to the month', () => {
    const rows = taskRows([task('in', '2026-10-05', '2026-10-12'), task('over', '2026-09-20', '2026-11-03'), task('out', '2026-11-04', '2026-11-20')], TODAY);
    const bars = taskBars(rows, '2026-10');
    expect(bars.map((b) => [b.t.taskId, b.from, b.to, b.cutStart, b.cutEnd])).toEqual([
      ['over', 1, 31, true, true],
      ['in', 5, 12, false, false],
    ]);
    expect(taskBars(rows, '2026-11').map((b) => [b.t.taskId, b.from, b.to])).toEqual([
      ['over', 1, 3],
      ['out', 4, 20],
    ]);
  });
});

describe('SBC master calendar', () => {
  it('a picked company sees only what applies to it; a manager sees what applies to the book', () => {
    const foreign = eng('e3', 'Halcyon Payments India Pvt Ltd', { companyType: 'foreign' });
    const own = sbcRows({ today: TODAY, clients: [{ id: 'e1', e: NW }], company: 'e1' });
    expect(own.some((s) => s.act === 'FEMA')).toBe(false);
    const all = sbcRows({ today: TODAY, clients: [{ id: 'e1', e: NW }, { id: 'e3', e: foreign }] });
    expect(all.some((s) => s.act === 'FEMA' && s.clients.includes('e3'))).toBe(true);
    expect(all.some((s) => s.act === 'RERA')).toBe(false);
    expect(sbcRows({ today: TODAY, clients: [], firmWide: true }).some((s) => s.act === 'RERA')).toBe(true);
  });
});
