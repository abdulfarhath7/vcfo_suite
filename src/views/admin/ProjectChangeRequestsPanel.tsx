'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, GitPullRequestArrow, Loader2 } from 'lucide-react';
import { Surface, Eyebrow } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  decideChangeRequestInDb,
  listChangeRequestsFromDb,
  type ChangeRequestDto,
} from '@/lib/project-admin-db';
import {
  CHANGE_REQUEST_KIND_LABEL,
  type ChangeRequestKind,
} from '@/lib/project-change-request-types';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

const KIND_TONE: Record<ChangeRequestKind, string> = {
  delete_project: 'bg-danger-light text-danger-text',
  change_client: 'bg-accent-amber-soft text-accent-amber',
  change_manager: 'bg-accent-violet-soft text-accent-violet',
};

function RequestDiff({ request }: { request: ChangeRequestDto }) {
  const fields = request.preview?.fields ?? [];
  if (fields.length === 0) return null;
  return (
    <dl className="mt-2 space-y-1">
      {fields.map((f) => (
        <div key={f.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]">
          <dt className="text-text-tertiary">{f.label}</dt>
          <dd className="flex min-w-0 flex-wrap items-baseline gap-1.5">
            <span className="text-muted-foreground line-through">{f.from}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-text-tertiary" aria-hidden />
            <span className="font-semibold text-ink">{f.to}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Pending project change requests.
 *
 * Admin view decides them — approving executes the stored payload server-side
 * and reports back what it did. Manager view is read-only apart from
 * withdrawing a request they filed themselves.
 */
export function ProjectChangeRequestsPanel({ scope }: { scope: 'firm' | 'manager' }) {
  const queryClient = useQueryClient();
  const isAdminView = scope === 'firm';
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['engagement-change-requests', 'pending'],
    queryFn: () => listChangeRequestsFromDb(['pending']),
    staleTime: 15_000,
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'approved' | 'rejected' | 'cancelled';
      reason?: string;
    }) => decideChangeRequestInDb(id, decision, reason),
    onSuccess: (result, variables) => {
      if (variables.decision === 'approved') {
        toastSuccess('Approved', result.applied?.summary ?? 'The change has been applied.');
      } else if (variables.decision === 'rejected') {
        toastSuccess('Rejected', 'The manager will see your decision.');
      } else {
        toastSuccess('Withdrawn', 'The request has been cancelled.');
      }
      setNoteFor(null);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['engagement-change-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['engagements'] });
    },
    onError: (err) => {
      toastError("Couldn't record the decision", errorMessage(err, 'Try again in a moment.'));
    },
  });

  const requests = requestsQuery.data ?? [];
  if (requestsQuery.isLoading || requests.length === 0) return null;

  return (
    <Surface className="mb-4 divide-y divide-border">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-amber text-white">
          <GitPullRequestArrow className="h-3.5 w-3.5" aria-hidden />
        </span>
        <Eyebrow>
          {isAdminView ? 'Project change requests' : 'Your pending requests'} · {requests.length}
        </Eyebrow>
      </div>

      {requests.map((request) => {
        const kind = request.kind as ChangeRequestKind;
        const busy = decide.isPending && decide.variables?.id === request.id;
        return (
          <div key={request.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                      KIND_TONE[kind] ?? 'bg-raised text-muted-foreground',
                    )}
                  >
                    {CHANGE_REQUEST_KIND_LABEL[kind] ?? request.kind}
                  </span>
                  <span className="truncate text-[13px] font-semibold text-ink">
                    {request.companyName ?? request.preview?.companyName ?? 'Project'}
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  Asked by {request.requestedByName ?? 'a manager'}
                </p>
                <RequestDiff request={request} />
                {request.reason ? (
                  <p className="mt-2 max-w-prose text-[12px] text-ink-soft">“{request.reason}”</p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {isAdminView ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setNoteFor(noteFor === request.id ? null : request.id);
                        setNote('');
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => decide.mutate({ id: request.id, decision: 'approved' })}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                      Approve &amp; apply
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => decide.mutate({ id: request.id, decision: 'cancelled' })}
                  >
                    Withdraw
                  </Button>
                )}
              </div>
            </div>

            {isAdminView && noteFor === request.id ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why are you rejecting this? The manager will see it."
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      decide.mutate({
                        id: request.id,
                        decision: 'rejected',
                        reason: note.trim() || undefined,
                      })
                    }
                  >
                    Confirm rejection
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setNoteFor(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </Surface>
  );
}
