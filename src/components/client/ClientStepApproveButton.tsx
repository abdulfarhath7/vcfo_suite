'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import {
  clientApproveBlockedReason,
  isAwaitingClientApproval,
} from '@/lib/checklist-step-approval';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

/**
 * The client's sign-off on one step.
 *
 * Enabled only while the step is `pending_client` — i.e. the lead has submitted
 * it and a manager has reviewed it. Every other state disables the button and
 * says whose turn it actually is, rather than failing on click.
 *
 * Approving the last outstanding step in a phase is what triggers the single
 * phase-approved email to the lead and managers; the server decides that, not
 * this component, so a double-click cannot send twice.
 */
export function ClientStepApproveButton({
  engagementId,
  stepId,
  itemState,
  onApproved,
  className,
}: {
  engagementId: string;
  stepId: string;
  itemState?: ChecklistItemStateSlice;
  onApproved?: () => void;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const enabled = isAwaitingClientApproval(itemState);
  const blockedReason = clientApproveBlockedReason(itemState);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/client/steps/${encodeURIComponent(stepId)}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ engagementId }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        phaseApproved?: { title: string } | null;
      };
      if (!res.ok) throw new Error(data.error ?? 'Could not approve this step');
      return data;
    },
    onSuccess: (data) => {
      toastSuccess(
        'Approved',
        data.phaseApproved
          ? `That completes ${data.phaseApproved.title}. Your team has been told.`
          : 'Your team can move on to the next step.',
      );
      void queryClient.invalidateQueries({ queryKey: ['checklist', engagementId] });
      onApproved?.();
    },
    onError: (error) => toastError(errorMessage(error)),
  });

  return (
    <Button
      type="button"
      size="sm"
      className={className}
      disabled={!enabled || mutation.isPending}
      title={blockedReason ?? undefined}
      onClick={() => mutation.mutate()}
    >
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      {mutation.isPending ? 'Approving…' : 'Approve'}
    </Button>
  );
}
