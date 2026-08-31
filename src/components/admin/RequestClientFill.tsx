'use client';

import { useState } from 'react';
import { MailQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import {
  canRequestClientFill,
  clientFillLabel,
  isClientFillPending,
} from '@/lib/checklist-client-fill';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { isAdminOrManager } from '@/lib/auth';
import { getItem } from '@/data/checklist';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/**
 * Lead action: ask the client to fill this step. It goes to the project manager
 * first — only an approved request reaches the client, and it is sent from the
 * manager's own mailbox.
 *
 * The same component renders the manager's Approve / Decline pair while a
 * request is pending, so both roles see the state on the step they are looking at.
 */
export function RequestClientFill({
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
  const { user, setClientFillRequest } = useApp();
  const [busy, setBusy] = useState<'request' | 'approve' | 'decline' | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [note, setNote] = useState('');
  const [declineNote, setDeclineNote] = useState('');

  const isLead = user?.role === 'intern';
  const canDecide = isAdminOrManager(user?.role);
  if (!isLead && !canDecide) return null;

  const item = getItem(itemId);
  if (!item) return null;

  const request = itemState?.clientFillRequest;
  const pending = isClientFillPending(request);
  const statusLabel = clientFillLabel(request);
  const primary = emphasis === 'primary';

  const run = async (
    action: 'request' | 'approve' | 'decline',
    actionNote?: string,
  ) => {
    setBusy(action);
    try {
      await setClientFillRequest(engagementId, itemId, action, actionNote);
      if (action === 'request') {
        toastSuccess(
          'Sent for manager approval',
          'Nothing reaches the client until the project manager approves.',
        );
        setRequestOpen(false);
        setNote('');
      } else if (action === 'approve') {
        toastSuccess(
          'Request sent to the client',
          `${item.title} was emailed from your mailbox with a link to the step.`,
        );
      } else {
        toastSuccess('Request declined', 'Nothing was sent to the client.');
        setDeclineOpen(false);
        setDeclineNote('');
      }
    } catch (err) {
      toastError(
        action === 'request'
          ? 'Could not send the request'
          : action === 'approve'
            ? 'Could not send it to the client'
            : 'Could not decline',
        errorMessage(err, 'Try again.'),
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {statusLabel ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {statusLabel}
        </p>
      ) : null}

      {isLead && canRequestClientFill(request) ? (
        <Button
          type="button"
          size="sm"
          variant={primary ? 'default' : 'outline'}
          disabled={busy !== null}
          onClick={() => setRequestOpen(true)}
          className={cn('cursor-pointer gap-1.5', primary && 'w-full')}
        >
          <MailQuestion className="h-3.5 w-3.5" aria-hidden />
          Request client to fill
        </Button>
      ) : null}

      {canDecide && pending ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy !== null}
            onClick={() => void run('approve')}
            className="cursor-pointer"
          >
            {busy === 'approve' ? 'Sending…' : 'Approve and send'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => setDeclineOpen(true)}
            className="cursor-pointer"
          >
            Decline
          </Button>
        </div>
      ) : null}

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request client to fill {item.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="client-fill-note">Note for the client</Label>
            <Textarea
              id="client-fill-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional — the manager sees this, and it goes into the client email."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRequestOpen(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button onClick={() => void run('request', note)} disabled={busy !== null}>
              {busy === 'request' ? 'Sending…' : 'Send for approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="client-fill-decline-note">Reason for the lead</Label>
            <Textarea
              id="client-fill-decline-note"
              rows={3}
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineOpen(false)}
              disabled={busy !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void run('decline', declineNote)}
              disabled={busy !== null}
            >
              {busy === 'decline' ? 'Declining…' : 'Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
