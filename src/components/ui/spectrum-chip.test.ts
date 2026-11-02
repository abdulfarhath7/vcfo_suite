import { describe, expect, it } from 'vitest';
import { statusWord, toneFor } from './spectrum-chip';

describe('toneFor (R-13)', () => {
  it('keeps "Not started" grey even though it contains "started"', () => {
    expect(toneFor('Not started')).toBe('idle');
    expect(toneFor('not-started')).toBe('idle');
    expect(toneFor('Not due')).toBe('idle');
    expect(toneFor('Not asked')).toBe('idle');
    expect(toneFor('Upcoming')).toBe('idle');
  });

  it('gives the other five words their tones', () => {
    expect(toneFor('In progress')).toBe('prog');
    expect(toneFor('Waiting')).toBe('teal');
    expect(toneFor('Due soon')).toBe('warn');
    expect(toneFor('Overdue')).toBe('bad');
    expect(toneFor('Done')).toBe('ok');
  });

  it('collapses synonyms to the six words', () => {
    expect(statusWord('Upcoming')).toBe('Not started');
    expect(statusWord('Filed')).toBe('Done');
  });
});
