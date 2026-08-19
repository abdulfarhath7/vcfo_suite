'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import {
  internLeadManagerRequestPatch,
  isAwaitingReview,
} from '@/lib/checklist-item-review';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { getItem } from '@/data/checklist';

/** Lead action: mark any phase milestone as awaiting project manager review. */
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
  if (!item) return null;
  const awaitingLeadRequest =
    isAwaitingReview(itemState) && itemState?.reviewSource === 'lead_manager_request';

  const request = async (resendEmail: boolean) => {
    setBusy(true);
    try {
      await updateItem(engagementId, itemId, {
        ...internLeadManagerRequestPatch(itemState),
        ...(resendEmail ? { resendManagerEmail: true } : {}),
      });
      if (!resendEmail) {
        toastSuccess(
          'Sent to Approvals inbox',
          'The manager can review in VCFO. Watch for a second toast — that is the email from your Outlook (or Resend if Outlook is not connected).',
        );
      }
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
        onClick={() => void request(awaitingLeadRequest)}
        className={primary ? 'w-full cursor-pointer' : 'cursor-pointer'}
      >
        {busy
          ? awaitingLeadRequest
            ? 'Sending…'
            : 'Requesting…'
          : awaitingLeadRequest
            ? 'Email manager again'
            : 'Request manager approval'}
      </Button>
    </div>
  );
}
