import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The GST start reminder's read (`systemGstDueToday`). A reg-4 window that starts today is
 * due only for an incorporated engagement: before the Certificate of Incorporation nobody is
 * emailed or notified. The database is a stub that answers each query in turn.
 */

let results: unknown[][] = [];

function chain(): unknown {
  const c: Record<string, unknown> = {
    from: () => c,
    where: () => c,
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? []).then(res, rej),
  };
  return c;
}

vi.mock('server-only', () => ({}));
vi.mock('@/db/client', () => ({ db: { select: () => chain() } }));

const { systemGstDueToday } = await import('@/db/repositories/gst-registration');

const TODAY = '2026-11-18';
const schedule = { steps: { 'reg-4': { from: TODAY, to: '2026-11-25', setBy: 'm', setAt: 'x' } } };

function row(patch: Record<string, unknown>) {
  return { id: 'eng-1', companyName: 'Acme', stage: 'Pre-Incorporation', incorporationDate: null, checklistState: {}, schedule, ...patch };
}

beforeEach(() => {
  results = [];
});

describe('systemGstDueToday', () => {
  it('skips an engagement that is not incorporated, even with a reg-4 window starting today', async () => {
    results = [[row({})]];
    expect(await systemGstDueToday(TODAY)).toEqual([]);
  });

  it('returns an incorporated engagement whose window starts today and has no ARN', async () => {
    results = [[row({ incorporationDate: '2026-11-01' })], []];
    const due = await systemGstDueToday(TODAY);
    expect(due.map((d) => d.engagement.id)).toEqual(['eng-1']);
    expect(due[0]?.schedule).toEqual({ date: TODAY, source: 'calendar' });
  });

  it('skips an incorporated engagement whose ARN is already recorded', async () => {
    results = [[row({ incorporationDate: '2026-11-01' })], [{ engagementId: 'eng-1', value: 'AA29' }]];
    expect(await systemGstDueToday(TODAY)).toEqual([]);
  });
});
