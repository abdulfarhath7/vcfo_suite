/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeView,
  addSavedView,
  isNewSince,
  readDensity,
  readSavedViews,
  resetVisitCache,
  sameFilters,
  savedViewsKey,
  takeLastVisit,
  visitKey,
  writeDensity,
  writeSavedViews,
  type SavedView,
} from './table-prefs';

const defaults: SavedView[] = [
  { key: 'all', label: 'All', filters: {} },
  { key: 'overdue', label: 'My overdue', filters: { status: 'Overdue', mine: '1' } },
];

beforeEach(() => {
  window.localStorage.clear();
  resetVisitCache();
});
afterEach(() => vi.restoreAllMocks());

describe('saved views', () => {
  it('treats a missing key as an empty value', () => {
    expect(sameFilters({ status: '' }, {})).toBe(true);
    expect(sameFilters({ status: 'Done' }, {})).toBe(false);
    expect(activeView(defaults, { mine: '1', status: 'Overdue' })).toBe('overdue');
    expect(activeView(defaults, {})).toBe('all');
    expect(activeView(defaults, { status: 'Done' })).toBe('');
  });

  it('round-trips views through localStorage', () => {
    const next = addSavedView([], ' GST only ', { area: 'gst' }, { others: defaults, now: 7 });
    expect(next).toEqual([{ key: 'c-7', label: 'GST only', filters: { area: 'gst' } }]);
    writeSavedViews('manager:work', next!);
    expect(readSavedViews('manager:work')).toEqual(next);
    expect(readSavedViews('lead:work')).toEqual([]);
  });

  it('refuses an empty or taken label', () => {
    expect(addSavedView([], '   ', {})).toBeNull();
    expect(addSavedView([], 'my OVERDUE', {}, { others: defaults })).toBeNull();
  });

  it('reads bad or foreign data as no views', () => {
    window.localStorage.setItem(savedViewsKey('t'), '{not json');
    expect(readSavedViews('t')).toEqual([]);
    window.localStorage.setItem(savedViewsKey('t'), JSON.stringify([{ label: 1 }, { key: 'a', label: 'A', filters: {} }]));
    expect(readSavedViews('t')).toEqual([{ key: 'a', label: 'A', filters: {} }]);
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readSavedViews('t')).toEqual([]);
    expect(() => writeSavedViews('t', defaults)).not.toThrow();
    expect(readDensity('me')).toBe('comfortable');
    expect(takeLastVisit('page', { now: 5, seed: 2 })).toBe(2);
  });
});

describe('density', () => {
  it('defaults to comfortable and remembers compact', () => {
    expect(readDensity('asha')).toBe('comfortable');
    writeDensity('asha', 'compact');
    expect(readDensity('asha')).toBe('compact');
  });
});

describe('last visit', () => {
  it('returns the stored visit, stores now, and keeps the value for the page load', () => {
    window.localStorage.setItem(visitKey('manager:work'), '1000');
    expect(takeLastVisit('manager:work', { now: 5000 })).toBe(1000);
    expect(window.localStorage.getItem(visitKey('manager:work'))).toBe('5000');
    expect(takeLastVisit('manager:work', { now: 9000 })).toBe(1000);
  });

  it('uses the seed, else 0, on a first visit', () => {
    expect(takeLastVisit('a', { now: 10, seed: 4 })).toBe(4);
    expect(takeLastVisit('b', { now: 10 })).toBe(0);
  });

  it('marks rows that changed after the last visit', () => {
    expect(isNewSince(new Date(2000), 1000)).toBe(true);
    expect(isNewSince(new Date(500), 1000)).toBe(false);
    expect(isNewSince(undefined, 1000)).toBe(false);
    expect(isNewSince(new Date(2000), null)).toBe(false);
    expect(isNewSince('2026-10-29T10:00:00Z', 0)).toBe(true);
  });
});
