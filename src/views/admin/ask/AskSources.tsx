'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Library } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { cn } from '@/lib/utils';

type SourceRow = {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  audience: string;
  status: 'processing' | 'ready' | 'failed' | 'archived';
  error: string | null;
  effectiveFrom: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = { govt: 'Government', firm_pdf: 'Firm document', firm_note: 'Firm note' };
const AUDIENCE_LABEL: Record<string, string> = { client: 'Clients', staff: 'Staff only', both: 'Clients and staff' };
const STATUS_TONE: Record<SourceRow['status'], string> = {
  processing: 'bg-muted text-muted-foreground',
  ready: 'bg-success-light text-success-text',
  failed: 'bg-danger-light text-danger-text',
  archived: 'bg-muted text-muted-foreground',
};
const STATUS_LABEL: Record<SourceRow['status'], string> = {
  processing: 'Indexing',
  ready: 'Ready',
  failed: 'Failed',
  archived: 'Archived',
};

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(body?.error || fallback);
  return body as T;
}

const input =
  'min-h-[40px] w-full rounded-[var(--radius-md)] border border-input bg-background px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

/** Knowledge sources Ask VCFO retrieves from (Phase 7). Admin / super admin only. */
export default function AskSources() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'file' | 'note'>('file');
  const list = useQuery({
    queryKey: ['ask', 'sources'],
    queryFn: async () => readJson<{ documents: SourceRow[] }>(await fetch('/api/ask/admin/documents'), 'Could not load sources'),
    refetchInterval: (q) => (q.state.data?.documents.some((d) => d.status === 'processing') ? 4000 : false),
  });
  const upload = useMutation({
    mutationFn: async (form: FormData) =>
      readJson(await fetch('/api/ask/admin/documents', { method: 'POST', body: form }), 'Could not save the source'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ask', 'sources'] }),
    onError: (err: Error) => setError(err.message),
  });
  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'retry' | 'archive' }) =>
      readJson(
        await fetch(`/api/ask/admin/documents/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }),
        'Could not update the source',
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ask', 'sources'] }),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <PageTransition>
      <SEO title="Ask VCFO sources" description="Knowledge sources for Ask VCFO" path="/app/admin/ask-vcfo/sources" />
      <PageHeader
        title="Ask VCFO sources"
        subtitle="Documents Ask VCFO may quote. Staff-only sources are never used in client answers."
        icon={Library}
      />

      <form
        className="mt-4 grid gap-3 rounded-[var(--radius)] border border-border bg-panel p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const form = new FormData(e.currentTarget);
          upload.mutate(form, { onSuccess: () => (e.target as HTMLFormElement).reset() });
        }}
      >
        <div className="md:col-span-2">
          <label htmlFor="src-title" className="text-[12.5px] font-medium text-foreground">
            Title
          </label>
          <input id="src-title" name="title" required maxLength={200} className={input} />
        </div>
        <div>
          <label htmlFor="src-type" className="text-[12.5px] font-medium text-foreground">
            Source type
          </label>
          <select id="src-type" name="sourceType" className={input} defaultValue="firm_pdf">
            <option value="govt">Government</option>
            <option value="firm_pdf">Firm document</option>
            <option value="firm_note">Firm note</option>
          </select>
        </div>
        <div>
          <label htmlFor="src-audience" className="text-[12.5px] font-medium text-foreground">
            Used in answers for
          </label>
          <select id="src-audience" name="audience" className={input} defaultValue="staff">
            <option value="staff">Staff only</option>
            <option value="both">Clients and staff</option>
            <option value="client">Clients</option>
          </select>
        </div>
        <div>
          <label htmlFor="src-url" className="text-[12.5px] font-medium text-foreground">
            Source link (optional)
          </label>
          <input id="src-url" name="sourceUrl" type="url" className={input} placeholder="https://" />
        </div>
        <div>
          <label htmlFor="src-date" className="text-[12.5px] font-medium text-foreground">
            Effective from (optional)
          </label>
          <input id="src-date" name="effectiveFrom" type="date" className={input} />
        </div>
        <fieldset className="md:col-span-2">
          <legend className="text-[12.5px] font-medium text-foreground">Content</legend>
          <div className="mt-1 flex gap-3 text-[13px]">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="kind" checked={kind === 'file'} onChange={() => setKind('file')} /> Upload a file
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" name="kind" checked={kind === 'note'} onChange={() => setKind('note')} /> Write a note
            </label>
          </div>
          {kind === 'file' ? (
            <input
              aria-label="File (PDF, DOCX, TXT or MD)"
              name="file"
              type="file"
              accept=".pdf,.docx,.txt,.md"
              required
              className="mt-2 block text-[13px]"
            />
          ) : (
            <textarea aria-label="Note" name="note" required rows={6} className={cn(input, 'mt-2 py-2')} />
          )}
        </fieldset>
        <div className="flex items-center gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={upload.isPending}
            className="min-h-[40px] rounded-[var(--radius-md)] bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
          >
            {upload.isPending ? 'Uploading…' : 'Add source'}
          </button>
          {error && (
            <p role="alert" className="text-[12.5px] text-danger-text">
              {error}
            </p>
          )}
        </div>
      </form>

      <section className="mt-6" aria-label="Sources">
        {list.isLoading && <p className="text-[13px] text-muted-foreground">Loading…</p>}
        {list.isError && (
          <p role="alert" className="text-[13px] text-danger-text">
            Could not load sources.
          </p>
        )}
        {list.data && list.data.documents.length === 0 && (
          <p className="text-[13px] text-muted-foreground">No sources yet. Reviewed topics still answer common questions.</p>
        )}
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius)] border border-border">
          {list.data?.documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-3 bg-panel px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-foreground">{doc.title}</p>
                <p className="text-[12px] text-muted-foreground">
                  {TYPE_LABEL[doc.sourceType] ?? doc.sourceType} · {AUDIENCE_LABEL[doc.audience] ?? doc.audience}
                  {doc.effectiveFrom ? ` · effective ${doc.effectiveFrom}` : ''}
                </p>
                {doc.error && <p className="text-[12px] text-danger-text">{doc.error}</p>}
              </div>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[doc.status])}>
                {STATUS_LABEL[doc.status]}
              </span>
              {doc.status !== 'archived' && (
                <div className="flex gap-1.5">
                  {(doc.status === 'failed' || doc.status === 'ready') && (
                    <button
                      type="button"
                      onClick={() => act.mutate({ id: doc.id, action: 'retry' })}
                      className="min-h-[36px] rounded-[var(--radius-md)] border border-border px-2.5 text-[12px] hover:bg-muted"
                    >
                      {doc.status === 'failed' ? 'Retry' : 'Re-index'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => act.mutate({ id: doc.id, action: 'archive' })}
                    className="min-h-[36px] rounded-[var(--radius-md)] px-2.5 text-[12px] text-muted-foreground hover:bg-muted"
                  >
                    Archive
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </PageTransition>
  );
}
