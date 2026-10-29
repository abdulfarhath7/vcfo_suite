import { describe, expect, it } from 'vitest';
import {
  buildAnalyticsMetrics,
  buildPeopleMetrics,
  buildPracticeMetrics,
  currentPhaseIndex,
  type MetricClient,
  type MetricFiling,
} from '@/lib/metrics/practice-metrics';
import type { StepTiming } from '@/lib/metrics/step-timing';

const NOW = new Date('2026-10-29T10:00:00.000Z');

const PHASES = (done: number[]) =>
  ['Part A', 'Part B', 'Post-inc', 'Registration'].map((label, i) => ({ id: `p${i + 1}`, label, done: done[i] ?? 0, total: 4 }));

function client(overrides: Partial<MetricClient> = {}): MetricClient {
  return {
    id: 'e1',
    slug: 'acme',
    companyName: 'Acme Pvt Ltd',
    managerName: 'Mira',
    incorporated: false,
    startedPreInc: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    certificateDate: null,
    expectedCoiOn: null,
    phases: PHASES([4, 1]),
    currentStep: { id: 's6', title: 'SPICe+ Part B' },
    openSteps: 2,
    registrations: {},
    windowEnd: () => null,
    managerIds: ['m1'],
    leadIds: ['i1'],
    ...overrides,
  };
}

function filing(dueDate: string, filedOn: string | null, overrides: Partial<MetricFiling> = {}): MetricFiling {
  return { engagementId: 'e1', dueDate, filedOn, status: filedOn ? 'filed' : 'upcoming', authority: 'MCA', ...overrides };
}

const open = (openedAt: string, daysInStep: number): StepTiming => ({ openedAt, finishedAt: null, daysInStep, lastStatus: 'in-progress' });

describe('buildPracticeMetrics', () => {
  it('splits clients by stage, lists expected certificates and the longest wait', () => {
    const clients = [
      client({ id: 'e1', expectedCoiOn: '2026-11-09', windowEnd: (id) => (id === 's6' ? '2026-10-20' : null) }),
      client({ id: 'e2', companyName: 'Banyan', phases: PHASES([1]), currentStep: { id: 's2', title: 'Name approval' }, expectedCoiOn: '2026-11-02' }),
      client({ id: 'e3', incorporated: true, certificateDate: '2026-10-01', phases: PHASES([4, 4, 4, 4]), currentStep: null }),
    ];
    const timings = new Map([
      ['e1', { s6: open('2026-10-09T00:00:00Z', 20) }],
      ['e2', { s2: open('2026-10-24T00:00:00Z', 5) }],
    ]);
    const m = buildPracticeMetrics({ clients, filings: [], timings, stageDays: [], registrationTypes: [], now: NOW });
    expect(m.incorporation.clients).toBe(2);
    expect(m.incorporation.stages.map((s) => s.clients)).toEqual([1, 1, 0, 0]);
    expect(m.incorporation.avgDaysToCoi).toBe(30);
    expect(m.incorporation.expected.map((e) => e.engagementId)).toEqual(['e2', 'e1']);
    expect(m.incorporation.longestInStep).toMatchObject({ engagementId: 'e1', days: 20 });
    expect(m.currentStep.e1).toEqual({ stepId: 's6', title: 'SPICe+ Part B', days: 20, dueOn: '2026-10-20' });
    expect(m.openStepDays).toEqual({ e1: { s6: 20 }, e2: { s2: 5 } });
  });

  it('counts registrations in progress against pending for incorporated clients only', () => {
    const clients = [
      client({ id: 'e1', incorporated: true, registrations: { gst: 'done', pan: 'progress', tan: 'waiting' } }),
      client({ id: 'e2', incorporated: true, registrations: { gst: 'waiting', pan: 'overdue', tan: 'locked' } }),
      client({ id: 'e3', incorporated: false, registrations: { gst: 'waiting' } }),
    ];
    const m = buildPracticeMetrics({
      clients,
      filings: [],
      timings: new Map(),
      stageDays: [],
      registrationTypes: [
        { id: 'gst', title: 'GST' },
        { id: 'pan', title: 'PAN' },
        { id: 'tan', title: 'TAN' },
      ],
      now: NOW,
    });
    expect(m.registrations).toMatchObject({ done: 1, inProgress: 2, pending: 2 });
    expect(m.registrations.byType.find((t) => t.id === 'gst')).toMatchObject({ done: 1, inProgress: 0, pending: 1 });
    expect(m.registrations.mostPending).toBe('GST');
  });

  it('tallies this month’s filings and the worst authority', () => {
    const m = buildPracticeMetrics({
      clients: [client()],
      filings: [
        filing('2026-10-05', '2026-10-04'),
        filing('2026-10-10', '2026-10-12', { authority: 'GST' }),
        filing('2026-10-20', null, { authority: 'GST' }),
        filing('2026-10-31', null),
        filing('2026-09-30', null),
      ],
      timings: new Map(),
      stageDays: [],
      registrationTypes: [],
      now: NOW,
    });
    expect(m.compliances).toMatchObject({ monthLabel: 'October', total: 4, onTime: 1, late: 1, overdue: 1, dueThisWeek: 1, upcoming: 0, worstAuthority: 'GST' });
  });
});

describe('buildPeopleMetrics', () => {
  it('counts a manager’s clients, open items, load and on-time share', () => {
    const people = buildPeopleMetrics({
      people: [
        { profileId: 'm1', internId: null, role: 'manager', name: 'Mira', capacity: 4, lastSeenAt: null },
        { profileId: 'p2', internId: 'i9', role: 'intern', name: 'Ravi', capacity: null, lastSeenAt: '2026-10-29T09:00:00Z' },
      ],
      clients: [client({ openSteps: 2 })],
      filings: [filing('2026-10-05', '2026-10-04'), filing('2026-09-10', '2026-09-12'), filing('2026-11-10', null)],
      now: NOW,
    });
    const mira = people.find((p) => p.profileId === 'm1')!;
    expect(mira.clients).toBe(1);
    expect(mira.openItems).toBe(3);
    expect(mira.load).toEqual({ open: 3, capacity: 4, pct: 75, tone: 'ok' });
    expect(mira.onTime).toEqual({ filed: 2, onTime: 1, pct: 50 });
    const ravi = people.find((p) => p.profileId === 'p2')!;
    expect(ravi.clients).toBe(0);
    expect(ravi.load.pct).toBeNull();
  });
});

describe('buildAnalyticsMetrics', () => {
  it('names the longest client per step and sorts by the longest wait', () => {
    const a = buildAnalyticsMetrics({
      clients: [client({ id: 'e1', companyName: 'Acme' })],
      filings: [],
      stepRows: [
        { stepId: 's1', medianDays: 3, finished: 2, longest: null },
        { stepId: 's2', medianDays: 1, finished: 1, longest: { engagementId: 'e1', days: 9 } },
      ],
      stepTitle: (id) => id.toUpperCase(),
      stageDays: [],
      months: 6,
      now: NOW,
    });
    expect(a.months).toHaveLength(6);
    expect(a.stepTime[0]).toMatchObject({ stepId: 's2', title: 'S2', longestDays: 9, longestCompany: 'Acme' });
  });
});

describe('currentPhaseIndex', () => {
  it('is the first phase not done', () => {
    expect(currentPhaseIndex({ phases: PHASES([4, 2]) })).toBe(1);
    expect(currentPhaseIndex({ phases: PHASES([4, 4, 4, 4]) })).toBe(-1);
  });
});
