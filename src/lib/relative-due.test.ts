import { describe, expect, it } from 'vitest';
import { daysUntil, exactDate, relativeDue } from './relative-due';

const now = new Date(2026, 9, 16, 15, 30); // Fri 16 Oct 2026, 15:30 local

describe('relativeDue', () => {
  it('says Today for the same calendar day, whatever the time', () => {
    expect(relativeDue(new Date(2026, 9, 16, 0, 1), now)).toBe('Today');
    expect(relativeDue(new Date(2026, 9, 16, 23, 59), now)).toBe('Today');
    expect(relativeDue('2026-10-16', now)).toBe('Today');
  });

  it('says Tomorrow and In n days for future dates', () => {
    expect(relativeDue('2026-10-17', now)).toBe('Tomorrow');
    expect(relativeDue('2026-10-19', now)).toBe('In 3 days');
    expect(relativeDue('2026-11-16', now)).toBe('In 31 days');
  });

  it('says how late a past date is', () => {
    expect(relativeDue('2026-10-15', now)).toBe('1 day late');
    expect(relativeDue('2026-10-14', now)).toBe('2 days late');
  });

  it('counts calendar days across a month end', () => {
    expect(relativeDue('2026-11-01', new Date(2026, 9, 31, 23, 0))).toBe('Tomorrow');
  });

  it('returns an empty string for a date it cannot read', () => {
    expect(relativeDue('not a date', now)).toBe('');
    expect(daysUntil('not a date', now)).toBeNull();
  });
});

describe('exactDate', () => {
  it('prints the weekday, day, short month and year', () => {
    expect(exactDate('2026-10-19')).toBe('Mon 19 Oct 2026');
    expect(exactDate(new Date(2026, 0, 1))).toBe('Thu 1 Jan 2026');
  });

  it('reads a full ISO timestamp too', () => {
    expect(exactDate(new Date(2026, 9, 19, 10).toISOString())).toBe('Mon 19 Oct 2026');
  });

  it('returns an empty string for a bad date', () => {
    expect(exactDate('')).toBe('');
  });
});
