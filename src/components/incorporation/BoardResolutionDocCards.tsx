'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Eye, EyeOff, FilePlus2, FileText, Upload } from 'lucide-react';
import type { Engagement } from '@/data/engagements';
import type { BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';
import { boardResolutionDownloadName } from '@/lib/board-resolution/board-resolution-storage';
import { adminProjectPath, clientBoardResolutionPath, internBoardResolutionPath } from '@/lib/projects/project-step-path';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

function day(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/** The page where the board resolution is generated, released and its signed copy uploaded. */
function boardResolutionPage(role: string | undefined, engagement: Pick<Engagement, 'id' | 'slug'>): string {
  if (role === 'client') return clientBoardResolutionPath();
  if (role === 'intern') return internBoardResolutionPath(engagement);
  return `${adminProjectPath(engagement, role === 'manager' ? 'manager' : 'admin')}/board-resolution`;
}

/**
 * BR-01, BR-02: the documents on the two board resolution steps.
 *
 *  - "Draft board resolution" shows the generated draft: its version and date, an inline preview
 *    and a Download (named as GL-08 says). With no draft, an empty state, and "Generate draft"
 *    for the project lead only. The client sees it only once the firm has sent it.
 *  - "Signed board resolution" shows the last approved draft on the left and the signed copy on
 *    the right, each with Open and Download, or the upload place while no signed copy exists. The
 *    two panels stack below 768px.
 */
export function BoardResolutionDocCards({
  engagement,
  doc,
  step,
  viewerRole: role,
}: {
  engagement: Pick<Engagement, 'id' | 'slug' | 'companyName'>;
  doc: BoardResolutionDoc | null;
  step: 'draft' | 'signed';
  /** The viewer's role. Not named `role`, which JSX lint reads as an ARIA role. */
  viewerRole: string | undefined;
}) {
  const isClient = role === 'client';
  const [version, setVersion] = useState<{ n: number; at: string | null } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(step === 'draft');

  // The version count is the firm's history; the client reads the date only.
  useEffect(() => {
    if (isClient || !doc?.storagePath) return;
    let cancelled = false;
    void fetch(`/api/engagements/${encodeURIComponent(engagement.id)}/board-resolution/versions`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { versions?: { version?: number; createdAt?: string }[] } | null) => {
        if (cancelled || !body?.versions?.length) return;
        // Newest first: the first row is the version the preview shows.
        setVersion({ n: body.versions[0]?.version ?? body.versions.length, at: body.versions[0]?.createdAt ?? null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [engagement.id, isClient, doc?.storagePath, doc?.updatedAt]);

  const base = `/api/engagements/${encodeURIComponent(engagement.id)}/board-resolution`;
  const hasDraft = Boolean(doc?.storagePath?.trim());
  const clientMaySee = !isClient || doc?.status === 'finalized';
  const signed = Boolean(doc?.signedStoragePath?.trim());
  const page = boardResolutionPage(role, engagement);

  const draftPanel = (
    <section className="min-w-0 rounded-lg border-1.5 border-line bg-surface-raised p-3" aria-label="Draft board resolution">
      {hasDraft && clientMaySee ? (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <FileText className="h-4 w-4 flex-none text-brand-text" aria-hidden />
            <b className="text-[14px] font-medium text-ink">{version ? `Draft v${version.n}` : 'Draft'}</b>
            <span className="text-[12.5px] text-ink-muted">
              {step === 'signed' ? 'last approved · ' : ''}generated {day(version?.at ?? doc?.updatedAt ?? doc?.draftedAt) ?? '—'}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={buttonVariants({ variant: 'outline', size: 'sm' })} onClick={() => setPreviewOpen((v) => !v)} aria-expanded={previewOpen}>
              {previewOpen ? <EyeOff className="mr-1 h-3.5 w-3.5" aria-hidden /> : <Eye className="mr-1 h-3.5 w-3.5" aria-hidden />}
              {previewOpen ? 'Hide preview' : 'Preview'}
            </button>
            <a className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`${base}/download`} download={boardResolutionDownloadName(engagement.companyName)}>
              <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
              Download
            </a>
          </div>
          {previewOpen ? (
            <div className="mt-3 max-h-[520px] overflow-auto rounded-md border border-line-soft">
              <BoardResolutionDocPreview engagementId={engagement.id} refreshKey={doc?.updatedAt ?? undefined} previewLabel={version ? `Draft v${version.n}` : 'Draft'} />
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid gap-2 py-2 text-[13px] text-ink-muted">
          <p>{isClient ? 'The draft appears here once your SBC team sends it to you.' : 'No draft yet.'}</p>
          {role === 'intern' ? (
            <Link href={page} className={cn(buttonVariants({ size: 'sm' }), 'justify-self-start')}>
              <FilePlus2 className="mr-1 h-3.5 w-3.5" aria-hidden />
              Generate draft
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );

  if (step === 'draft') return draftPanel;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {draftPanel}
      <section className="min-w-0 rounded-lg border-1.5 border-line bg-surface-raised p-3" aria-label="Signed copy">
        {signed ? (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <FileText className="h-4 w-4 flex-none text-positive" aria-hidden />
              <b className="text-[14px] font-medium text-ink">Signed copy</b>
              <span className="text-[12.5px] text-ink-muted">uploaded {day(doc?.signedUploadedAt) ?? '—'}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`${base}/download-signed?inline=1`} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-1 h-3.5 w-3.5" aria-hidden />
                Open
              </a>
              <a className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`${base}/download-signed`}>
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
                Download
              </a>
            </div>
          </>
        ) : (
          <div className="grid gap-2 py-2 text-[13px] text-ink-muted">
            <p>No signed copy yet.</p>
            {clientMaySee ? (
              <Link href={page} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'justify-self-start')}>
                <Upload className="mr-1 h-3.5 w-3.5" aria-hidden />
                Upload the signed copy
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
