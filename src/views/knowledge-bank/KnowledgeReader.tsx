'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Download, Link2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DangerConfirm } from '@/components/ui/danger-confirm';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { FileBadge } from '@/components/ui/file-badge';
import { Chip, Tag } from '@/components/ui/spectrum-chip';
import { DashSection } from '@/components/dash/DashSection';
import { SEO } from '@/components/SEO';
import { useApp } from '@/context/AppContext';
import { isAdminOrManager } from '@/lib/auth';
import { formatKnowledgeBankFileSize } from '@/lib/knowledge-bank/knowledge-bank-storage';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { KnowledgeBankFile } from '@/views/knowledge-bank/knowledge-bank-ui-state';

/*
 * Staff knowledge reader (prototype ReaderScreen at /admin/docs/knowledge/[id]). The real
 * knowledge bank holds files, not written articles, so the reader shows the file itself: a
 * head with the folder tag, the "Updated" chip and the title, the file in the browser's own
 * viewer (PDF or image) through a short-lived signed link, the actions (Download, Copy link,
 * Delete for admins and managers), and two side cards: About this file and More in the folder.
 * Depth tabs, the timeline box and sources belong to Ask explanations, which staff do not save.
 */

type Library = { files: KnowledgeBankFile[] };

async function fetchLibrary(): Promise<Library> {
  const res = await fetch('/api/knowledge-bank');
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; files?: KnowledgeBankFile[]; error?: string };
  if (!res.ok || body.ok === false) throw new Error(body.error ?? 'fetch_failed');
  return { files: Array.isArray(body.files) ? body.files : [] };
}

async function fetchSignedUrl(id: string): Promise<string> {
  const res = await fetch(`/api/knowledge-bank/${encodeURIComponent(id)}/download`);
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !body.ok || !body.url) throw new Error(body.error ?? 'download_failed');
  return body.url;
}

function plainDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

function previewOf(file: KnowledgeBankFile): 'pdf' | 'image' | null {
  const mime = (file.mimeType || '').toLowerCase();
  const name = file.fileName.toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name)) return 'image';
  return null;
}

function uploader(file: KnowledgeBankFile): string {
  return file.uploaderName?.trim() || file.uploaderEmail?.trim() || 'Unknown';
}

export default function KnowledgeReader({ basePath, id }: { basePath: string; id: string }) {
  const { user } = useApp();
  const router = useRouter();
  const qc = useQueryClient();
  const canDelete = isAdminOrManager(user?.role);
  const [confirm, setConfirm] = useState(false);

  // The same query key as the knowledge bank, so coming from the list costs no second load.
  const lib = useQuery({ queryKey: ['knowledge-bank'], queryFn: fetchLibrary });
  const file = lib.data?.files.find((f) => f.id === id) ?? null;
  const kind = file ? previewOf(file) : null;
  const signed = useQuery({
    queryKey: ['knowledge-bank', 'signed', id],
    queryFn: () => fetchSignedUrl(id),
    enabled: !!file,
    // The link lives an hour; read a fresh one well before then.
    staleTime: 30 * 60_000,
  });

  const siblings = file ? (lib.data?.files ?? []).filter((f) => f.id !== file.id && f.folderId === file.folderId).slice(0, 6) : [];
  const folder = file?.folderPath || 'Knowledge bank';

  const download = async () => {
    try {
      const url = signed.data ?? (await fetchSignedUrl(id));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toastError('Download failed');
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}${basePath}/${id}`;
    void navigator.clipboard?.writeText(url).then(
      () => toastSuccess('Link copied'),
      () => toastError("Link wasn't copied"),
    );
  };

  const remove = async () => {
    const res = await fetch(`/api/knowledge-bank/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      toastError('Delete failed');
      return;
    }
    await qc.invalidateQueries({ queryKey: ['knowledge-bank'] });
    toastSuccess('Removed from the knowledge bank', file?.title);
    router.push(basePath);
  };

  if (lib.isPending) {
    return (
      <section className="surface overflow-hidden" aria-busy="true" aria-label="Loading">
        <SkeletonRows rows={6} className="p-4" />
      </section>
    );
  }

  if (!file) {
    return (
      <section className="surface p-6">
        <EmptyState
          title={lib.isError ? 'The knowledge bank could not load' : 'This file is no longer in the knowledge bank'}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href={basePath}>Open the knowledge bank</Link>
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <>
      <SEO title={`${file.title} — VCFO Suite`} description={file.description ?? 'Knowledge bank file'} path={`${basePath}/${id}`} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article className="surface min-w-0 overflow-hidden">
          <header className="flex flex-col gap-3 border-b border-line-soft px-5 pb-4 pt-5">
            <span className="flex flex-wrap items-center gap-2">
              <Tag>{folder}</Tag>
              <Chip tone="idle">Updated {plainDate(file.createdAt)}</Chip>
            </span>
            <span className="flex items-start gap-3">
              <FileBadge name={file.fileName} />
              <span className="min-w-0 flex-1">
                <span className="block text-[22px] font-medium leading-7 text-ink">{file.title}</span>
                {file.description?.trim() ? <span className="mt-1 block text-[14px] text-ink-2">{file.description.trim()}</span> : null}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void download()}>
                <Download aria-hidden /> Download
              </Button>
              <Button size="sm" variant="secondary" onClick={copyLink}>
                <Link2 aria-hidden /> Copy link
              </Button>
              {canDelete ? (
                <Button size="iconSm" variant="ghost" className="ml-auto" aria-label={`Delete ${file.title}`} title="Delete" onClick={() => setConfirm(true)}>
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </span>
          </header>
          <div className="bg-surface-sunken p-3 md:p-5">
            {kind && signed.data ? (
              kind === 'pdf' ? (
                <iframe
                  src={signed.data}
                  title={`Preview of ${file.title}`}
                  className="block h-[min(78vh,900px)] w-full rounded-md border-1.5 border-line bg-surface-raised"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link; next/image would cache it
                <img src={signed.data} alt={file.title} className="mx-auto max-w-full rounded-md border-1.5 border-line bg-surface-raised shadow-tile" />
              )
            ) : kind && signed.isPending ? (
              <div className="h-[420px] animate-pulse rounded-md bg-surface-raised" aria-hidden />
            ) : (
              <div className="mx-auto grid max-w-[420px] place-items-center gap-3 rounded-md border-1.5 border-line bg-surface-raised px-4 py-10 text-center">
                <FileBadge name={file.fileName} />
                <span className="text-[14px] font-medium text-ink">{signed.isError ? 'The file could not load' : 'Preview not available for this file type'}</span>
                <Button size="sm" onClick={() => void download()}>
                  <Download aria-hidden /> Download
                </Button>
              </div>
            )}
          </div>
        </article>

        <aside className="grid content-start gap-5">
          <DashSection title="About this file">
            <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 px-4 pb-4 text-[13px]">
              <dt className="text-ink-muted">Folder</dt>
              <dd className="min-w-0 truncate text-ink">{folder}</dd>
              <dt className="text-ink-muted">File</dt>
              <dd className="min-w-0 truncate font-mono text-[12.5px] text-ink">{file.fileName}</dd>
              <dt className="text-ink-muted">Size</dt>
              <dd className="tabular-nums text-ink">{formatKnowledgeBankFileSize(file.sizeBytes)}</dd>
              <dt className="text-ink-muted">Added by</dt>
              <dd className="min-w-0 truncate text-ink">{uploader(file)}</dd>
              <dt className="text-ink-muted">Added</dt>
              <dd className="text-ink">{plainDate(file.createdAt)}</dd>
            </dl>
          </DashSection>
          <DashSection title={`More in ${folder}`}>
            {siblings.length ? (
              <ul>
                {siblings.map((f) => (
                  <li key={f.id} className="border-t border-line-soft first:border-t-0">
                    <Link href={`${basePath}/${f.id}`} className="flex min-h-[48px] items-center gap-3 px-4 py-2 hover:bg-surface-sunken">
                      <FileBadge name={f.fileName} />
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{f.title}</span>
                      <ChevronRight className="h-4 w-4 flex-none text-ink-faint" strokeWidth={1.6} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 pb-4 text-[13px] text-ink-muted">No other files in this folder</p>
            )}
          </DashSection>
        </aside>
      </div>
      <DangerConfirm
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${file.title}?`}
        body="The file leaves the knowledge bank for everyone. This cannot be undone."
        word="DELETE"
        confirm="Delete file"
        onConfirm={remove}
      />
    </>
  );
}
