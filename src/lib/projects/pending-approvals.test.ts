import { describe, expect, it } from 'vitest';
import { listPendingApprovals, pendingApprovalKind } from '@/lib/projects/pending-approvals';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';

const eng = { id: 'e1', companyName: 'Demo', slug: 'demo', stage: 'Pre-Incorporation' as const };
const pendingLead: ChecklistItemStateSlice = {
  status: 'in-progress',
  reviewStatus: 'reviewing',
  reviewSource: 'lead_manager_request',
};

function rows(state: Record<string, ChecklistItemStateSlice>) {
  return listPendingApprovals([eng], () => state);
}

describe('listPendingApprovals', () => {
  it('lists no direct-flow step, even with old pending data', () => {
    expect(
      rows({
        'pre-1': pendingLead,
        'pre-13': { status: 'in-progress', reviewStatus: 'reviewing', reviewSource: 'client_submission', locked: true, clientSubmittedAt: 'x' },
        'pre-12': { status: 'in-progress', clientFillRequest: { status: 'pending_manager', requestedBy: 'l', requestedAt: 'x' } },
      }),
    ).toEqual([]);
  });

  it('lists the board resolution as "Board resolution"', () => {
    const out = rows({ 'pre-2': pendingLead });
    expect(out).toHaveLength(1);
    expect(out[0]!.itemId).toBe('pre-2');
    expect(pendingApprovalKind(out[0]!)).toBe('Board resolution');
  });

  it('keeps post-incorporation approvals', () => {
    const out = rows({ 'post-1': pendingLead });
    expect(out.map((r) => r.itemId)).toEqual(['post-1']);
    expect(pendingApprovalKind(out[0]!)).toBe('Lead request');
  });
});
