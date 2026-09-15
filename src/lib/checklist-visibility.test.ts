import { describe, expect, it } from 'vitest';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import {
  checklistViewerForRole,
  isStepReleasedToClient,
  isStepReleasedToFirm,
  redactChecklistSliceForViewer,
  redactChecklistStateForViewer,
} from '@/lib/checklist-visibility';

const draft: ChecklistItemStateSlice = {
  status: 'not-started',
  responses: {
    mcaRemarksSummary: 'lead typing',
    clarificationLetterUrl: 'e1/clarificationLetterUrl/1757900000000-letter.pdf',
  },
  notes: 'internal',
};

const requested: ChecklistItemStateSlice = {
  ...draft,
  status: 'in-progress',
  reviewSource: 'lead_manager_request',
  reviewStatus: 'reviewing',
  locked: true,
  clientSubmittedAt: '2026-09-15T10:00:00.000Z',
};

const accepted: ChecklistItemStateSlice = {
  ...requested,
  status: 'completed',
  completedOn: '2026-09-15',
  reviewStatus: 'accepted',
  reviewedBy: 'mgr',
  approval: { state: 'pending_client', managerApprovedBy: 'mgr' },
};

describe('checklistViewerForRole', () => {
  it('maps every firm role onto the firm viewer', () => {
    expect(checklistViewerForRole('intern')).toBe('lead');
    expect(checklistViewerForRole('client')).toBe('client');
    expect(checklistViewerForRole('manager')).toBe('firm');
    expect(checklistViewerForRole('admin')).toBe('firm');
    expect(checklistViewerForRole('super_admin')).toBe('firm');
    expect(checklistViewerForRole(undefined)).toBe('firm');
  });
});

describe('isStepReleasedToFirm', () => {
  it('keeps a lead draft private however much is filled', () => {
    expect(isStepReleasedToFirm(undefined)).toBe(false);
    expect(isStepReleasedToFirm(draft)).toBe(false);
    expect(isStepReleasedToFirm({ ...draft, status: 'in-progress' })).toBe(false);
  });

  it('releases on request, delivery, client submit, accept, complete and N/A', () => {
    expect(isStepReleasedToFirm(requested)).toBe(true);
    expect(isStepReleasedToFirm({ ...draft, deliveredToClientAt: '2026-09-15' })).toBe(true);
    expect(
      isStepReleasedToFirm({
        ...draft,
        reviewSource: 'client_submission',
        reviewStatus: 'reviewing',
        clientSubmittedAt: '2026-09-15',
      }),
    ).toBe(true);
    expect(isStepReleasedToFirm(accepted)).toBe(true);
    expect(isStepReleasedToFirm({ status: 'completed' })).toBe(true);
    expect(isStepReleasedToFirm({ status: 'not-applicable' })).toBe(true);
  });

  it('does not release on a pending ask-the-client request alone', () => {
    expect(
      isStepReleasedToFirm({
        ...draft,
        clientFillRequest: {
          status: 'pending_manager',
          requestedBy: 'lead',
          requestedAt: '2026-09-15',
        },
      }),
    ).toBe(false);
  });
});

describe('isStepReleasedToClient', () => {
  it('waits for the manager to accept a lead request', () => {
    expect(isStepReleasedToClient(draft)).toBe(false);
    expect(isStepReleasedToClient(requested)).toBe(false);
    expect(isStepReleasedToClient(accepted)).toBe(true);
  });

  it('pulls the step back while it is rejected or a change is requested', () => {
    expect(
      isStepReleasedToClient({ ...requested, reviewStatus: 'rejected', unlockedFields: ['x'] }),
    ).toBe(false);
    expect(
      isStepReleasedToClient({
        ...accepted,
        reviewStatus: 'rejected',
        approval: { state: 'change_requested', changeRequestedBy: 'client' },
      }),
    ).toBe(false);
    // Re-request after an accept: `completed` lingers, the client still waits.
    expect(isStepReleasedToClient({ ...accepted, reviewStatus: 'reviewing' })).toBe(false);
  });

  it('keeps the existing release paths', () => {
    expect(
      isStepReleasedToClient({
        status: 'in-progress',
        reviewSource: 'client_submission',
        reviewStatus: 'reviewing',
      }),
    ).toBe(true);
    expect(isStepReleasedToClient({ status: 'completed' })).toBe(true);
    expect(isStepReleasedToClient({ status: 'not-applicable' })).toBe(true);
    expect(
      isStepReleasedToClient({ status: 'in-progress', deliveredToClientAt: '2026-09-15' }),
    ).toBe(true);
  });
});

describe('redactChecklistSliceForViewer', () => {
  it('is a no-op for the lead', () => {
    expect(redactChecklistSliceForViewer('lead', draft)).toBe(draft);
    expect(redactChecklistStateForViewer('lead', { 'pre-11': draft })).toEqual({
      'pre-11': draft,
    });
  });

  it('strips answers and notes from an unreleased draft for the firm, nothing else', () => {
    const pending = {
      ...draft,
      clientFillRequest: {
        status: 'pending_manager' as const,
        requestedBy: 'lead',
        requestedAt: '2026-09-15',
        note: 'please ask them',
      },
    };
    expect(redactChecklistSliceForViewer('firm', pending)).toEqual({
      status: 'not-started',
      clientFillRequest: pending.clientFillRequest,
    });
  });

  it('returns a released slice untouched for the firm', () => {
    expect(redactChecklistSliceForViewer('firm', requested)).toBe(requested);
  });

  it('hides the whole review trail from the client until accepted', () => {
    expect(redactChecklistSliceForViewer('client', requested)).toEqual({
      status: 'in-progress',
    });
    const reRequested = { ...accepted, reviewStatus: 'reviewing' as const };
    expect(redactChecklistSliceForViewer('client', reRequested)).toEqual({
      status: 'in-progress',
      approval: accepted.approval,
    });
    expect(redactChecklistSliceForViewer('client', accepted)).toBe(accepted);
  });

  it('gives the same answer on its own output', () => {
    const changeRequested: ChecklistItemStateSlice = {
      ...accepted,
      reviewStatus: 'rejected',
      approval: { state: 'change_requested' },
    };
    for (const viewer of ['firm', 'client'] as const) {
      for (const slice of [draft, requested, changeRequested]) {
        const once = redactChecklistSliceForViewer(viewer, slice);
        expect(redactChecklistSliceForViewer(viewer, once)).toEqual(once);
      }
    }
    expect(isStepReleasedToClient(redactChecklistSliceForViewer('client', changeRequested))).toBe(
      false,
    );
  });

  it('keeps the change-requested approval state visible to the client', () => {
    const changeRequested: ChecklistItemStateSlice = {
      ...accepted,
      reviewStatus: 'rejected',
      rejectionNote: 'Fix the address',
      unlockedFields: ['mcaRemarksSummary'],
      approval: { state: 'change_requested', changeNote: 'Fix the address' },
    };
    expect(redactChecklistSliceForViewer('client', changeRequested)).toEqual({
      status: 'in-progress',
      approval: changeRequested.approval,
    });
  });
});
