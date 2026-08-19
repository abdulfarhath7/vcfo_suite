import { describe, expect, it } from 'vitest';
import type { Engagement } from '@/data/engagements';
import {
  buildInternPortfolioQueue,
  engagementSetupProgressPercent,
  groupInternWeekQueueByCompany,
  internQueueStats,
  internWeekQueueItems,
  prioritizeInternActions,
} from '@/lib/intern-dashboard';

const engagement: Engagement = {
  id: 'eng-1',
  clientId: 'c1',
  companyName: 'ABC',
  companyType: 'domestic',
  internId: 'intern-a',
  adminId: 'admin',
  createdAt: '2026-01-01',
  stage: 'Pre-Incorporation',
  health: 'on-track',
};

describe('engagementSetupProgressPercent', () => {
  it('returns 0 when checklist is empty', () => {
    expect(engagementSetupProgressPercent({})).toBe(0);
  });

  it('reflects completed pre-inc steps', () => {
    const pct = engagementSetupProgressPercent({
      'pre-1': { status: 'completed' },
    });
    expect(pct).toBeGreaterThan(0);
  });
});

describe('buildInternPortfolioQueue', () => {
  it('derives in-progress when client fields are partially filled', () => {
    const queue = buildInternPortfolioQueue(
      [engagement],
      () => ({
        'pre-1': {
          status: 'not-started',
          responses: { proposedName1: 'ABC India Private Limited' },
        },
      }),
      'intern-a',
    );
    const pre1 = queue.find((q) => q.checklistKey === 'pre-1');
    expect(pre1?.status).toBe('in-progress');
  });

  it('scopes to intern engagements only', () => {
    const other = { ...engagement, id: 'eng-2', internId: 'intern-b' };
    const queue = buildInternPortfolioQueue([engagement, other], () => ({}), 'intern-a');
    expect(queue.every((q) => q.engagementId === 'eng-1')).toBe(true);
  });
});

describe('internQueueStats', () => {
  it('counts awaiting review toward requests to review', () => {
    const queue = buildInternPortfolioQueue(
      [engagement],
      () => ({
        'pre-1': { status: 'in-progress', reviewStatus: 'reviewing', clientSubmittedAt: '2026-05-01' },
      }),
      'intern-a',
    );
    const stats = internQueueStats(queue, 2);
    expect(stats.awaitsReview).toBe(1);
    expect(stats.requestsToReview).toBe(3);
  });
});

describe('prioritizeInternActions', () => {
  it('puts overdue current-gate items first and skips locked future steps', () => {
    const items = buildInternPortfolioQueue(
      [engagement],
      () => ({
        'pre-1': { status: 'overdue' },
        'pre-2': { status: 'overdue' },
        'pre-3': { status: 'not-started' },
      }),
      'intern-a',
    );
    const focus = prioritizeInternActions(items, 3);
    expect(focus[0]?.checklistKey).toBe('pre-1');
    expect(focus.some((i) => i.checklistKey === 'pre-2')).toBe(false);
  });
});

describe('groupInternWeekQueueByCompany', () => {
  const zeta: Engagement = {
    ...engagement,
    id: 'eng-z',
    companyName: 'Zeta Co',
  };

  it('keeps completed unlocked steps in the week queue', () => {
    const items = buildInternPortfolioQueue(
      [engagement],
      () => ({
        'pre-1': { status: 'completed' },
        'pre-2': { status: 'in-progress' },
      }),
      'intern-a',
    );
    const week = internWeekQueueItems(items);
    const completed = week.find((i) => i.checklistKey === 'pre-1');
    const current = week.find((i) => i.checklistKey === 'pre-2');
    expect(completed?.status).toBe('completed');
    expect(current?.status).toBe('in-progress');
    expect(week.every((i) => !i.isLocked)).toBe(true);
    expect(week.some((i) => i.checklistKey === 'pre-3')).toBe(false);
  });

  it('groups by company and sorts cards A–Z by company name', () => {
    const items = buildInternPortfolioQueue(
      [zeta, engagement],
      (e) =>
        e.id === 'eng-1'
          ? { 'pre-1': { status: 'completed' }, 'pre-2': { status: 'awaiting-client' } }
          : {},
      'intern-a',
    );
    const groups = groupInternWeekQueueByCompany(items, [zeta, engagement]);
    expect(groups.map((g) => g.companyName)).toEqual(['ABC', 'Zeta Co']);
    expect(groups[0]?.items.map((i) => i.checklistKey)).toEqual(['pre-1', 'pre-2']);
    expect(groups[0]?.items[0]?.status).toBe('completed');
    expect(groups[0]?.items[1]?.status).not.toBe('completed');
    expect(groups[0]?.items[1]?.isLocked).toBe(false);
    expect(groups[1]?.items.map((i) => i.checklistKey)).toEqual(['pre-1']);
  });
});
