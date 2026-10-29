import { describe, expect, it } from 'vitest';
import { dueNudgeToday, personalRemindDays, reminderIsDue, reminderSendDay } from '@/lib/notify/reminder-days';

describe('reminder days', () => {
  it('accepts only 7, 3 or 1 as a personal choice', () => {
    expect(personalRemindDays(3)).toBe(3);
    expect(personalRemindDays(5)).toBeNull();
    expect(personalRemindDays(null)).toBeNull();
  });

  it('keeps the stored day when the person has no choice', () => {
    const r = { remindOn: '2026-10-13', dueDate: '2026-10-20', remindDays: null };
    expect(reminderSendDay(r)).toBe('2026-10-13');
    expect(reminderIsDue(r, '2026-10-12')).toBe(false);
    expect(reminderIsDue(r, '2026-10-13')).toBe(true);
  });

  it('reminds due − N days for a personal choice', () => {
    const r = { remindOn: '2026-10-13', dueDate: '2026-10-20', remindDays: 1 };
    expect(reminderSendDay(r)).toBe('2026-10-19');
    expect(reminderIsDue(r, '2026-10-13')).toBe(false);
    expect(reminderIsDue(r, '2026-10-19')).toBe(true);
  });

  it('nudges on the default days, or on the person’s own day for any frequency', () => {
    expect(dueNudgeToday(null, 'monthly', 5)).toBe(true);
    expect(dueNudgeToday(null, 'quarterly', 7)).toBe(true);
    expect(dueNudgeToday(null, 'annual', 7)).toBe(false);
    expect(dueNudgeToday(3, 'monthly', 5)).toBe(false);
    expect(dueNudgeToday(3, 'monthly', 3)).toBe(true);
    expect(dueNudgeToday(7, 'annual', 7)).toBe(true);
  });
});
