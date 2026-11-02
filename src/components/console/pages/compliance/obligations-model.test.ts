import { describe, expect, it } from 'vitest';
import type { TaskRowDto } from '@/views/compliances/tasks/api';
import type { CRow } from './model';
import {
  blockedLine,
  dueWords,
  flowCounts,
  groupObligations,
  groupTasksByWeek,
  parseTaskFilters,
  startWords,
  statMatches,
  statStageChoices,
  statWord,
  taskMatches,
  taskQuery,
  taskStageChoices,
} from './obligations-model';

function row(id: string, clientId: string, due: string, extra: Partial<CRow> & { obligationId?: string; rawStatus?: string } = {}): CRow {
  const { obligationId = 'gst-gstr-3b', rawStatus = 'pending', ...rest } = extra;
  const days = Math.round((Date.parse(due) - Date.parse('2026-10-29')) / 864e5);
  return {
    id,
    clientId,
    clientName: clientId === 'a' ? 'Acme' : 'Zed',
    due,
    st: rest.filedOn ? 'f' : days < 0 ? 'o' : days <= 6 ? 'd' : 'u',
    days,
    area: 'GST',
    name: 'GSTR-3B',
    particular: 'GSTR-3B',
    period: '',
    freq: 'Monthly',
    freqLabel: 'Monthly',
    cadence: 'monthly',
    authority: 'GST',
    authorityName: 'GST department',
    cal: false,
    proofs: 0,
    reg: { obligationId, rawStatus } as CRow['reg'],
    ...rest,
  } as CRow;
}

const task = (id: string, week: TaskRowDto['week'], dueDate: string, extra: Partial<TaskRowDto> = {}): TaskRowDto =>
  ({ id, week, dueDate, title: id, word: 'Not started', stage: 'not-started', hidden: false, completedAt: null, ...extra }) as TaskRowDto;

describe('statutory grouping', () => {
  it('bands each obligation on its earliest unfiled period and counts filed clients of that period', () => {
    const rows = [
      row('1', 'a', '2026-10-20', { filedOn: '2026-10-18' }),
      row('2', 'z', '2026-10-20'),
      row('3', 'a', '2026-11-20'),
      row('4', 'a', '2026-10-15', { obligationId: 'it-tds', filedOn: '2026-10-14' }),
    ];
    const groups = groupObligations(rows);
    expect(groups.map((g) => g.obligationId)).toEqual(['it-tds', 'gst-gstr-3b']);
    const gst = groups[1]!;
    expect(gst.dueDate).toBe('2026-10-20');
    expect(gst.total).toBe(2);
    expect(gst.filed).toBe(1);
    expect(gst.st).toBe('o');
    expect(gst.instances).toHaveLength(3);
    const acme = gst.rows.find((x) => x.r.clientId === 'a')!;
    expect(acme.lastFiled).toBe('2026-10-18');
    expect(acme.nextDue).toBe('2026-11-20');
    // a filed obligation bands on its latest period
    expect(groups[0]!.dueDate).toBe('2026-10-15');
    expect(groups[0]!.st).toBe('f');
  });

  it('skips SBC calendar lines (no register row yet)', () => {
    const line = { ...row('c', 'a', '2026-12-01'), cal: true, reg: undefined } as CRow;
    expect(groupObligations([line])).toEqual([]);
  });

  it('reads the six words from the row', () => {
    expect(statWord(row('1', 'a', '2026-10-10', { filedOn: '2026-10-09' }))).toBe('Done');
    expect(statWord(row('1', 'a', '2026-10-10'))).toBe('Overdue');
    expect(statWord(row('1', 'a', '2026-11-01'))).toBe('Due soon');
    expect(statWord(row('1', 'a', '2026-12-20', { rawStatus: 'in-progress' }))).toBe('In progress');
    expect(statWord(row('1', 'a', '2026-12-20'))).toBe('Not started');
  });

  it('matches the strip keys', () => {
    const [g] = groupObligations([row('1', 'a', '2026-11-05', { portal: { dataReceivedOn: null } as CRow['portal'] })]);
    const x = g!.rows[0]!;
    expect(statMatches(x, '')).toBe(true);
    expect(statMatches(x, 'soon')).toBe(true);
    expect(statMatches(x, 'waiting')).toBe(true);
    expect(statMatches(x, 'overdue')).toBe(false);
    expect(statMatches(x, 'done')).toBe(false);
  });

  it('counts the progress flow from the portal facts', () => {
    const rows = [
      row('1', 'a', '2026-10-20', { filedOn: '2026-10-18', portal: { acknowledgementNo: 'ARN1' } as CRow['portal'] }),
      row('2', 'z', '2026-10-20', { filedOn: '2026-10-18', portal: { acknowledgementNo: null } as CRow['portal'] }),
      row('3', 'a', '2026-11-20', { portal: { dataReceivedOn: '2026-11-01' } as CRow['portal'] }),
      row('4', 'z', '2026-11-20', { portal: { dataReceivedOn: null } as CRow['portal'] }),
      row('5', 'z', '2026-12-20'),
    ];
    expect(flowCounts(rows)).toEqual({ data: 1, prepared: 1, filed: 1, acknowledged: 1 });
  });
});

describe('task grouping', () => {
  it('groups by the server week, due date first, Done latest first, hidden rows out', () => {
    const groups = groupTasksByWeek([
      task('b', 'This week', '2026-10-30'),
      task('a', 'This week', '2026-10-29'),
      task('n', 'Next week', '2026-11-04'),
      task('d1', 'Done', '2026-10-01', { word: 'Done', stage: 'completed', completedAt: '2026-10-02T10:00:00Z' }),
      task('d2', 'Done', '2026-10-05', { word: 'Done', stage: 'completed', completedAt: '2026-10-06T10:00:00Z' }),
      task('na', 'Later', '2026-12-01', { hidden: true }),
    ]);
    expect(groups.map((g) => [g.key, g.rows.map((r) => r.id)])).toEqual([
      ['This week', ['a', 'b']],
      ['Next week', ['n']],
      ['Later', []],
      ['Done', ['d2', 'd1']],
    ]);
  });

  it('matches the strip keys from word, week and stage', () => {
    const t = task('t', 'This week', '2026-10-30', { word: 'Not started', stage: 'ready' });
    expect(taskMatches(t, 'soon')).toBe(true);
    expect(taskMatches(t, 'none')).toBe(true);
    expect(taskMatches({ ...t, word: 'Overdue' }, 'overdue')).toBe(true);
    expect(taskMatches({ ...t, word: 'Overdue' }, 'none')).toBe(false);
    expect(taskMatches({ ...t, word: 'Waiting', stage: 'waiting' }, 'waiting')).toBe(true);
    expect(taskMatches({ ...t, word: 'Done', stage: 'completed', week: 'Done' }, 'done')).toBe(true);
  });

  it('reads and writes the API filters', () => {
    const f = parseTaskFilters((k) => ({ status: 'Overdue', urgency: 'High', vis: 'firm', mine: '1' })[k] ?? null, 'e1');
    expect(f).toEqual({ engagementId: 'e1', status: 'Overdue', urgency: 'High', visibility: 'firm', mine: true });
    expect(taskQuery(f)).toBe('?engagementId=e1&status=Overdue&urgency=High&visibility=firm&mine=1');
    expect(parseTaskFilters((k) => ({ status: 'Nope', vis: 'x' })[k] ?? null)).toEqual({ engagementId: undefined, status: '', urgency: '', visibility: '', mine: false });
    expect(taskQuery({})).toBe('');
  });
});

describe('stages and words', () => {
  it('offers the stages the API allows the role', () => {
    expect(taskStageChoices('ready', false)).toEqual(['not-started', 'ready', 'in-progress', 'waiting']);
    expect(taskStageChoices('review', false)[0]).toBe('review');
    expect(taskStageChoices('in-progress', true)).toContain('completed');
    expect(statStageChoices('in-progress', true)).not.toContain('completed');
    expect(statStageChoices('in-progress', true)).toContain('not-applicable');
    expect(statStageChoices('in-progress', false)).not.toContain('not-applicable');
  });

  it('writes due, start and blocked lines', () => {
    expect(dueWords(-1)).toBe('1 day late');
    expect(dueWords(-3)).toBe('3 days late');
    expect(dueWords(0)).toBe('Due today');
    expect(dueWords(1)).toBe('Due tomorrow');
    expect(dueWords(4)).toBe('Due in 4 days');
    expect(startWords(-2)).toBe('Started 2 days ago');
    expect(startWords(0)).toBe('Starts today');
    expect(startWords(3)).toBe('Starts in 3 days');
    expect(blockedLine([])).toBeNull();
    expect(blockedLine(['owner', 'activity not confirmed'])).toBe('Reminders are on hold until these are set: owner, activity not confirmed.');
  });
});
