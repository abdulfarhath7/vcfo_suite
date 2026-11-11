import { describe, expect, it } from 'vitest';
import { sinceHandOver, workHolder, workHolderLabel } from './work-holder';

/** BR-03: each of the six states of the mapping. */
describe('workHolder', () => {
  const pending = { reviewSource: 'lead_manager_request', reviewStatus: 'reviewing' } as const;

  it('1. the Lead prepares the draft: With Lead', () => {
    expect(workHolder({ kind: 'with', owner: 'sbc', slice: { status: 'in-progress' } })).toBe('lead');
  });

  it('2. sent to the Manager for approval: With Manager (approval)', () => {
    const h = workHolder({ kind: 'with', owner: 'sbc', slice: { status: 'in-progress', ...pending } });
    expect(h).toBe('manager');
    expect(workHolderLabel(h!, 'client')).toBe('With Manager (approval)');
  });

  it('3. the Manager approved and the Admin holds it: With Admin (approval)', () => {
    const h = workHolder({ kind: 'with', owner: 'sbc', slice: { status: 'in-progress', ...pending, approvalStage: 'admin' } });
    expect(h).toBe('admin');
    expect(workHolderLabel(h!, 'client')).toBe('With Admin (approval)');
  });

  it('4. the firm sent it to the Client: With you for the Client, With Client for staff', () => {
    const h = workHolder({ kind: 'you', owner: 'client', slice: { status: 'in-progress' } });
    expect(h).toBe('client');
    expect(workHolderLabel(h!, 'client')).toBe('With you');
    expect(workHolderLabel(h!, 'staff')).toBe('With Client');
  });

  it('5. the Client requested a change: back With Lead', () => {
    expect(workHolder({ kind: 'with', owner: 'sbc', slice: { status: 'in-progress', reviewStatus: 'rejected' } })).toBe('lead');
  });

  it('6. filed with MCA: With MCA', () => {
    const h = workHolder({ kind: 'with', owner: 'mca', slice: { status: 'in-progress' } });
    expect(h).toBe('mca');
    expect(workHolderLabel(h!)).toBe('With MCA');
  });

  it('a step that is done or not started has no holder', () => {
    expect(workHolder({ kind: 'done', owner: 'sbc' })).toBeNull();
    expect(workHolder({ kind: 'up', owner: 'sbc' })).toBeNull();
  });
});

describe('sinceHandOver', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  it('gives the largest whole unit', () => {
    expect(sinceHandOver('2026-11-11T10:00:00Z', now)).toBe('2 hours');
    expect(sinceHandOver('2026-11-08T12:00:00Z', now)).toBe('3 days');
    expect(sinceHandOver('2026-11-11T11:40:00Z', now)).toBe('20 minutes');
    expect(sinceHandOver(undefined, now)).toBeNull();
  });
});
