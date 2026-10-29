'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useWindowRequestActions, useWindowRequests } from '@/components/work/use-work';
import { formatWindow } from '@/lib/projects/schedule-windows';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';

/**
 * Approvals: date-change requests (G-17). A lead asked to move a manager-set window on a
 * step or filing; the manager (or an admin) approves, which applies the new window through
 * the schedule repository, or rejects with a note the lead sees in the task drawer. Hidden
 * when nothing is pending.
 */
export function DateChangeRequestsPanel() {
  const requests = useWindowRequests('pending');
  const { act } = useWindowRequestActions();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const rows = requests.data ?? [];
  if (requests.isLoading || rows.length === 0) return null;

  const decide = (id: string, action: 'approve' | 'reject', reason?: string) =>
    act.mutate(
      { id, action, note: reason },
      {
        onSuccess: () => {
          toastSuccess(action === 'approve' ? 'Dates changed' : 'Request refused');
          setNoteFor(null);
          setNote('');
        },
        onError: (err) => toastError("Couldn't record the decision", errorMessage(err)),
      },
    );

  return (
    <DashSection title="Date change requests" meta={String(rows.length)} className="mb-5" bodyClassName="p-0">
      {rows.map((r) => {
        const busy = act.isPending && act.variables?.id === r.id;
        const asked = { from: r.fromDate ?? r.toDate, to: r.toDate };
        return (
          <div key={r.id} className="border-b border-line-soft p-4 last:border-b-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-ink">{r.itemTitle}</div>
                <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                  {r.companyName} · asked by {r.requestedByName ?? 'a project lead'}
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-1.5 text-[12.5px] tabular-nums">
                  {r.currentWindow ? (
                    <>
                      <span className="text-ink-muted line-through">{formatWindow(r.currentWindow)}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" aria-hidden />
                    </>
                  ) : null}
                  <span className="font-medium text-ink">{formatWindow(asked)}</span>
                </div>
                <p className="mt-2 max-w-prose text-[13px] text-ink-2">“{r.reason}”</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setNoteFor(noteFor === r.id ? null : r.id);
                    setNote('');
                  }}
                >
                  Reject
                </Button>
                <Button size="sm" disabled={busy} onClick={() => decide(r.id, 'approve')}>
                  Approve
                </Button>
              </div>
            </div>
            {noteFor === r.id ? (
              <div className="mt-3 space-y-2">
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  aria-label="Reason for the lead"
                  maxLength={1000}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="destructive" disabled={busy || !note.trim()} onClick={() => decide(r.id, 'reject', note.trim())}>
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
