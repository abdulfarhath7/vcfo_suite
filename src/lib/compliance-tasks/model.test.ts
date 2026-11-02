import { describe, expect, it } from 'vitest';
import {
  addMonthsIso,
  currentFyRange,
  nextOccurrence,
  periodLabelFor,
  reminderBlockers,
  reminderSchedule,
  remindersDueToday,
  repeatsOfFrequency,
  stageFromRegister,
  statusWord,
  statutorySteps,
  taskSteps,
  weekGroup,
} from './model';

describe('status words (R-13, COMPLIANCE-MODEL 3.3)', () => {
  it('maps the eight stages to the six words and derives Due soon and Overdue from the date', () => {
    expect(statusWord('completed', '2026-10-01', 5, '2026-10-30')).toBe('Done');
    expect(statusWord('in-progress', '2026-10-29', 5, '2026-10-30')).toBe('Overdue');
    expect(statusWord('not-started', '2026-11-02', 5, '2026-10-30')).toBe('Due soon');
    expect(statusWord('ready', '2026-11-20', 5, '2026-10-30')).toBe('Not started');
    expect(statusWord('review', '2026-11-02', 5, '2026-10-30')).toBe('In progress');
    expect(statusWord('rework', '2026-11-20', 5, '2026-10-30')).toBe('In progress');
    expect(statusWord('waiting', '2026-11-02', 5, '2026-10-30')).toBe('Waiting');
  });

  it('groups by end-date week starting on Monday (S-3)', () => {
    // Fri 30 Oct 2026; that week's Monday is 26 Oct.
    expect(weekGroup('in-progress', '2026-11-01', '2026-10-30')).toBe('This week');
    expect(weekGroup('in-progress', '2026-11-02', '2026-10-30')).toBe('Next week');
    expect(weekGroup('in-progress', '2026-11-09', '2026-10-30')).toBe('Later');
    expect(weekGroup('completed', '2026-11-01', '2026-10-30')).toBe('Done');
  });

  it('reads the register status when there is no workflow row', () => {
    expect(stageFromRegister('filed', null)).toBe('completed');
    expect(stageFromRegister('upcoming', '2026-10-01')).toBe('completed');
    expect(stageFromRegister('in-progress', null)).toBe('in-progress');
    expect(stageFromRegister('overdue', null)).toBe('not-started');
  });
});

describe('repeats (DR-04)', () => {
  it('shifts by one interval and clamps month ends', () => {
    expect(nextOccurrence({ startDate: '2026-10-12', dueDate: '2026-10-19', repeats: 'weekly' })).toEqual({ startDate: '2026-10-19', dueDate: '2026-10-26' });
    expect(nextOccurrence({ startDate: '2026-10-12', dueDate: '2026-10-19', repeats: 'bi-weekly' })).toEqual({ startDate: '2026-10-26', dueDate: '2026-11-02' });
    expect(nextOccurrence({ startDate: '2026-01-01', dueDate: '2026-01-31', repeats: 'monthly' })).toEqual({ startDate: '2026-02-01', dueDate: '2026-02-28' });
    expect(nextOccurrence({ startDate: '2026-07-01', dueDate: '2026-07-31', repeats: 'quarterly' })).toEqual({ startDate: '2026-10-01', dueDate: '2026-10-31' });
    expect(nextOccurrence({ startDate: '2026-04-01', dueDate: '2026-04-30', repeats: 'yearly' })).toEqual({ startDate: '2027-04-01', dueDate: '2027-04-30' });
    expect(nextOccurrence({ startDate: '2026-04-01', dueDate: '2026-04-30', repeats: 'one-time' })).toBeNull();
    expect(addMonthsIso('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('labels the period and takes the default from the frequency', () => {
    expect(periodLabelFor('monthly', '2026-10-05')).toBe('Oct 2026');
    expect(periodLabelFor('weekly', '2026-10-12')).toBe('Week of 12 Oct');
    expect(periodLabelFor('quarterly', '2026-10-01')).toBe('Q3 2026-27');
    expect(periodLabelFor('quarterly', '2027-02-01')).toBe('Q4 2026-27');
    expect(periodLabelFor('yearly', '2027-02-01')).toBe('FY 2026-27');
    expect(periodLabelFor('one-time', '2027-02-01')).toBeNull();
    expect(repeatsOfFrequency('Weekly')).toBe('weekly');
    expect(repeatsOfFrequency('Half-yearly')).toBe('one-time');
    expect(currentFyRange('2026-10-30')).toEqual({ from: '2026-04-01', to: '2027-03-31' });
  });
});

describe('the six reminders (COMPLIANCE-MODEL 3.4)', () => {
  const base = { dueDate: '2026-11-20', notifyDays: 10, overrides: [], sends: [], done: false, blocked: false };

  it('dates each reminder from the due date', () => {
    const rows = reminderSchedule(base);
    expect(rows.map((r) => [r.key, r.date])).toEqual([
      ['initial', '2026-11-10'],
      ['due-soon', '2026-11-17'],
      ['due-date', '2026-11-20'],
      ['overdue', '2026-11-21'],
      ['escalate-reviewer', '2026-11-22'],
      ['escalate-admin', '2026-11-25'],
    ]);
    expect(rows.filter((r) => r.internal).map((r) => r.key)).toEqual(['escalate-reviewer', 'escalate-admin']);
    expect(reminderSchedule({ ...base, notifyDays: 2 })[1]!.offsetDays).toBe(-1);
  });

  it('applies overrides, sends and blockers', () => {
    const rows = reminderSchedule({
      ...base,
      overrides: [{ key: 'initial', offsetDays: -15, enabled: true }, { key: 'escalate-admin', offsetDays: null, enabled: false }],
      sends: [{ key: 'initial', sentAt: '2026-11-05T03:00:00.000Z', read: true }],
      blocked: true,
    });
    expect(rows[0]).toMatchObject({ date: '2026-11-05', overridden: true, state: 'acknowledged' });
    expect(rows[5]).toMatchObject({ enabled: false, overridden: true, state: 'blocked' });
    expect(reminderSchedule({ ...base, done: true })[3]!.state).toBe('skipped');
  });

  it('fires each reminder on its day and the overdue one daily for 30 days', () => {
    const rows = reminderSchedule(base);
    expect(remindersDueToday(rows, base.dueDate, '2026-11-10')).toEqual(['initial']);
    expect(remindersDueToday(rows, base.dueDate, '2026-11-20')).toEqual(['due-date']);
    expect(remindersDueToday(rows, base.dueDate, '2026-11-22')).toEqual(['overdue', 'escalate-reviewer']);
    expect(remindersDueToday(rows, base.dueDate, '2026-12-20')).toEqual(['overdue']);
    expect(remindersDueToday(rows, base.dueDate, '2026-12-21')).toEqual([]);
    const off = reminderSchedule({ ...base, overrides: [{ key: 'initial', offsetDays: null, enabled: false }] });
    expect(remindersDueToday(off, base.dueDate, '2026-11-10')).toEqual([]);
  });

  it('holds reminders until the set-up is complete (DR-22)', () => {
    const ok = { engagementId: 'e', stage: 'in-progress' as const, ownerId: 'o', prepDate: '2026-11-01', dueDate: '2026-11-20', confirmPending: false };
    expect(reminderBlockers(ok)).toEqual([]);
    expect(reminderBlockers({ ...ok, ownerId: null, confirmPending: true })).toEqual(['owner', 'activity not confirmed']);
    expect(reminderBlockers({ ...ok, stage: 'not-applicable', prepDate: null })).toEqual(['not applicable', 'preparation date']);
  });
});

describe('progress steps', () => {
  it('marks done steps and the next one as now (4.3)', () => {
    const steps = taskSteps({
      stage: 'review',
      createdBy: 'Pranay',
      createdAt: '2026-10-10T00:00:00.000Z',
      owner: 'Bharath',
      reviewer: 'Pranay',
      checklistDone: 2,
      checklistTotal: 3,
      submittedAt: '2026-10-15T00:00:00.000Z',
      completedAt: null,
      approvedBy: null,
      firstAttachment: null,
    });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'now']);
    expect(steps[2]!.evidence).toBe('2 of 3 checklist items');
  });

  it('derives the six statutory steps from real dates only (D-3)', () => {
    const base = {
      stage: 'in-progress' as const,
      clientShort: 'Acme',
      owner: 'Bharath',
      reviewer: 'Pranay',
      authority: 'GSTN',
      docsAsked: 2,
      docsAccepted: 1,
      dataReceivedOn: null,
      preparingSince: null,
      submittedAt: null,
      submittedBy: null,
      approvedOn: null,
      filedOn: null,
      filedBy: null,
      challan: null,
      acknowledgementNo: null,
      ackProof: null,
    };
    expect(statutorySteps(base).map((s) => s.state)).toEqual(['now', 'next', 'next', 'next', 'next', 'next']);
    const filed = statutorySteps({ ...base, stage: 'completed', filedOn: '2026-10-19', acknowledgementNo: 'AA36' });
    expect(filed.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'done']);
    expect(filed[5]!.evidence).toBe('AA36');
  });
});
