import { describe, expect, it } from 'vitest';
import { countdownLabel, dinsFromState, IDENTIFIER_REVEAL_MS, revealExpiresAt, revealUntil } from './identifiers';

describe('dinsFromState', () => {
  it('lists each pre-15 director with a DIN, in order, skipping blanks and repeats', () => {
    const state = {
      'pre-15': {
        responses: {
          directors: 'a,b,c',
          'directors.a.firstName': 'Asha',
          'directors.a.lastName': 'Rao',
          'directors.a.din': '0123 4567',
          'directors.b.firstName': 'Vikram',
          'directors.b.din': '',
          'directors.c.firstName': 'Meera',
          'directors.c.din': '01234567',
        },
      },
    };
    expect(dinsFromState(state as never)).toEqual([{ name: 'Asha Rao', din: '01234567' }]);
  });

  it('reads the legacy Part A slots when pre-15 has no entries', () => {
    const state = {
      'pre-1': {
        responses: {
          numberOfDirectors: '2',
          director1FirstName: 'Ravi',
          director1Din: '07654321',
          director2FirstName: 'Sana',
        },
      },
    };
    const dins = dinsFromState(state as never);
    expect(dins.map((d) => d.din)).toEqual(['07654321']);
  });

  it('is empty with no answers', () => {
    expect(dinsFromState({})).toEqual([]);
    expect(dinsFromState(null)).toEqual([]);
  });
});

describe('reveal window', () => {
  const now = Date.parse('2026-10-29T10:00:00.000Z');

  it('expires one window after the reveal', () => {
    expect(Date.parse(revealExpiresAt(now)) - now).toBe(IDENTIFIER_REVEAL_MS);
  });

  it('trusts a server expiry inside the window and clamps anything else', () => {
    expect(revealUntil(new Date(now + 30_000).toISOString(), now)).toBe(now + 30_000);
    expect(revealUntil(new Date(now + 10 * 60_000).toISOString(), now)).toBe(now + IDENTIFIER_REVEAL_MS);
    expect(revealUntil(new Date(now - 1).toISOString(), now)).toBe(now + IDENTIFIER_REVEAL_MS);
    expect(revealUntil(undefined, now)).toBe(now + IDENTIFIER_REVEAL_MS);
    expect(revealUntil('nonsense', now)).toBe(now + IDENTIFIER_REVEAL_MS);
  });

  it('formats the seconds left', () => {
    expect(countdownLabel(now + 42_000, now)).toBe('0:42');
    expect(countdownLabel(now + 60_000, now)).toBe('1:00');
    expect(countdownLabel(now + 400, now)).toBe('0:01');
    expect(countdownLabel(now - 5_000, now)).toBe('0:00');
  });
});
