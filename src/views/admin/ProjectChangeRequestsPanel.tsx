'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { Tag, type ChipTone } from '@/components/ui/spectrum-chip';
import { Textarea } from '@/components/ui/textarea';
import {
  decideChangeRequestInDb,
  listChangeRequestsFromDb,
  type ChangeRequestDto,
} from '@/lib/projects/project-admin-db';
import {
  CHANGE_REQUEST_KIND_LABEL,
  type ChangeRequestKind,
} from '@/lib/projects/project-change-request-types';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

const KIND_TONE: Record<ChangeRequestKind, ChipTone> = {
  delete_project: 'bad',
  change_client: 'idle',
  change_manager: 'idle',
};

function RequestDiff({ request }: { request: ChangeRequestDto }) {
  const fields = request.preview?.fields ?? [];
  if (fields.length === 0) return null;
  return (
    <dl className="mt-2 space-y-1">
      {fields.map((f) => (
        <div key={f.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px]">
          <dt className="text-ink-muted">{f.label}</dt>
          <dd className="flex min-w-0 flex-wrap items-baseline gap-1.5">
            <span className="text-ink-muted line-through">{f.from}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" aria-hidden />
            <span className="font-medium text-ink">{f.to}</span>
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
    <DashSection
      title={isAdminView ? 'Project change requests' : 'Your pending requests'}
      meta={String(requests.length)}
      className="mb-5"
      bodyClassName="p-0"
    >

      {requests.map((request) => {
        const kind = request.kind as ChangeRequestKind;
        const busy = decide.isPending && decide.variables?.id === request.id;
        return (
          <div key={request.id} className="border-b border-line-soft p-4 last:border-b-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={KIND_TONE[kind] ?? 'idle'}>{CHANGE_REQUEST_KIND_LABEL[kind] ?? request.kind}</Tag>
                  <span className="truncate text-[14px] font-medium text-ink">
                    {request.companyName ?? request.preview?.companyName ?? 'Project'}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-muted">
                  Asked by {request.requestedByName ?? 'a manager'}
                </p>
                <RequestDiff request={request} />
                {request.reason ? (
                  <p className="mt-2 max-w-prose text-[13px] text-ink-2">“{request.reason}”</p>
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
    </DashSection>
  );
}
