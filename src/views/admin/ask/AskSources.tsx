'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Library, UploadCloud, X } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { ASK_SOURCE_ACCEPT, formatFileSize, titleFromFileName, validateSourceFile } from '@/lib/ask/source-file';
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
  /** Indexed pieces Ask VCFO can retrieve from this source. */
  chunkCount?: number;
  /** Official updates found by a watcher; null for admin uploads. */
  feed?: { label: string; act: string } | null;
  publishedAt?: string | null;
  summary?: string | null;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
};

type WatcherRun = {
  feedId: string;
  label: string;
  listed: number;
  added: number;
  failed: number;
  addedTitles: string[];
  error: string | null;
};

type FeedsInfo = {
  watchers: Array<{ id: string; label: string; act: string; homeUrl: string }>;
};

const REVIEW_LABEL: Record<string, string> = {
  pending: 'Waiting for manager review',
  approved: 'Approved by a manager',
  rejected: 'Rejected by a manager',
};
const REVIEW_TONE: Record<string, string> = {
  pending: 'bg-warning/15 text-warning-text',
  approved: 'bg-success-light text-success-text',
  rejected: 'bg-danger-light text-danger-text',
};

/**
 * Official updates: the government sources Ask VCFO watches, and a button that
 * runs the same check the 6:30 IST job runs. New items are indexed like any
 * upload; they start staff-only unless auto-publish is on.
 */
function OfficialUpdatesPanel({ onChecked }: { onChecked: () => void }) {
  const info = useQuery({
    queryKey: ['ask', 'feeds'],
    queryFn: async () => readJson<FeedsInfo>(await fetch('/api/ask/admin/feeds'), 'Could not load the watched sources'),
  });
  const check = useMutation({
    mutationFn: async () =>
      readJson<{ results: WatcherRun[] }>(await fetch('/api/ask/admin/feeds', { method: 'POST' }), 'Could not check the official sources'),
    onSuccess: () => onChecked(),
  });
  const results = check.data?.results;

  return (
    <section
      aria-label="Official updates"
      className="mt-4 rounded-[var(--radius)] border border-border bg-panel p-4"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-foreground">Official updates</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Ask VCFO checks these government sources every 30 minutes and reads anything new. Each new update
            gets a review document and waits for a manager; only after a manager approves does Ask VCFO use it,
            for staff and clients alike.{' '}
            <Link href="/app/admin/regulatory-updates" className="text-primary hover:underline">
              Open the review queue
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={() => check.mutate()}
          disabled={check.isPending}
          className="min-h-[40px] rounded-[var(--radius-md)] bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
        >
          {check.isPending ? 'Checking…' : 'Check for updates now'}
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {(info.data?.watchers ?? []).map((w) => {
          const run = results?.find((r) => r.feedId === w.id);
          return (
            <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
              <span className="rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary">{w.act}</span>
              <a href={w.homeUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground hover:underline">
                {w.label}
              </a>
              {run ? (
                run.error ? (
                  <span className="text-danger-text">Could not read it: {run.error}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {run.listed} listed · {run.added === 0 ? 'nothing new' : `${run.added} new, now being read`}
                    {run.failed ? ` · ${run.failed} could not be downloaded (tried again next time)` : ''}
                  </span>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12px] text-muted-foreground">
        Every portal on the firm&apos;s list is watched (MCA through the Gazette of India). Anything else can be dropped in the box below.
      </p>
      {check.isError && (
        <p role="alert" className="mt-2 text-[12.5px] text-danger-text">
          {(check.error as Error).message}
        </p>
      )}
    </section>
  );
}

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
  'min-h-[40px] w-full rounded-[var(--radius-md)] border border-input bg-panel px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

/**
 * Drag-and-drop (or click to browse) for one source file. The chosen file is
 * held in React state — a dropped file cannot be assigned to a plain
 * `<input type="file">` — and the form appends it to the request itself.
 * Owner, 2026-10-22: dragging a PDF onto the page did nothing before this.
 */
function SourceDropZone({
  file,
  onPick,
  onClear,
  disabled,
}: {
  file: File | null;
  onPick: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null | undefined) => {
    const first = list?.[0];
    if (first) onPick(first);
  };

  if (file) {
    return (
      <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-muted/40 px-3 py-2.5">
        <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">{file.name}</p>
          <p className="text-[12px] text-muted-foreground">{formatFileSize(file.size)} · ready to upload</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label={`Remove ${file.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop a PDF, DOCX, TXT or MD file here, or press Enter to choose one"
      data-testid="source-drop-zone"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        // Only when leaving the zone itself, not a child element.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        'mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border-2 border-dashed px-4 py-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        over ? 'border-primary bg-primary-light' : 'border-border bg-muted/30 hover:border-primary/60 hover:bg-muted/50',
      )}
    >
      <UploadCloud className={cn('h-7 w-7', over ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
      <p className="text-[13px] font-medium text-foreground">
        {over ? 'Drop it here' : 'Drag and drop a file here, or click to choose'}
      </p>
      <p className="text-[12px] text-muted-foreground">PDF, DOCX, TXT or MD · one file at a time</p>
      <input
        ref={inputRef}
        type="file"
        accept={ASK_SOURCE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** Knowledge sources Ask VCFO retrieves from (Phase 7). Admin / super admin only. */
export default function AskSources() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'file' | 'note'>('file');
  const [file, setFile] = useState<File | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // A file dropped anywhere else on the page must not make the browser
  // navigate to it (Chrome opens a dropped PDF in the tab).
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  const pickFile = (next: File) => {
    const problem = validateSourceFile(next);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFile(next);
    setKind('file');
    if (titleRef.current && !titleRef.current.value.trim()) {
      titleRef.current.value = titleFromFileName(next.name);
    }
  };
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
        actions={
          <Link
            href="/app/admin/ask-vcfo/gaps"
            className="inline-flex min-h-[40px] items-center rounded-[var(--radius-md)] border border-border px-3 text-[13px] font-medium text-foreground hover:bg-muted"
          >
            Question gaps
          </Link>
        }
      />

      <OfficialUpdatesPanel onChecked={() => void queryClient.invalidateQueries({ queryKey: ['ask', 'sources'] })} />

      <form
        className="mt-4 grid gap-3 rounded-[var(--radius)] border border-border bg-panel p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const form = new FormData(e.currentTarget);
          form.delete('kind');
          if (kind === 'file') {
            if (!file) {
              setError('Drop a file in the box, or click it to choose one.');
              return;
            }
            form.delete('note');
            form.set('file', file, file.name);
          } else {
            form.delete('file');
          }
          upload.mutate(form, {
            onSuccess: () => {
              (e.target as HTMLFormElement).reset();
              setFile(null);
            },
          });
        }}
      >
        <div className="md:col-span-2">
          <label htmlFor="src-title" className="text-[12.5px] font-medium text-foreground">
            Title
          </label>
          <input id="src-title" name="title" ref={titleRef} required maxLength={200} className={input} />
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
            <SourceDropZone file={file} onPick={pickFile} onClear={() => setFile(null)} disabled={upload.isPending} />
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
                <p className="truncate text-[13.5px] font-medium text-foreground">
                  {doc.feed ? (
                    <span className="mr-2 rounded-full bg-primary-light px-2 py-0.5 align-middle text-[11px] font-medium text-primary">
                      Official update · {doc.feed.act}
                    </span>
                  ) : null}
                  {doc.title}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {doc.feed ? doc.feed.label : (TYPE_LABEL[doc.sourceType] ?? doc.sourceType)} ·{' '}
                  {AUDIENCE_LABEL[doc.audience] ?? doc.audience}
                  {doc.publishedAt
                    ? ` · published ${doc.publishedAt}`
                    : doc.effectiveFrom
                      ? ` · effective ${doc.effectiveFrom}`
                      : ''}
                  {doc.sourceUrl ? (
                    <>
                      {' · '}
                      <a href={doc.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        open on the government site
                      </a>
                    </>
                  ) : null}
                </p>
                {doc.summary && <p className="mt-1 text-[12.5px] text-foreground">What changed: {doc.summary}</p>}
                {doc.error && <p className="text-[12px] text-danger-text">{doc.error}</p>}
              </div>
              {doc.feed && doc.reviewStatus ? (
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', REVIEW_TONE[doc.reviewStatus] ?? 'bg-muted text-muted-foreground')}>
                  {REVIEW_LABEL[doc.reviewStatus] ?? doc.reviewStatus}
                </span>
              ) : null}
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[doc.status])}>
                {STATUS_LABEL[doc.status]}
                {doc.status === 'ready' && typeof doc.chunkCount === 'number'
                  ? ` · ${doc.chunkCount} piece${doc.chunkCount === 1 ? '' : 's'} read`
                  : ''}
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
