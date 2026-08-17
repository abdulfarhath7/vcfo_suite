import { describe, expect, it } from 'vitest';
import { diffChecklistForNotifications } from '@/lib/checklist-notifications';

const engagement = { id: 'eng-1', slug: 'acme', companyName: 'Acme Pvt Ltd' };

describe('diffChecklistForNotifications', () => {
  it('notifies client on deliver', () => {
    const items = diffChecklistForNotifications(
      { 'pre-1': { status: 'in-progress' } },
      { 'pre-1': { status: 'in-progress', deliveredToClientAt: '2026-06-01T00:00:00.000Z' } },
      { engagement, viewerRole: 'client', viewerUserId: 'client-1' },
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe('checklist.deliver');
  });

  it('notifies intern on client submit', () => {
    const items = diffChecklistForNotifications(
      { 'pre-1': { status: 'in-progress' } },
      {
        'pre-1': {
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
      { 'pre-1': { status: 'in-progress' } },
      {
        'pre-1': {
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
      { 'pre-1': { status: 'in-progress', reviewStatus: 'reviewing' } },
      {
        'pre-1': {
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
      { 'pre-1': { reviewStatus: 'reviewing', status: 'in-progress' } },
      {
        'pre-1': {
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
