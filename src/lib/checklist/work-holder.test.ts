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
    expect(workHolderLabel(h!)).toBe('With Manager (approval)');
  });

  it('3. the Manager approved and the Admin holds it: With Admin (approval)', () => {
    const h = workHolder({ kind: 'with', owner: 'sbc', slice: { status: 'in-progress', ...pending, approvalStage: 'admin' } });
    expect(h).toBe('admin');
    expect(workHolderLabel(h!)).toBe('With Admin (approval)');
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

/** BR-03 (owner decision 11 Nov): the Client reads the first name of the Lead and the Manager. */
describe('workHolderLabel for the Client', () => {
  const team = { lead: 'Divya Rao', manager: 'Anita Shah' };

  it('names the Lead and the Manager by first name, and the Admin by role only', () => {
    expect(workHolderLabel('lead', 'client', team)).toBe('With Lead · Divya');
    expect(workHolderLabel('manager', 'client', team)).toBe('With Manager · Anita');
    expect(workHolderLabel('admin', 'client', team)).toBe('With Admin');
  });

  it('keeps "With you" and "With MCA"', () => {
    expect(workHolderLabel('client', 'client', team)).toBe('With you');
    expect(workHolderLabel('mca', 'client', team)).toBe('With MCA');
  });

  it('reads the role alone without a name, or when the name is only an email address', () => {
    expect(workHolderLabel('lead', 'client')).toBe('With Lead');
    expect(workHolderLabel('manager', 'client', { manager: 'anita@sbc.example' })).toBe('With Manager');
  });

  it('a returned client edit is shared by the Lead and the Client', () => {
    expect(workHolderLabel('lead_client', 'client', team)).toBe('With Lead · Divya and you');
    expect(workHolderLabel('lead_client', 'client')).toBe('With Lead and you');
  });

  it('leaves the staff chip unchanged', () => {
    expect(workHolderLabel('lead', 'staff', team)).toBe('With Lead');
    expect(workHolderLabel('manager', 'staff', team)).toBe('With Manager (approval)');
    expect(workHolderLabel('admin', 'staff', team)).toBe('With Admin (approval)');
    expect(workHolderLabel('lead_client', 'staff', team)).toBe('With Lead and Client');
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

describe('BR-05 holder of a client edit', () => {
  it('follows the edit through the chain', async () => {
    const { workHolder } = await import('./work-holder');
    const at = (stage: string) => workHolder({ kind: 'done', owner: 'sbc', slice: { brClientEdit: { stage, content: '', updatedAt: '' } } as never });
    expect(at('editing')).toBe('client');
    expect(at('sent')).toBe('lead');
    expect(at('manager')).toBe('manager');
    expect(at('admin')).toBe('admin');
    expect(at('returned')).toBe('lead_client');
    expect(at('final')).toBeNull();
  });
});
