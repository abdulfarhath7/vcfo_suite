import { describe, expect, it } from 'vitest';
import { sep, time24 } from './date-format';

describe('sep', () => {
  it('writes Sep, not Sept', () => {
    expect(sep('14 Sept 2026')).toBe('14 Sep 2026');
    expect(sep('Sept')).toBe('Sep');
  });
  it('leaves other words alone', () => {
    expect(sep('September')).toBe('September');
    expect(sep('Septic tank')).toBe('Septic tank');
  });
});

describe('time24', () => {
  it('uses a 24-hour clock', () => {
    expect(time24(new Date('2026-10-27T10:12:00Z'))).toBe('15:42');
  });
});
