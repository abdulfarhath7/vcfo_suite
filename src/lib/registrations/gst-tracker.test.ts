import { describe, expect, it } from 'vitest';
import { GST_FIELD, fmtLong, gstDueToday, gstNotice, gstSchedule, gstStages } from './gst-tracker';

const rule = { kind: 'fixed-window-weeks', weeks: 2 } as const;
const window = (from: string, to: string) => ({ steps: { 'reg-4': { from, to, setBy: 'm', setAt: 'x' } } });

describe('gstSchedule', () => {
  it('takes the day scheduled on the firm calendar', () => {
    expect(gstSchedule({ schedule: window('2026-11-18', '2026-11-25'), incorporationDate: '2026-10-01', rule })).toEqual({
      date: '2026-11-18',
      source: 'calendar',
    });
  });

  it('shows the statutory deadline until the day is scheduled', () => {
    expect(gstSchedule({ schedule: null, incorporationDate: '2026-10-01', rule })).toEqual({ date: '2026-10-15', source: 'deadline' });
  });

  it('has no date without either', () => {
    expect(gstSchedule({ schedule: null, incorporationDate: null, rule })).toEqual({ date: null, source: null });
  });
});

describe('gstStages', () => {
  it('marks the first open stage current and the rest not started', () => {
    expect(gstStages({}).map((s) => s.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('moves through ARN, Aadhaar and SRN to an approved outcome', () => {
    const values = { [GST_FIELD.arn]: 'AA29', [GST_FIELD.aadhaar]: 'done', [GST_FIELD.srn]: '123' };
    expect(gstStages(values).map((s) => s.state)).toEqual(['done', 'done', 'done', 'current']);
    expect(gstStages({ ...values, [GST_FIELD.outcome]: 'approved', [GST_FIELD.gstin]: '29AABCS1429B1Z1' }).every((s) => s.state === 'done')).toBe(true);
  });

  it('treats Aadhaar "pending" as yet to be done', () => {
    expect(gstStages({ [GST_FIELD.arn]: 'AA29', [GST_FIELD.aadhaar]: 'pending' })[1]?.state).toBe('current');
  });

  it('flags a resubmission', () => {
    expect(gstStages({ [GST_FIELD.outcome]: 'resubmission' })[3]?.state).toBe('attention');
  });
});

describe('gstNotice', () => {
  const scheduled = { date: '2026-11-18', source: 'calendar' as const };

  it('announces the scheduled day with the LUT', () => {
    expect(gstNotice(scheduled, {}, '2026-11-10')?.text).toBe('GST registration is scheduled for 18 Nov 2026. The LUT is filed the same day.');
  });

  it('prompts the firm on the day and flags a missed day', () => {
    expect(gstNotice(scheduled, {}, '2026-11-18')).toEqual({
      tone: 'warning',
      text: 'Scheduled for today: file the GST application and the LUT, then record the ARN.',
    });
    expect(gstNotice(scheduled, {}, '2026-11-19')?.tone).toBe('danger');
  });

  it('says plainly when the day is not scheduled yet', () => {
    const deadline = { date: '2026-10-15', source: 'deadline' as const };
    expect(gstNotice(deadline, {}, '2026-10-10')?.text).toBe('Not yet scheduled on the firm calendar. The statutory deadline is 15 Oct 2026.');
    expect(gstNotice(deadline, {}, '2026-10-10', 'client')?.text).toBe('Being scheduled. The statutory deadline is 15 Oct 2026.');
  });

  it('gives the client facts without the firm instructions', () => {
    expect(gstNotice(scheduled, {}, '2026-11-18', 'client')?.text).toBe('GST registration is scheduled for today.');
    expect(gstNotice(scheduled, { [GST_FIELD.outcome]: 'resubmission' }, '2026-11-26', 'client')?.text).toBe('Resubmission required.');
  });

  it('reports the outcome and is silent between filing and the decision', () => {
    expect(gstNotice(scheduled, { [GST_FIELD.outcome]: 'approved', [GST_FIELD.gstin]: '29AABCS1429B1Z1' }, '2026-12-01')?.text).toBe(
      'Registration approved. GSTIN 29AABCS1429B1Z1.',
    );
    expect(gstNotice(scheduled, { [GST_FIELD.outcome]: 'resubmission', [GST_FIELD.revisedDate]: '2026-12-05' }, '2026-12-01')?.text).toBe(
      'Resubmission required by 5 Dec 2026.',
    );
    expect(gstNotice(scheduled, { [GST_FIELD.arn]: 'AA29' }, '2026-11-30')).toBeNull();
  });
});

describe('gstDueToday', () => {
  it('fires only on a calendar-scheduled day with nothing filed', () => {
    const scheduled = { date: '2026-11-18', source: 'calendar' as const };
    expect(gstDueToday(scheduled, {}, '2026-11-18')).toBe(true);
    expect(gstDueToday(scheduled, { [GST_FIELD.arn]: 'AA29' }, '2026-11-18')).toBe(false);
    expect(gstDueToday(scheduled, {}, '2026-11-19')).toBe(false);
    expect(gstDueToday({ date: '2026-11-18', source: 'deadline' }, {}, '2026-11-18')).toBe(false);
  });

  it('formats dates the way the page shows them', () => {
    expect(fmtLong('2026-11-18')).toBe('18 Nov 2026');
  });
});
