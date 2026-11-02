import { describe, expect, it } from 'vitest';
import type { Engagement, TaskInstance } from '@/data/engagements';
import {
  buildInternWorkItems,
  buildTaskWorkItem,
  internWorkCta,
  internWorkKpis,
  stepOwnerLead,
} from '@/lib/intern/intern-work';

/** Task items (G-12) and reassigned steps (G-18) in the lead's Work list. */

const now = new Date('2026-08-20T09:00:00+05:30');

const engagement: Engagement = {
  id: 'eng-1',
  slug: 'abc-india',
  clientId: 'c1',
  companyName: 'ABC India',
  companyType: 'domestic',
  internId: 'intern-a',
  leadIds: ['intern-a', 'intern-b'],
  adminId: 'admin',
  createdAt: '2026-08-01T00:00:00.000Z',
  stage: 'Pre-Incorporation',
  health: 'on-track',
};

function task(over: Partial<TaskInstance>): TaskInstance {
  return { id: 't1', engagementId: 'eng-1', checklistKey: '', status: 'not-started', title: 'Call the bank', ...over };
}

describe('buildTaskWorkItem', () => {
  it('turns an assigned task into an action item with Mark done', () => {
    const item = buildTaskWorkItem(task({ dueAt: '2026-08-25T12:00:00Z' }), engagement, now)!;
    expect(item).toMatchObject({ id: 'task:t1', source: 'task', kind: 'task', taskId: 't1', isOverdue: false });
    expect(internWorkCta(item)).toMatchObject({ label: 'Mark done', action: 'complete-task' });
    expect(internWorkKpis([item], now).action.total).toBe(1);
  });

  it('marks a past deadline overdue', () => {
    expect(buildTaskWorkItem(task({ dueAt: '2026-08-10T12:00:00Z' }), engagement, now)?.isOverdue).toBe(true);
  });

  it('skips checklist-step rows and tasks finished before this week', () => {
    expect(buildTaskWorkItem(task({ checklistKey: 'pre-2' }), engagement, now)).toBeNull();
    expect(buildTaskWorkItem(task({ status: 'completed', updatedAt: '2026-07-01T10:00:00Z' }), engagement, now)).toBeNull();
    expect(buildTaskWorkItem(task({ status: 'completed', updatedAt: '2026-08-19T10:00:00Z' }), engagement, now)?.kind).toBe('done');
  });

  it('adds the lead’s tasks to the Work list', () => {
    const items = buildInternWorkItems({
      engagements: [engagement],
      getChecklistState: () => ({}),
      internId: 'intern-a',
      tasks: [task({})],
      now,
    });
    expect(items.some((i) => i.id === 'task:t1')).toBe(true);
  });
});

describe('stepOwnerLead', () => {
  it('is the assignee only when they lead this engagement', () => {
    expect(stepOwnerLead(engagement, { assigneeId: 'intern-b' })).toBe('intern-b');
    expect(stepOwnerLead(engagement, { assigneeId: 'someone-else' })).toBeNull();
    expect(stepOwnerLead(engagement, undefined)).toBeNull();
  });

  it('keeps a step reassigned to a co-lead out of the other lead’s list', () => {
    const state = () => ({ 'pre-1': { status: 'in-progress' as const, assigneeId: 'intern-b' } });
    const forA = buildInternWorkItems({ engagements: [engagement], getChecklistState: state, internId: 'intern-a', now });
    const forB = buildInternWorkItems({ engagements: [engagement], getChecklistState: state, internId: 'intern-b', now });
    expect(forA.some((i) => i.id === 'step:eng-1:pre-1')).toBe(false);
    expect(forB.some((i) => i.id === 'step:eng-1:pre-1')).toBe(true);
    const ownedOnly = buildInternWorkItems({
      engagements: [engagement],
      getChecklistState: state,
      internId: 'intern-b',
      ownedStepsOnly: true,
      now,
    });
    expect(ownedOnly.every((i) => i.id === 'step:eng-1:pre-1')).toBe(true);
  });
});
