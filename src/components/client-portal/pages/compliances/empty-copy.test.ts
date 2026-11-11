import { describe, expect, it } from 'vitest';
import { filingsEmptyMessage, registrationsProgressNotStarted } from './empty-copy';

const base = { rows: 0, category: 'all' as const, fy: 2026, currentFy: 2026, fyLabel: 'FY 2026-27' };

describe('Filings empty message', () => {
  it('tells a client before incorporation that compliances have not started', () => {
    expect(filingsEmptyMessage({ ...base, after: false })).toBe(
      "Your compliances haven't started yet. Your filings will appear here once compliances begin after incorporation.",
    );
  });

  it('shows the message before incorporation even if rows were somehow present', () => {
    expect(filingsEmptyMessage({ ...base, after: false, rows: 5 })).toMatch(/haven't started yet/);
  });

  it('shows nothing once the register has rows', () => {
    expect(filingsEmptyMessage({ ...base, after: true, rows: 3 })).toBeNull();
  });

  it('says compliances have not started for an empty current year after incorporation', () => {
    expect(filingsEmptyMessage({ ...base, after: true })).toBe(
      "Your compliances haven't started yet. Your filings for FY 2026-27 will appear here once SBC starts your compliances.",
    );
  });

  it('says plainly that nothing was due in an empty past year', () => {
    expect(filingsEmptyMessage({ ...base, after: true, fy: 2024, fyLabel: 'FY 2024-25' })).toBe('No filings were due in FY 2024-25.');
  });

  it('speaks of tasks on the non-statutory switch', () => {
    expect(filingsEmptyMessage({ ...base, after: true, category: 'non-statutory' })).toMatch(/^No completed tasks in FY 2026-27/);
  });
});

describe('Registrations progress before anything starts', () => {
  it('mentions incorporation only before it', () => {
    expect(registrationsProgressNotStarted(23, false)).toBe('None of your 23 registrations have started yet. Progress will show here once SBC begins them after incorporation.');
    expect(registrationsProgressNotStarted(1, true)).toBe("Your registration hasn't started yet. Progress will show here once SBC begins it.");
  });
});
