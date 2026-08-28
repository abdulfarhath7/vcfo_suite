"use client";

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Engagement } from '@/data/engagements';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createChangeRequestInDb, deleteProjectInDb } from '@/lib/project-admin-db';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

/**
 * Delete is a soft delete: the project disappears from every list and from the
 * client portal, but documents, checklist history, and the audit trail survive
 * and an admin can restore it from the recycle bin.
 *
 * Admins type the project name to confirm. Managers file a request instead.
 */
export function DeleteProjectDialog({
  engagement,
  open,
  onOpenChange,
  mode,
  onDeleted,
}: {
  engagement: Engagement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'direct' | 'request';
  /** Called after a successful delete so the caller can navigate away. */
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmText('');
      setReason('');
    }
  }, [open]);

  const nameMatches =
    confirmText.trim().toLowerCase() === engagement.companyName.trim().toLowerCase();
  const canSubmit = mode === 'request' ? true : nameMatches;

  const submit = async () => {
    if (!canSubmit) return;
    setWorking(true);
    try {
      if (mode === 'direct') {
        await deleteProjectInDb(engagement.id);
        toastSuccess('Project deleted', `${engagement.companyName} moved to the recycle bin.`);
        onDeleted();
      } else {
        await createChangeRequestInDb({
          engagementId: engagement.id,
          kind: 'delete_project',
          payload: {},
          preview: {
            companyName: engagement.companyName,
            fields: [{ label: 'Project', from: engagement.companyName, to: 'Deleted' }],
          },
          reason: reason.trim() || undefined,
        });
        toastSuccess('Sent for approval', 'An admin will review this deletion.');
      }
      onOpenChange(false);
    } catch (e) {
      toastError(
        mode === 'direct' ? "Couldn't delete the project" : "Couldn't send the request",
        errorMessage(e, 'Try again.'),
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'direct' ? 'Delete project' : 'Request project deletion'}
          </DialogTitle>
          <DialogDescription>
            {engagement.companyName} disappears from every list and from the client portal.
            Documents and history are kept, and an admin can restore it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode === 'direct' ? (
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <span className="font-semibold text-ink">{engagement.companyName}</span> to
                confirm
              </Label>
              <Input
                id="delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="delete-reason">Why should this be deleted?</Label>
              <Textarea
                id="delete-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Context for the admin reviewing this."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            Cancel
          </Button>
          <Button
            variant={mode === 'direct' ? 'destructive' : 'default'}
            onClick={submit}
            disabled={working || !canSubmit}
          >
            {mode === 'direct' ? <Trash2 className="h-3.5 w-3.5" aria-hidden /> : null}
            {working ? 'Working…' : mode === 'direct' ? 'Delete project' : 'Send for approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
