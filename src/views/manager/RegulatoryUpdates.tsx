'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/**
 * Regulatory updates — the manager's review queue (owner, 2026-10-23).
 * Every official update the watchers find waits here. A manager reads the
 * review document and approves (Ask VCFO uses it for everyone; announcement
 * and notices go out) or rejects with a reason (it stays hidden). Admins and
 * super admins can look but not decide.
 */

type ReviewStatus = 'pending' | 'approved' | 'rejected';

type UpdateRow = {
  id: string;
  title: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  summary: string | null;
  status: string;
  error: string | null;
  reviewStatus: ReviewStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  hasReviewPdf: boolean;
  chunkCount: number;
  createdAt: string;
  feed: { label: string; act: string } | null;
};

const TABS: Array<{ key: ReviewStatus; label: string }> = [
  { key: 'pending', label: 'Waiting for review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(body?.error || fallback);
  return body as T;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
}

export default function RegulatoryUpdates({ basePath }: { basePath: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ReviewStatus>('pending');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const list = useQuery({
    queryKey: ['regulatory-updates', tab],
    queryFn: async () =>
      readJson<{ canDecide: boolean; updates: UpdateRow[] }>(
        await fetch(`/api/regulatory-updates?status=${tab}`),
        'Could not load the updates',
      ),
    refetchInterval: (q) => (q.state.data?.updates.some((u) => u.status === 'processing' || !u.hasReviewPdf) ? 5000 : false),
  });
  const counts = useQuery({
    queryKey: ['regulatory-updates', 'pending-count'],
    queryFn: async () =>
      readJson<{ updates: UpdateRow[] }>(await fetch('/api/regulatory-updates?status=pending'), 'Could not load').then((r) => r.updates.length),
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: 'approve' | 'reject'; note?: string }) =>
      readJson<{ update: UpdateRow }>(
        await fetch(`/api/regulatory-updates/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, note }),
        }),
        'Could not record the decision',
      ),
    onSuccess: (_data, vars) => {
      setRejecting(null);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['regulatory-updates'] });
      void queryClient.invalidateQueries({ queryKey: ['ask', 'sources'] });
      if (vars.decision === 'approve') {
        toastSuccess('Approved', 'Ask VCFO now answers from this update. Clients and staff have been told.');
      } else {
        toastSuccess('Rejected', 'The update stays hidden. Your reason is saved.');
      }
    },
    onError: (err: Error) => toastError('Could not record the decision', err.message),
  });

  const canDecide = list.data?.canDecide ?? false;

  return (
    <PageTransition>
      <SEO title="Regulatory updates — VCFO Suite" description="Official updates waiting for a manager's review." path={`${basePath}/regulatory-updates`} />
      <PageHeader
        accent="amber"
        icon={ScrollText}
        title="Regulatory updates"
        subtitle="Government notifications and circulars the tool found. Nothing reaches Ask VCFO or clients until a manager approves it."
      />

      <div role="tablist" aria-label="Review state" className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'min-h-[36px] rounded-full border px-3.5 text-[12.5px] font-medium',
              tab === t.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-panel text-foreground hover:bg-muted',
            )}
          >
            {t.label}
            {t.key === 'pending' && typeof counts.data === 'number' ? ` (${counts.data})` : ''}
          </button>
        ))}
      </div>

      {!canDecide && list.data ? (
        <p className="mt-3 text-[12.5px] text-muted-foreground">You can read this queue. Only a manager can approve or reject.</p>
      ) : null}

      <section className="mt-3" aria-label="Updates">
        {list.isLoading && <p className="text-[13px] text-muted-foreground">Loading…</p>}
        {list.isError && (
          <p role="alert" className="text-[13px] text-danger-text">
            {(list.error as Error).message}
          </p>
        )}
        {list.data && list.data.updates.length === 0 && (
          <p className="rounded-[var(--radius)] border border-border bg-panel px-4 py-6 text-center text-[13px] text-muted-foreground">
            {tab === 'pending' ? 'Nothing is waiting for review.' : `No ${tab} updates yet.`}
          </p>
        )}
        <ul className="space-y-3">
          {list.data?.updates.map((u) => {
            const stillReading = u.status === 'processing' || (!u.hasReviewPdf && u.status === 'ready');
            return (
              <li key={u.id} className="rounded-[var(--radius)] border border-border bg-panel p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium text-foreground">
                      {u.feed ? (
                        <span className="mr-2 rounded-full bg-primary-light px-2 py-0.5 align-middle text-[11px] font-medium text-primary">{u.feed.act}</span>
                      ) : null}
                      {u.title}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {u.feed?.label ?? 'Official source'}
                      {u.publishedAt ? ` · published ${u.publishedAt}` : ''}
                      {` · found ${fmtDateTime(u.createdAt)}`}
                      {u.sourceUrl ? (
                        <>
                          {' · '}
                          <a href={u.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            original on the government site
                          </a>
                        </>
                      ) : null}
                    </p>
                    {u.summary ? <p className="mt-2 text-[13px] text-foreground">What changed: {u.summary}</p> : null}
                    {u.status === 'failed' && u.error ? <p className="mt-2 text-[12.5px] text-danger-text">Could not be read: {u.error}</p> : null}
                    {stillReading && u.status !== 'failed' ? (
                      <p className="mt-2 text-[12.5px] text-muted-foreground">Still being read… the review document appears here when ready.</p>
                    ) : null}
                    {u.reviewStatus !== 'pending' ? (
                      <p className="mt-2 text-[12.5px] text-muted-foreground">
                        {u.reviewStatus === 'approved' ? 'Approved' : 'Rejected'} {fmtDateTime(u.reviewedAt)}
                        {u.reviewNote ? ` · "${u.reviewNote}"` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {u.chunkCount} piece{u.chunkCount === 1 ? '' : 's'} read
                    </span>
                    {u.hasReviewPdf ? (
                      <a
                        href={`/api/regulatory-updates/${u.id}/review-pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[36px] items-center rounded-[var(--radius-md)] border border-border px-3 text-[12.5px] font-medium text-foreground hover:bg-muted"
                      >
                        Open review document
                      </a>
                    ) : null}
                    {canDecide && u.reviewStatus === 'pending' && !stillReading ? (
                      <>
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: u.id, decision: 'approve' })}
                          className="min-h-[36px] rounded-[var(--radius-md)] bg-primary px-3 text-[12.5px] font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={decide.isPending}
                          onClick={() => {
                            setRejecting(rejecting === u.id ? null : u.id);
                            setNote('');
                          }}
                          className="min-h-[36px] rounded-[var(--radius-md)] border border-danger/40 px-3 text-[12.5px] font-medium text-danger-text hover:bg-danger-light disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                {rejecting === u.id ? (
                  <form
                    className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!note.trim()) {
                        toastError('Add a reason', 'Say what was wrong, so the fetching can be fixed.');
                        return;
                      }
                      decide.mutate({ id: u.id, decision: 'reject', note });
                    }}
                  >
                    <label className="min-w-[260px] flex-1 text-[12px] font-medium text-foreground">
                      Why is this being rejected?
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder="e.g. Not new — this is the 2025 notification; or the summary misreads the rate."
                        className="mt-1 w-full rounded-[var(--radius-md)] border border-input bg-panel px-3 py-2 text-[13px] font-normal"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={decide.isPending}
                      className="min-h-[36px] rounded-[var(--radius-md)] bg-danger px-3 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Confirm rejection
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </PageTransition>
  );
}
