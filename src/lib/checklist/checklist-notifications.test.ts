import { describe, expect, it } from 'vitest';
import { diffChecklistForNotifications } from '@/lib/checklist/checklist-notifications';

const engagement = { id: 'eng-1', slug: 'acme', companyName: 'Acme Pvt Ltd' };

describe('diffChecklistForNotifications', () => {
  it('notifies client on deliver', () => {
    const items = diffChecklistForNotifications(
      { 'post-1': { status: 'in-progress' } },
      { 'post-1': { status: 'in-progress', deliveredToClientAt: '2026-06-01T00:00:00.000Z' } },
      { engagement, viewerRole: 'client', viewerUserId: 'client-1' },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('checklist.deliver');
  });

  it('points board-resolution delivery at the client BR page', () => {
    const items = diffChecklistForNotifications(
      { 'pre-2': { status: 'in-progress' } },
      { 'pre-2': { status: 'completed', deliveredToClientAt: '2026-06-01T00:00:00.000Z' } },
      { engagement, viewerRole: 'client', viewerUserId: 'client-1' },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Board resolution ready');
    expect(items[0]?.body).toMatch(/download and sign/i);
    expect(items[0]?.href).toBe('/app/client/board-resolution');
  });

  it('notifies intern on client submit', () => {
    const items = diffChecklistForNotifications(
      { 'post-1': { status: 'in-progress' } },
      {
        'post-1': {
          status: 'in-progress',
          clientSubmittedAt: '2026-06-01T00:00:00.000Z',
          locked: true,
        },
      },
      { engagement, viewerRole: 'intern', viewerUserId: 'intern-1' },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('checklist.submit');
    expect(items[0]?.href).toContain('/app/intern/engagements/');
  });

  it('labels lead→manager approval requests distinctly', () => {
    const items = diffChecklistForNotifications(
      { 'post-1': { status: 'in-progress' } },
      {
        'post-1': {
          status: 'in-progress',
          clientSubmittedAt: '2026-06-01T00:00:00.000Z',
          locked: true,
          reviewSource: 'lead_manager_request',
          reviewStatus: 'reviewing',
        },
      },
      { engagement, viewerRole: 'manager', viewerUserId: 'mgr-1' },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Manager approval requested');
  });

  it('notifies client on review without self-echo', () => {
    const items = diffChecklistForNotifications(
      { 'post-1': { status: 'in-progress', reviewStatus: 'reviewing' } },
      {
        'post-1': {
          status: 'completed',
          reviewStatus: 'accepted',
          reviewedBy: 'manager-uuid',
        },
      },
      { engagement, viewerRole: 'client', viewerUserId: 'client-uuid' },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('checklist.review');
  });

  it('skips review notification when reviewer is viewer', () => {
    const items = diffChecklistForNotifications(
      { 'post-1': { reviewStatus: 'reviewing', status: 'in-progress' } },
      {
        'post-1': {
          reviewStatus: 'accepted',
          reviewedBy: 'same-user',
          status: 'completed',
        },
      },
      { engagement, viewerRole: 'client', viewerUserId: 'same-user' },
    );
    expect(items).toHaveLength(0);
  });

  it('notifies client on bulk doc share', () => {
    const items = diffChecklistForNotifications(
      { 'pre-7': { status: 'in-progress' } },
      {
        'pre-7': {
          status: 'in-progress',
          incorpDraftsSharedAt: '2026-06-01T12:00:00.000Z',
        },
      },
      { engagement, viewerRole: 'client', viewerUserId: 'c1' },
    );
    expect(items.some((n) => n.kind === 'docs.share')).toBe(true);
  });
});

describe('diffChecklistForNotifications — direct flow', () => {
  const engagement = { id: 'e1', slug: 'acme', companyName: 'Acme' };
  const submitted = {
    status: 'completed' as const,
    reviewStatus: 'accepted' as const,
    clientSubmittedAt: '2026-10-12T10:00:00.000Z',
    deliveredToClientAt: '2026-10-12T10:00:00.000Z',
    reviewedBy: 'lead-1',
    submittedByName: 'Divya',
    submittedByRole: 'intern',
  };

  it('one "submitted" toast with the actor, not a delivery or an approval', () => {
    for (const viewerRole of ['client', 'manager'] as const) {
      const out = diffChecklistForNotifications(
        { 'pre-13': { status: 'in-progress' } },
        { 'pre-13': submitted },
        { engagement, viewerRole, viewerUserId: 'someone-else' },
      );
      expect(out).toHaveLength(1);
      expect(out[0]!.title).toBe('Capital Structure submitted');
      expect(out[0]!.body).toBe('Divya (Project Lead) submitted this step for Acme.');
    }
  });

  it('no toast for the person who submitted', () => {
    const out = diffChecklistForNotifications(
      { 'pre-13': { status: 'in-progress' } },
      { 'pre-13': submitted },
      { engagement, viewerRole: 'intern', viewerUserId: 'lead-1' },
    );
    expect(out).toEqual([]);
  });
});
