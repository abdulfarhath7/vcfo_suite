import { describe, expect, it } from 'vitest';
import { ACT_SWATCH } from '@/data/statutory-calendar-fy2627';
import {
  dateHasAgendaItems,
  isSelectAllActive,
  muteAllActs,
  selectAllActs,
  statutoryAgendaId,
  statutoryCellWash,
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

  it('all-on click mutes every act', () => {
    expect(isSelectAllActive(selectAllActs())).toBe(true);
    const muted = muteAllActs(ACTS);
    expect(isSelectAllActive(muted)).toBe(false);
    expect(muted.size).toBe(ACTS.length);
    for (const act of ACTS) expect(muted.has(act)).toBe(true);
  });

  it('all-muted click restores select-all', () => {
    let muted: Set<(typeof ACTS)[number]> = muteAllActs(ACTS);
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

describe('statutoryCellWash', () => {
  it('uses that act’s soft wash for a single-act day', () => {
    expect(statutoryCellWash(['GST'])).toBe(ACT_SWATCH.GST.soft);
  });

  it('uses the first act’s soft wash on multi-act days (no blend)', () => {
    expect(statutoryCellWash(['FEMA', 'IT', 'STPI/SEZ'])).toBe(ACT_SWATCH.FEMA.soft);
    expect(statutoryCellWash(['GST', 'LABOUR', 'STPI/SEZ'])).toBe(ACT_SWATCH.GST.soft);
  });

  it('returns null when the day has no acts', () => {
    expect(statutoryCellWash([])).toBeNull();
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
