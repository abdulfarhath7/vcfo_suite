'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GoldButton } from '@/components/noir';
import { useApp } from '@/context/AppContext';
import {
  getInternReviewLabel,
  isAwaitingReview,
  isReviewAccepted,
  isReviewRejected,
} from '@/lib/checklist-item-review';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { isAdminOrManager } from '@/lib/auth';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

interface ChecklistReviewActionsProps {
  engagementId: string;
  itemId: string;
  itemState?: ChecklistItemStateSlice;
  theme?: 'light' | 'dark';
  className?: string;
}

export function ChecklistReviewActions({
  engagementId,
  itemId,
  itemState,
  theme = 'light',
  className,
}: ChecklistReviewActionsProps) {
  const { reviewChecklistItem, user } = useApp();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);

  const canApprove = isAdminOrManager(user?.role);
  const isLight = theme === 'light';
  const isLeadRequest = itemState?.reviewSource === 'lead_manager_request';
  const awaiting = isAwaitingReview(itemState);
  const accepted = isReviewAccepted(itemState);
  const rejected = isReviewRejected(itemState);
  const statusLabel = getInternReviewLabel(itemState);

  if (!awaiting && !accepted && !rejected) return null;

  const runReview = async (action: 'accept' | 'reject', note?: string) => {
    if (!canApprove) return;
    setBusy(action);
    try {
      await reviewChecklistItem(engagementId, itemId, action, note);
      toastSuccess(
        action === 'accept' ? 'Submission accepted' : 'Submission rejected',
        action === 'accept'
          ? 'This milestone is marked approved.'
          : 'The client can update unlocked fields and resubmit.',
      );
      if (action === 'reject') {
        setRejectOpen(false);
        setRejectNote('');
      }
    } catch (err) {
      toastError(
        action === 'accept' ? 'Could not accept' : 'Could not reject',
        errorMessage(err, 'Try again.'),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={cn(
        'space-y-3',
        isLight ? 'surface px-4 py-4' : 'rounded-md border border-hairline bg-raised/40 px-3 py-3',
        className,
      )}
    >
      <p
        className={cn(
          'text-xs font-medium',
          isLight ? 'text-foreground' : 'text-paper',
        )}
      >
        {isLeadRequest ? 'Lead → manager approval' : 'KYC / client submission review'}
      </p>
      {statusLabel && (
        <p className={cn('text-[11px]', isLight ? 'text-muted-foreground' : 'text-paper-muted')}>
          {canApprove
            ? statusLabel
            : awaiting
              ? 'Awaiting project manager or admin approval'
              : statusLabel}
        </p>
      )}

      {awaiting && canApprove && (
        <div className="flex flex-wrap items-center gap-2">
          {isLight ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy !== null}
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="success"
                disabled={busy !== null}
                onClick={() => void runReview('accept')}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                {busy === 'accept' ? 'Accepting…' : 'Accept'}
              </Button>
            </>
          ) : (
            <>
              <GoldButton
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => setRejectOpen(true)}
                className="text-danger hover:text-danger"
              >
                Reject
              </GoldButton>
              <GoldButton
                size="sm"
                disabled={busy !== null}
                onClick={() => void runReview('accept')}
                className="bg-success text-success-foreground hover:bg-success/90 hover:brightness-100 active:brightness-95"
              >
                {busy === 'accept' ? 'Accepting…' : 'Accept'}
              </GoldButton>
            </>
          )}
        </div>
      )}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject submission</AlertDialogTitle>
            <AlertDialogDescription>
              The client will be asked to fix and resubmit. Optionally add a short note explaining
              what needs to change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="reject-note" className="text-xs">
              Note for client (optional)
            </Label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="e.g. Please re-upload a clearer passport scan."
              className="text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'reject'}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy === 'reject'}
              onClick={(e) => {
                e.preventDefault();
                void runReview('reject', rejectNote.trim() || undefined);
              }}
            >
              {busy === 'reject' ? 'Rejecting…' : 'Reject submission'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
