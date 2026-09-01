import { describe, expect, it } from 'vitest';

import { getIncorporationPhases } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import {
  approvalStateOf,
  buildChangeRequest,
  buildClientApproval,
  buildManagerApproval,
  clientApproveBlockedReason,
  isAwaitingClientApproval,
  changeRequestReopenPatch,
  isPhaseFullyClientApproved,
  phaseCompletedByApproval,
  phaseForStep,
  stepApprovalLabel,
} from '@/lib/checklist-step-approval';

const NOW = '2026-09-01T10:00:00.000Z';
const phase = phaseForStep(getIncorporationPhases()[0]!.items[0]!.id)!;

function approved(): ChecklistItemStateSlice {
  return {
    status: 'completed',
    approval: buildClientApproval({ approvedBy: 'client-1', now: NOW }),
  };
}

function stateWith(
  entries: Array<[string, ChecklistItemStateSlice]>,
): Record<string, ChecklistItemStateSlice> {
  return Object.fromEntries(entries);
}

describe('approval state', () => {
  it('reads an untouched step as none, not undefined', () => {
    expect(approvalStateOf(undefined)).toBe('none');
    expect(approvalStateOf({ status: 'not-started' })).toBe('none');
  });

  it('only pending_client is the client’s turn', () => {
    const managerApproved = buildManagerApproval({ approvedBy: 'mgr-1', now: NOW });
    expect(managerApproved.state).toBe('pending_client');
    expect(isAwaitingClientApproval({ status: 'completed', approval: managerApproved })).toBe(true);
    expect(isAwaitingClientApproval(approved())).toBe(false);
    expect(clientApproveBlockedReason({ status: 'completed', approval: managerApproved })).toBeNull();
  });

  it('explains why the button is disabled in every other state', () => {
    expect(clientApproveBlockedReason(undefined)).toMatch(/waiting for your team/i);
    expect(clientApproveBlockedReason(approved())).toMatch(/already approved/i);
    const changed = buildChangeRequest({
      requestedBy: 'client-1',
      note: 'wrong address',
      now: NOW,
    });
    expect(clientApproveBlockedReason({ status: 'in-progress', approval: changed })).toMatch(
      /working on the change/i,
    );
  });

  it('a change request drops the client’s earlier approval', () => {
    const changed = buildChangeRequest({
      requestedBy: 'client-1',
      note: 'wrong address',
      now: NOW,
      previous: buildClientApproval({ approvedBy: 'client-1', now: NOW }),
    });
    expect(changed.state).toBe('change_requested');
    expect(changed.clientApprovedAt).toBeUndefined();
    expect(changed.changeNote).toBe('wrong address');
  });

  it('a fresh manager approval clears the last change request trail', () => {
    const reapproved = buildManagerApproval({
      approvedBy: 'mgr-1',
      now: NOW,
      previous: buildChangeRequest({ requestedBy: 'client-1', note: 'fix it', now: NOW }),
    });
    expect(reapproved.state).toBe('pending_client');
    expect(reapproved.changeNote).toBeUndefined();
  });

  it('labels each state for the pill', () => {
    expect(stepApprovalLabel(undefined)).toBeNull();
    expect(stepApprovalLabel(approved())).toMatch(/approved/i);
  });
});

describe('phase completion', () => {
  it('an untouched phase is never complete', () => {
    expect(isPhaseFullyClientApproved(phase, {})).toBe(false);
  });

  it('needs every tracked step approved, and ignores steps never sent', () => {
    const [first, second] = phase.items;
    const partial = stateWith([
      [first!.id, approved()],
      [
        second!.id,
        { status: 'completed', approval: buildManagerApproval({ approvedBy: 'm', now: NOW }) },
      ],
    ]);
    expect(isPhaseFullyClientApproved(phase, partial)).toBe(false);

    // The second step is now approved too; the rest of the phase was never sent
    // for approval, so it does not hold the phase open.
    const done = stateWith([
      [first!.id, approved()],
      [second!.id, approved()],
    ]);
    expect(isPhaseFullyClientApproved(phase, done)).toBe(true);
  });

  it('a step still in flight holds the phase open', () => {
    const [first, second] = phase.items;
    const inFlight = stateWith([
      [first!.id, approved()],
      [
        second!.id,
        {
          status: 'in-progress',
          approval: buildChangeRequest({ requestedBy: 'c', note: 'no', now: NOW }),
        },
      ],
    ]);
    expect(isPhaseFullyClientApproved(phase, inFlight)).toBe(false);
  });

  it('announces the phase exactly once', () => {
    const [first] = phase.items;
    const state = stateWith([[first!.id, approved()]]);

    const completed = phaseCompletedByApproval(first!.id, state);
    expect(completed?.id).toBe(phase.id);

    // Once the completing step carries the stamp, a re-approve sends nothing.
    const stamped = stateWith([
      [
        first!.id,
        {
          status: 'completed',
          approval: {
            ...approved().approval!,
            phaseCompletionNotifiedAt: NOW,
          },
        },
      ],
    ]);
    expect(phaseCompletedByApproval(first!.id, stamped)).toBeNull();
  });

  it('a step outside the four phases completes nothing', () => {
    expect(phaseCompletedByApproval('not-a-real-step', {})).toBeNull();
  });
});

describe('reopening on a change request', () => {
  it('writes the same shape a manager rejection writes', () => {
    // These two fields are what `isChecklistStepSequentiallyComplete` reads, and
    // therefore what re-locks every step after this one. A change here silently
    // changes gating, so it is asserted directly.
    const patch = changeRequestReopenPatch({
      itemId: phase.items[0]!.id,
      note: '  wrong registered address  ',
      requestedBy: 'client-1',
      now: NOW,
    });

    expect(patch.reviewStatus).toBe('rejected');
    expect(patch.unlockedFields?.length).toBeGreaterThan(0);
    expect(patch.locked).toBe(true);
    expect(patch.rejectionNote).toBe('wrong registered address');
    expect(patch.approval?.state).toBe('change_requested');
    expect(patch.approval?.changeNote).toBe('wrong registered address');
  });
});
