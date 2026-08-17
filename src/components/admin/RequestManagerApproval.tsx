'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import {
  isAwaitingReview,
  isReviewAccepted,
} from '@/lib/checklist-item-review';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { PRIMARY_BUCKETS_SET } from '@/lib/project-stuck';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { getItem } from '@/data/checklist';

/** Lead action: mark Pre/Post milestone as awaiting project manager review. */
export function RequestManagerApproval({
  engagementId,
  itemId,
  itemState,
  className,
  emphasis = 'default',
}: {
  engagementId: string;
  itemId: string;
  itemState?: ChecklistItemStateSlice;
  className?: string;
  emphasis?: 'default' | 'primary';
}) {
  const { user, updateItem } = useApp();
  const [busy, setBusy] = useState(false);

  if (user?.role !== 'intern') return null;

  const item = getItem(itemId);
  if (!item || !PRIMARY_BUCKETS_SET.has(item.bucket)) return null;
  if (isAwaitingReview(itemState) || isReviewAccepted(itemState)) return null;

  const request = async () => {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await updateItem(engagementId, itemId, {
        reviewStatus: 'reviewing',
        reviewSource: 'lead_manager_request',
        locked: true,
        // Stamp so Accept/Reject UI (which gates on submission lock) activates.
        clientSubmittedAt: itemState?.clientSubmittedAt || now,
        unlockedFields: [],
        rejectionNote: undefined,
        reviewedAt: undefined,
        reviewedBy: undefined,
        status: itemState?.status === 'completed' ? 'completed' : 'in-progress',
      });
      toastSuccess(
        'Manager approval requested',
        'This milestone is now in the project manager Approvals inbox.',
      );
    } catch (err) {
      toastError('Could not request approval', errorMessage(err, 'Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const primary = emphasis === 'primary';

  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        variant={primary ? 'default' : 'outline'}
        disabled={busy}
        onClick={() => void request()}
        className={primary ? 'w-full cursor-pointer' : 'cursor-pointer'}
      >
        {busy ? 'Requesting…' : 'Request manager approval'}
      </Button>
    </div>
  );
}
