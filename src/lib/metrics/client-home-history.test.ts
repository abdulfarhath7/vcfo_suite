import { describe, expect, it } from 'vitest';
import { buildIncorporationModel } from '@/lib/client-portal/step-model';
import { pastDays, trailingKnown } from '@/lib/metrics/home-trends';
import {
  clientTilesAsOf,
  requestClosedAt,
  rewindChecklistState,
  type ClientRequestHistoryRow,
  type StepStatusHistoryEvent,
} from '@/lib/metrics/client-home-history';

const NOW = new Date('2026-10-29T04:30:00Z');
// Days 25, 26, 27 and 28 Oct (India).
const periods = pastDays(NOW);
const at = (iso: string) => new Date(iso);
const firstStep = buildIncorporationModel({}).steps[0]!.id;

function req(over: Partial<ClientRequestHistoryRow>): ClientRequestHistoryRow {
  return {
    id: 'r1',
    status: 'pending',
    createdAt: at('2026-10-20T05:00:00Z'),
    closedAt: null,
    firstUploadAt: null,
    kind: 'upload',
    dueDate: null,
    stepId: null,
    complianceInstanceId: null,
    ...over,
  };
}

describe('requestClosedAt', () => {
  it('is open while pending, then closed_at, then the first file', () => {
    expect(requestClosedAt(req({}))).toBeUndefined();
    expect(requestClosedAt(req({ status: 'fulfilled', closedAt: at('2026-10-26T05:00:00Z') }))).toEqual(at('2026-10-26T05:00:00Z'));
    expect(requestClosedAt(req({ status: 'fulfilled', firstUploadAt: at('2026-10-25T05:00:00Z') }))).toEqual(at('2026-10-25T05:00:00Z'));
    expect(requestClosedAt(req({ status: 'cancelled' }))).toBeNull();
  });
});

describe('rewindChecklistState', () => {
  it('undoes the changes made at or after the day end', () => {
    const events: StepStatusHistoryEvent[] = [
      { stepId: firstStep, fromStatus: 'not-started', toStatus: 'in-progress', reviewStatus: null, at: at('2026-10-24T05:00:00Z') },
      { stepId: firstStep, fromStatus: 'in-progress', toStatus: 'completed', reviewStatus: 'accepted', at: at('2026-10-27T05:00:00Z') },
    ];
    const now = { [firstStep]: { status: 'completed', reviewStatus: 'accepted' } };
    expect(rewindChecklistState(now, events, periods[0]!.end)[firstStep]).toMatchObject({ status: 'in-progress' });
    expect(rewindChecklistState(now, events, periods[0]!.end)[firstStep]?.reviewStatus).toBeUndefined();
    expect(rewindChecklistState(now, events, periods[3]!.end)[firstStep]).toMatchObject({ status: 'completed', reviewStatus: 'accepted' });
  });
});

describe('clientTilesAsOf', () => {
  const base = { schedule: null, engagementCreatedAt: at('2026-10-01T05:00:00Z'), filings: [], reopens: [] };

  it('draws a real line for steps done from the step events', () => {
    const events: StepStatusHistoryEvent[] = [
      { stepId: firstStep, fromStatus: 'in-progress', toStatus: 'completed', reviewStatus: null, at: at('2026-10-27T05:00:00Z') },
    ];
    const state = { [firstStep]: { status: 'completed' } };
    const values = periods.map((period) => clientTilesAsOf({ ...base, state, events, requests: [], period }).stepsDone);
    expect(values).toEqual([0, 0, 1, 1]);
  });

  it('counts open requests and answered requests per day end', () => {
    const requests = [
      req({ id: 'a', status: 'fulfilled', firstUploadAt: at('2026-10-26T05:00:00Z') }),
      req({ id: 'b' }),
    ];
    const tiles = periods.map((period) => clientTilesAsOf({ ...base, state: {}, events: [], requests, period }));
    expect(tiles.map((t) => t.docsIn)).toEqual([0, 1, 1, 1]);
    const steps = buildIncorporationModel({}).steps.filter((s) => s.kind === 'you' || s.kind === 'prog').length;
    expect(tiles.map((t) => t.waiting)).toEqual([2 + steps, 1 + steps, 1 + steps, 1 + steps]);
  });

  it('marks a late request as overdue from its due date', () => {
    const requests = [req({ id: 'late', dueDate: '2026-10-26' })];
    const tiles = periods.map((period) => clientTilesAsOf({ ...base, state: {}, events: [], requests, period }));
    const steps = periods.map((period) => clientTilesAsOf({ ...base, state: {}, events: [], requests: [], period }).overdue!);
    expect(tiles.map((t, i) => t.overdue! - steps[i]!)).toEqual([0, 0, 1, 1]);
  });

  it('ends the line where a closed request has no close time', () => {
    const requests = [req({ status: 'cancelled', createdAt: at('2026-10-26T05:00:00Z') })];
    const values = periods.map((period) => clientTilesAsOf({ ...base, state: {}, events: [], requests, period }).waiting);
    expect(values[0]).not.toBeNull();
    expect(values[2]).toBeNull();
    expect(trailingKnown(values)).toEqual([]);
  });

  it('knows nothing before the engagement existed', () => {
    const t = clientTilesAsOf({ ...base, engagementCreatedAt: at('2026-10-28T05:00:00Z'), state: {}, events: [], requests: [], period: periods[0]! });
    expect(t.stepsDone).toBeNull();
    expect(t.waiting).toBeNull();
  });
});
