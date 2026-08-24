import { describe, expect, it } from 'vitest';
import { ACT_SWATCH } from '@/data/statutory-calendar-fy2627';
import {
  dateHasAgendaItems,
  isSelectAllActive,
  selectAllActs,
  statutoryAgendaId,
  toggleMutedAct,
} from './statutory-calendar-utils';

const ACTS = ['GST', 'IT', 'MCA'] as const;

describe('statutoryAgendaId', () => {
  it('uses a stable prefix the agenda groups can match', () => {
    expect(statutoryAgendaId('2026-08-05')).toBe('statutory-agenda-2026-08-05');
  });
});

describe('select-all chips', () => {
  it('starts selected when nothing is muted', () => {
    expect(isSelectAllActive(new Set())).toBe(true);
  });

  it('unselects when any category is muted', () => {
    expect(isSelectAllActive(toggleMutedAct(new Set<string>(), 'GST'))).toBe(false);
  });

  it('reselects after every muted category is turned back on', () => {
    let muted = toggleMutedAct(new Set<string>(), 'GST');
    muted = toggleMutedAct(muted, 'GST');
    expect(isSelectAllActive(muted)).toBe(true);
  });

  it('select-all click clears mutes even after a partial toggle', () => {
    let muted: Set<(typeof ACTS)[number]> = toggleMutedAct(new Set<(typeof ACTS)[number]>(), 'IT');
    expect(isSelectAllActive(muted)).toBe(false);
    muted = selectAllActs();
    expect(isSelectAllActive(muted)).toBe(true);
    expect(muted.size).toBe(0);
  });
});

describe('act swatches', () => {
  it('gives every statutory act a unique solid class', () => {
    const solids = Object.values(ACT_SWATCH).map((s) => s.solid);
    expect(new Set(solids).size).toBe(solids.length);
    expect(solids).toHaveLength(8);
  });
});

describe('dateHasAgendaItems', () => {
  it('is true only when the day has a non-empty list', () => {
    const byDate = new Map<string, readonly string[]>([
      ['2026-08-05', ['a']],
      ['2026-08-06', []],
    ]);
    expect(dateHasAgendaItems('2026-08-05', byDate)).toBe(true);
    expect(dateHasAgendaItems('2026-08-06', byDate)).toBe(false);
    expect(dateHasAgendaItems('2026-08-07', byDate)).toBe(false);
  });
});
