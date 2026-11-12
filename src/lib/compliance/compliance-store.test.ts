import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Engagement } from '@/data/engagements';
import { computeAllFilings } from '@/lib/compliance/compliance-store';

/**
 * The staff Work timeline, Today, the admin dashboard and the lead's portfolio build their own
 * filings in the browser with `computeAllFilings`. A company still in pre-incorporation (the
 * owner's Emburse report, 2026-11) must show none of them.
 */

const engagement = (over: Partial<Engagement>): Engagement =>
  ({ id: 'e1', companyName: 'Emburse', internId: 'tm1', entityLegalForm: 'company', stage: 'Pre-Incorporation', incorporationDate: null, ...over }) as Engagement;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T12:00:00'));
});
afterEach(() => vi.useRealTimers());

describe('computeAllFilings', () => {
  it('lists no filing for a company that is not incorporated, even with SPICe+ Part A done', () => {
    const state = { 'pre-1': { status: 'completed' }, 'pre-9': { status: 'completed' } } as never;
    expect(computeAllFilings([engagement({})], { e1: state })).toEqual([]);
  });

  it('lists filings once the incorporation date is recorded, none before it', () => {
    const filings = computeAllFilings([engagement({ incorporationDate: '2026-10-20' })], { e1: {} });
    expect(filings.length).toBeGreaterThan(0);
    expect(filings.every((f) => f.nextDue >= '2026-10-20')).toBe(true);
  });

  it('lists filings for a company that started at Registration', () => {
    const filings = computeAllFilings([engagement({ stage: 'Post-Incorporation' })], { e1: {} });
    expect(filings.some((f) => f.filing.startsWith('Advance Tax'))).toBe(true);
  });
});
