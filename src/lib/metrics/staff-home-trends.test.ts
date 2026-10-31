import { describe, expect, it } from 'vitest';
import { pastDays } from '@/lib/metrics/home-trends';
import { awaitingApprovalAsOf, doneOnDayAsOf, indexStepEvents, type StepHistoryEvent } from './staff-home-trends';

const NOW = new Date('2026-10-29T04:30:00Z');
const periods = pastDays(NOW, 4); // 25, 26, 27, 28 Oct (IST)
const at = (d: number, hh = '06') => new Date(`2026-10-${d}T${hh}:00:00Z`);

function ev(stepId: string, from: string | null, to: string, review: string | null, when: Date): StepHistoryEvent {
  return { engagementId: 'e1', stepId, fromStatus: from, toStatus: to, reviewStatus: review, at: when };
}

describe('awaitingApprovalAsOf', () => {
  const created = new Map([['e1', at(1)]]);

  it('uses the current state when nothing changed since the day end', () => {
    const steps = [{ engagementId: 'e1', stepId: 'a', reviewNow: 'reviewing' }];
    const values = periods.map((period) =>
      awaitingApprovalAsOf({ steps, events: new Map(), engagementCreatedAt: created, period, reviewSince: at(20) }),
    );
    expect(values).toEqual([1, 1, 1, 1]);
  });

  it('rolls back to the last recorded review state before the day end', () => {
    const steps = [{ engagementId: 'e1', stepId: 'a', reviewNow: 'accepted' }];
    const events = indexStepEvents([
      ev('a', 'in-progress', 'in-progress', 'reviewing', at(24)),
      ev('a', 'in-progress', 'in-progress', 'accepted', at(27)),
    ]);
    const values = periods.map((period) =>
      awaitingApprovalAsOf({ steps, events, engagementCreatedAt: created, period, reviewSince: at(20) }),
    );
    expect(values).toEqual([1, 1, 0, 0]);
  });

  it('is unknown when a step changed later and nothing recorded says what it was before', () => {
    const steps = [{ engagementId: 'e1', stepId: 'a', reviewNow: 'accepted' }];
    const events = indexStepEvents([ev('a', 'in-progress', 'in-progress', 'accepted', at(27))]);
    expect(
      awaitingApprovalAsOf({ steps, events, engagementCreatedAt: created, period: periods[0]!, reviewSince: at(20) }),
    ).toBeNull();
  });

  it('is unknown before review history starts, and skips engagements not yet created', () => {
    const steps = [{ engagementId: 'e1', stepId: 'a', reviewNow: 'reviewing' }];
    expect(awaitingApprovalAsOf({ steps, events: new Map(), engagementCreatedAt: created, period: periods[0]!, reviewSince: null })).toBeNull();
    expect(
      awaitingApprovalAsOf({ steps, events: new Map(), engagementCreatedAt: new Map([['e1', at(28)]]), period: periods[0]!, reviewSince: at(20) }),
    ).toBe(0);
  });
});

describe('doneOnDayAsOf', () => {
  const base = { statusSince: at(1), tasks: [], filings: [], reopens: [] };

  it('counts a step completed during the day and still completed at its end', () => {
    const stepEvents = indexStepEvents([
      ev('a', 'in-progress', 'completed', null, at(27)),
      ev('b', 'in-progress', 'completed', null, at(27, '07')),
      ev('b', 'completed', 'in-progress', null, at(27, '09')),
    ]);
    expect(doneOnDayAsOf({ ...base, period: periods[2]!, stepEvents })).toBe(1);
    expect(doneOnDayAsOf({ ...base, period: periods[3]!, stepEvents })).toBe(0);
  });

  it('counts tasks by completed_at, and is unknown for an older done task touched that day', () => {
    const tasks = [{ status: 'done', completedAt: at(28), updatedAt: at(28) }];
    expect(doneOnDayAsOf({ ...base, period: periods[3]!, stepEvents: new Map(), tasks })).toBe(1);
    const legacy = [{ status: 'done', completedAt: null, updatedAt: at(28) }];
    expect(doneOnDayAsOf({ ...base, period: periods[3]!, stepEvents: new Map(), tasks: legacy })).toBeNull();
    expect(doneOnDayAsOf({ ...base, period: periods[2]!, stepEvents: new Map(), tasks: [{ status: 'done', completedAt: null, updatedAt: at(20) }] })).toBe(0);
  });

  it('counts filings due that day and filed by its end', () => {
    const filings = [
      { id: 'f1', engagementId: 'e1', dueDate: '2026-10-26', status: 'filed', filedOn: '2026-10-26', createdAt: at(1) },
      { id: 'f2', engagementId: 'e1', dueDate: '2026-10-26', status: 'pending', filedOn: null, createdAt: at(1) },
    ];
    expect(doneOnDayAsOf({ ...base, period: periods[1]!, stepEvents: new Map(), filings })).toBe(1);
  });

  it('is unknown for a day before the step history starts', () => {
    expect(doneOnDayAsOf({ ...base, statusSince: at(27), period: periods[0]!, stepEvents: new Map() })).toBeNull();
    expect(doneOnDayAsOf({ ...base, statusSince: null, period: periods[3]!, stepEvents: new Map() })).toBeNull();
  });
});
