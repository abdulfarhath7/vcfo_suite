'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download, Eye, FilePlus2, FileText, Maximize2 } from 'lucide-react';
import type { Engagement } from '@/data/engagements';
import type { BoardResolutionDoc } from '@/lib/board-resolution/board-resolution';
import {
  boardResolutionDownloadName,
  signedBoardResolutionDownloadName,
  uploadSignedBoardResolution,
  validateSignedBoardResolutionFile,
} from '@/lib/board-resolution/board-resolution-storage';
import { fetchBoardResolutionInDb } from '@/lib/projects/engagements-db';
import { boardResolutionPathFor } from '@/lib/projects/project-step-path';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import { BoardResolutionDraftEditor } from '@/components/incorporation/BoardResolutionDraftEditor';
import { useDocViewer, type ViewerDoc } from '@/components/client-portal/pages/documents/DocViewer';
import { DropZone } from '@/components/client-portal/pages/incorporation/spectrum';
import { buttonVariants } from '@/components/ui/button-variants';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function day(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const UPLOAD_ACCEPT = `.pdf,.docx,application/pdf,${DOCX_TYPE}`;

function signedContentType(path: string): string {
  if (/\.pdf$/i.test(path)) return 'application/pdf';
  if (/\.docx$/i.test(path)) return DOCX_TYPE;
  return '';
}

/**
 * BR-01, BR-02: the documents on the two board resolution steps.
 *
 *  - "Draft board resolution" shows the generated draft: its version and date, an inline preview
 *    and a Download (named as GL-08 says). With no draft, an empty state, and "Generate draft"
 *    for the project lead only. The client sees it only once the firm has sent it.
 *  - "Signed board resolution" shows the last approved draft on the left and the signed copy on
 *    the right, each with its version, date, Open (the shared document viewer) and Download, and
 *    who uploaded the signed copy. While no signed copy exists the right panel is the upload area
 *    itself (the drop zone of the client's board resolution page). The two panels stack below 768px.
 */
export function BoardResolutionDocCards({
  engagement,
  doc: docProp,
  step,
  viewerRole: role,
  onDocChange,
}: {
  engagement: Pick<Engagement, 'id' | 'slug' | 'companyName'>;
  doc: BoardResolutionDoc | null;
  step: 'draft' | 'signed';
  /** The viewer's role. Not named `role`, which JSX lint reads as an ARIA role. */
  viewerRole: string | undefined;
  /** Called with the reloaded record after the signed copy is uploaded here. */
  onDocChange?: (doc: BoardResolutionDoc | null) => void;
}) {
  const isClient = role === 'client';
  const viewer = useDocViewer();
  const pathname = usePathname();
  // The record after an upload on this card, until the parent passes a newer one.
  const [fresh, setFresh] = useState<BoardResolutionDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [freshFor, setFreshFor] = useState(docProp);
  if (freshFor !== docProp) {
    setFreshFor(docProp);
    setFresh(null);
  }
  const doc = fresh ?? docProp;
  const [version, setVersion] = useState<{ n: number; at: string | null } | null>(null);
  // The preview opens in a pop-up: inside the card it was too narrow to read (owner, 12 Nov).
  const [previewOpen, setPreviewOpen] = useState(false);

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
  const page = boardResolutionPathFor(role, engagement, pathname);
  const draftLabel = version ? `Draft v${version.n}` : 'Draft';
  const signedPath = doc?.signedStoragePath?.trim() ?? '';
  const versionKey = encodeURIComponent(doc?.signedUploadedAt ?? signedPath);

  const draftViewerDoc: ViewerDoc = {
    id: 'br-draft',
    name: boardResolutionDownloadName(engagement.companyName),
    meta: `Board resolution · ${draftLabel.toLowerCase()}`,
    contentType: DOCX_TYPE,
    url: async () => `${base}/download?v=${encodeURIComponent(doc?.updatedAt ?? '')}`,
  };
  const signedViewerDoc: ViewerDoc | null = signed
    ? {
        id: 'br-signed',
        name: signedBoardResolutionDownloadName(engagement.companyName, signedPath),
        meta: 'Board resolution · signed copy',
        contentType: signedContentType(signedPath),
        uploadedAt: doc?.signedUploadedAt ?? undefined,
        uploadedBy: doc?.signedUploadedByName ?? undefined,
        url: async () => `${base}/download-signed?v=${versionKey}`,
      }
    : null;
  // Open shows the documents of this step in the viewer, so the arrows compare draft and signed copy.
  const viewerDocs = [...(hasDraft && clientMaySee ? [draftViewerDoc] : []), ...(signedViewerDoc ? [signedViewerDoc] : [])];

  const uploadSigned = async (file: File) => {
    const bad = validateSignedBoardResolutionFile(file);
    if (bad) {
      setUploadError(bad);
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      await uploadSignedBoardResolution(engagement.id, file);
      const next = await fetchBoardResolutionInDb(engagement.id).catch(() => null);
      if (next) setFresh(next);
      onDocChange?.(next);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const draftPanel = (
    <section className="min-w-0 rounded-lg border-1.5 border-line bg-surface-raised p-3" aria-label="Draft board resolution">
      {hasDraft && clientMaySee ? (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <FileText className="h-4 w-4 flex-none text-brand-text" aria-hidden />
            <b className="text-[14px] font-medium text-ink">{draftLabel}</b>
            <span className="text-[12.5px] text-ink-muted">
              {step === 'signed' ? 'last approved · ' : ''}generated {day(version?.at ?? doc?.updatedAt ?? doc?.draftedAt) ?? '—'}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={buttonVariants({ variant: 'outline', size: 'sm' })} onClick={() => setPreviewOpen(true)} aria-haspopup="dialog">
              <Eye className="mr-1 h-3.5 w-3.5" aria-hidden />
              Preview
            </button>
            <button type="button" className={buttonVariants({ variant: 'outline', size: 'sm' })} onClick={() => viewer.open(viewerDocs, 0)}>
              <Maximize2 className="mr-1 h-3.5 w-3.5" aria-hidden />
              Open
            </button>
            <a className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`${base}/download`} download={boardResolutionDownloadName(engagement.companyName)}>
              <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
              Download
            </a>
          </div>
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="flex max-h-[92vh] w-[min(96vw,1000px)] max-w-none flex-col gap-3 sm:max-w-none">
              <DialogHeader>
                <DialogTitle>{draftLabel} · board resolution</DialogTitle>
                <DialogDescription>{engagement.companyName}</DialogDescription>
              </DialogHeader>
              {previewOpen ? (
                // BR-04/05: when this person may change the wording, the document itself is editable.
                <BoardResolutionDraftEditor
                  engagementId={engagement.id}
                  refreshKey={doc?.updatedAt ?? undefined}
                  previewLabel={draftLabel}
                  fallback={
                    <div className="min-h-0 flex-1 overflow-auto rounded-md border border-line-soft">
                      <BoardResolutionDocPreview engagementId={engagement.id} refreshKey={doc?.updatedAt ?? undefined} previewLabel={draftLabel} />
                    </div>
                  }
                />
              ) : null}
            </DialogContent>
          </Dialog>
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

  if (step === 'draft') {
    return (
      <>
        {draftPanel}
        {viewer.node}
      </>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {draftPanel}
      <section className="min-w-0 rounded-lg border-1.5 border-line bg-surface-raised p-3" aria-label="Signed copy">
        {signed ? (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <FileText className="h-4 w-4 flex-none text-positive" aria-hidden />
              {/* The signed copy is the signature of the last approved draft, so it carries that version. */}
              <b className="text-[14px] font-medium text-ink">{version ? `Signed copy · v${version.n}` : 'Signed copy'}</b>
              <span className="text-[12.5px] text-ink-muted">
                uploaded {day(doc?.signedUploadedAt) ?? '—'}
                {doc?.signedUploadedByName ? ` by ${doc.signedUploadedByName}` : ''}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button type="button" className={buttonVariants({ variant: 'outline', size: 'sm' })} onClick={() => viewer.open(viewerDocs, viewerDocs.length - 1)}>
                <Eye className="mr-1 h-3.5 w-3.5" aria-hidden />
                Open
              </button>
              <a className={buttonVariants({ variant: 'outline', size: 'sm' })} href={`${base}/download-signed`}>
                <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
                Download
              </a>
            </div>
          </>
        ) : clientMaySee && doc?.status === 'finalized' ? (
          <div className="grid gap-2">
            <DropZone
              label="Upload the signed copy"
              hint="PDF · DOCX"
              tone="warn"
              busy={uploading}
              browseText="Drop a PDF or Word file or"
              accept={UPLOAD_ACCEPT}
              onFile={(f) => void uploadSigned(f)}
            />
            {uploadError ? (
              <p role="alert" className="text-[12.5px] text-danger">
                {uploadError}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-2 py-2 text-[13px] text-ink-muted">
            <p>No signed copy yet. It can be uploaded once the draft is finalized.</p>
          </div>
        )}
      </section>
      {viewer.node}
    </div>
  );
}
