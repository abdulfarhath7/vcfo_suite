import { describe, expect, it } from 'vitest';

import { getActiveCatalogItems } from '@/data/checklist';
import {
  attentionScore,
  buildFilingBuckets,
  buildJourney,
  buildPhaseBars,
  buildPeople,
  buildStageBars,
  buildWorkload,
  needsAttention,
  sortByAttention,
  summarizeEngagement,
  type SuperEngagementInput,
  type SuperFiling,
  type SuperOverviewState,
} from '@/lib/super-overview';

/**
 * Unit tests for the pure super admin derivations. These prove the observatory
 * reports what the gate already decided — it never invents its own sequencing.
 */

const NOW = new Date('2026-03-01T00:00:00.000Z');

function input(overrides: Partial<SuperEngagementInput> = {}): SuperEngagementInput {
  return {
    id: 'e1',
    slug: 'acme-india',
    companyName: 'Acme India Private Limited',
    clientName: 'Acme Holdings',
    stage: 'Pre-Incorporation',
    health: 'on-track',
    leadId: 'i1',
    leadName: 'Priya Lead',
    managerId: 'm1',
    managerName: 'Rahul Manager',
    incorporationDate: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-25T00:00:00.000Z'),
    state: {},
    ...overrides,
  };
}

/** Mark the first `count` catalog steps complete, as the gate understands it. */
function completedState(count: number): SuperOverviewState {
  const state: SuperOverviewState = {};
  for (const item of getActiveCatalogItems().slice(0, count)) {
    state[item.id] = { status: 'completed' };
  }
  return state;
}

describe('summarizeEngagement', () => {
  it('opens exactly one step and locks the rest on an untouched project', () => {
    const summary = summarizeEngagement(input(), NOW);

    expect(summary.progress.done).toBe(0);
    expect(summary.steps.done).toBe(0);
    expect(summary.steps.active + summary.steps.waiting).toBe(1);
    expect(summary.steps.locked).toBe(summary.progress.total - 1);
    expect(summary.currentStep).not.toBeNull();
  });

  it('advances progress and the current step as the gate completes steps', () => {
    const summary = summarizeEngagement(input({ state: completedState(3) }), NOW);

    expect(summary.progress.done).toBe(3);
    expect(summary.steps.done).toBe(3);
    expect(summary.progress.pct).toBe(
      Math.round((3 / summary.progress.total) * 100),
    );
    expect(summary.currentStep?.id).toBe(getActiveCatalogItems()[3]?.id);
  });

  it('splits the open step by who owns the next move', () => {
    const summary = summarizeEngagement(input(), NOW);

    expect(summary.ballInCourt.firm + summary.ballInCourt.client).toBe(1);
    expect(summary.currentStep?.owner).toBe(
      summary.ballInCourt.firm === 1 ? 'firm' : 'client',
    );
  });

  it('reports idle days from the row timestamp, never negative', () => {
    expect(summarizeEngagement(input(), NOW).idleDays).toBe(4);
    expect(
      summarizeEngagement(input({ updatedAt: new Date('2026-04-01T00:00:00.000Z') }), NOW).idleDays,
    ).toBe(0);
  });

  it('flags incorporation off the incorporation date', () => {
    expect(summarizeEngagement(input(), NOW).incorporated).toBe(false);
    expect(
      summarizeEngagement(input({ incorporationDate: '2026-02-14' }), NOW).incorporated,
    ).toBe(true);
  });
});

describe('attention ranking', () => {
  it('treats a project with nothing moving as needing attention', () => {
    expect(needsAttention(summarizeEngagement(input(), NOW))).toBe(true);
  });

  it('ranks a blocked project above a merely waiting one', () => {
    const waiting = summarizeEngagement(input(), NOW);
    const blocked = summarizeEngagement(
      input({
        state: {
          ...completedState(2),
          [getActiveCatalogItems()[2]!.id]: { status: 'overdue' },
        },
      }),
      NOW,
    );

    expect(attentionScore(blocked)).toBeGreaterThan(attentionScore(waiting));
    expect(sortByAttention([waiting, blocked])[0]).toBe(blocked);
  });

  it('breaks ties by company name so the order is stable', () => {
    const a = summarizeEngagement(input({ id: 'a', companyName: 'Alpha' }), NOW);
    const b = summarizeEngagement(input({ id: 'b', companyName: 'Beta' }), NOW);

    expect(sortByAttention([b, a]).map((row) => row.companyName)).toEqual(['Alpha', 'Beta']);
  });
});

describe('portfolio aggregation', () => {
  it('keeps every stage column present even when empty', () => {
    const bars = buildStageBars([summarizeEngagement(input(), NOW)]);

    expect(bars.map((bar) => bar.stage)).toEqual([
      'Pre-Incorporation',
      'Post-Incorporation',
      'Operational Readiness',
    ]);
    expect(bars[0]!.attention).toBe(1);
    expect(bars[1]!.attention + bars[1]!.onTrack).toBe(0);
  });

  it('attributes unassigned work rather than dropping it', () => {
    const rows = buildWorkload([
      summarizeEngagement(input({ leadId: null, leadName: null }), NOW),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('unassigned');
    expect(rows[0]!.name).toBe('Unassigned');
  });

  it('counts only delivery staff in the people roll-up', () => {
    const summaries = [summarizeEngagement(input(), NOW)];
    const people = buildPeople(
      [
        { id: 'p1', name: 'Priya Lead', email: 'priya@x', role: 'intern', internId: 'i1' },
        { id: 'm1', name: 'Rahul Manager', email: 'rahul@x', role: 'manager', internId: null },
        { id: 'a1', name: 'Firm Admin', email: 'admin@x', role: 'admin', internId: null },
        { id: 'c1', name: 'A Client', email: 'client@x', role: 'client', internId: null },
      ],
      summaries,
    );

    expect(people.map((person) => person.role).sort()).toEqual([
      'Project Lead',
      'Project Manager',
    ]);
    expect(people.find((person) => person.id === 'p1')?.engagements).toBe(1);
    expect(people.find((person) => person.id === 'm1')?.engagements).toBe(1);
  });
});

describe('buildFilingBuckets', () => {
  const filing = (dueDate: string, status = 'upcoming'): SuperFiling => ({
    id: `f-${dueDate}`,
    engagementId: 'e1',
    companyName: 'Acme India Private Limited',
    title: 'GSTR-3B',
    authority: 'GST',
    dueDate,
    status,
    href: '/app/super/projects/e1',
  });

  it('buckets by how soon a filing bites, overdue first', () => {
    const buckets = buildFilingBuckets(
      [
        filing('2026-02-20'),
        filing('2026-03-05'),
        filing('2026-03-20'),
        filing('2026-05-10'),
      ],
      NOW,
    );

    expect(buckets.map((bucket) => [bucket.bucket, bucket.count])).toEqual([
      ['overdue', 1],
      ['week', 1],
      ['month', 1],
      ['quarter', 1],
    ]);
  });

  it('ignores filings already filed', () => {
    const buckets = buildFilingBuckets([filing('2026-02-20', 'filed')], NOW);
    expect(buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe('buildJourney', () => {
  it('returns every catalog step, grouped in phase order, linked to the staff workspace', () => {
    const journey = buildJourney(completedState(2), 'acme-india');

    expect(journey).toHaveLength(getActiveCatalogItems().length);
    expect(journey[0]!.kind).toBe('done');
    expect(journey[0]!.href).toBe(`/app/admin/projects/acme-india/step/${journey[0]!.slug}`);
    expect(journey.at(-1)!.kind).toBe('locked');
    // Phases come out in journey order, never interleaved.
    const phaseOrder = [...new Set(journey.map((step) => step.phaseId))];
    expect(phaseOrder).toEqual([
      'pre-inc-phase-1',
      'pre-inc-phase-2',
      'post-inc-phase-3',
      'registration-phase-4',
    ]);
  });
});

describe('gate state', () => {
  it('leads with what the gate says, not with who has been sitting on it', () => {
    // An untouched project: `project-stuck` calls this "lead pending", but the
    // first catalog step belongs to the client. The chip must say the latter,
    // or a row contradicts its own detail line.
    const summary = summarizeEngagement(input(), NOW);

    expect(summary.stuckReason).toBe('waiting_lead');
    expect(summary.currentStep?.owner).toBe('client');
    expect(summary.stateKey).toBe('with-client');
    expect(summary.stateLabel).toBe('With client');
  });

  it('promotes overdue work above everything else', () => {
    const summary = summarizeEngagement(
      input({
        state: {
          ...completedState(2),
          [getActiveCatalogItems()[2]!.id]: { status: 'overdue' },
        },
      }),
      NOW,
    );

    expect(summary.steps.overdue).toBe(1);
    expect(summary.stateKey).toBe('overdue');
  });

  it('reports a fully complete project as complete', () => {
    const summary = summarizeEngagement(
      input({ state: completedState(getActiveCatalogItems().length) }),
      NOW,
    );

    expect(summary.currentStep).toBeNull();
    expect(summary.stateKey).toBe('complete');
    expect(summary.progress.pct).toBe(100);
  });
});

describe('phase bars', () => {
  it('never claims more open work than the gate opened', () => {
    // One project, two steps done: exactly one step is open across all four
    // phases and everything after it is locked. An earlier version estimated
    // the split proportionally and reported zero locked steps.
    const summary = summarizeEngagement(input({ state: completedState(2) }), NOW);
    const bars = buildPhaseBars([summary]);

    const open = bars.reduce((sum, bar) => sum + bar.active + bar.waiting, 0);
    const locked = bars.reduce((sum, bar) => sum + bar.locked, 0);
    const done = bars.reduce((sum, bar) => sum + bar.done, 0);

    expect(open).toBe(1);
    expect(done).toBe(2);
    expect(locked).toBe(getActiveCatalogItems().length - 3);
    expect(done + open + locked).toBe(getActiveCatalogItems().length);
  });

  it('reports a finished project as all done, nothing open or locked', () => {
    const bars = buildPhaseBars([
      summarizeEngagement(input({ state: completedState(getActiveCatalogItems().length) }), NOW),
    ]);

    expect(bars.reduce((sum, bar) => sum + bar.done, 0)).toBe(getActiveCatalogItems().length);
    expect(bars.reduce((sum, bar) => sum + bar.active + bar.waiting + bar.locked, 0)).toBe(0);
  });
});
