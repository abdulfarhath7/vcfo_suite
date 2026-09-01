'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageSquarePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

/**
 * The client's one action on a step: ask the firm to change something.
 *
 * The client never edits their own file — the firm is the single author of every
 * value on an engagement. This posts the ask to `/api/client/change-requests`,
 * which lands it as a task in the delivery lead's queue.
 */
export function ClientChangeRequestButton({
  engagementId,
  stepId,
  stepTitle,
  className,
}: {
  engagementId: string;
  stepId: string;
  stepTitle: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/client/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId, stepId, note }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not send the request');
    },
    onSuccess: () => {
      toastSuccess('Sent to your team');
      setNote('');
      setOpen(false);
    },
    onError: (error) => toastError(errorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className={className}>
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
          Request a change
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{stepTitle}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={5}
          aria-label="What should change"
          placeholder="What should change?"
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!note.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
