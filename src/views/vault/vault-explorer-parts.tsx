'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, Download, ExternalLink, Folder, Loader2 } from 'lucide-react';
import { MilestoneDocumentLink } from '@/components/common/MilestoneDocumentLink';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FileBadge } from '@/components/ui/file-badge';
import { Textarea } from '@/components/ui/textarea';
import { Chip, Tag } from '@/components/ui/spectrum-chip';
import { getIndexedDocumentSignedUrl } from '@/hooks/use-vault-documents';
import { isMilestoneStoragePath } from '@/lib/documents/milestone-document-storage';
import { vaultLocationLabel, type VaultDocument } from '@/lib/documents/vault-documents';
import { formatUploadDate } from '@/views/vault/vault-tree';
import { fileUrl, previewKind, reviewWord, type VaultRef } from '@/views/vault/vault-files';
import { cn } from '@/lib/utils';

/*
 * Parts of the staff Vault explorer (K-39; prototype `src/screens/shared/DocumentsExplorer.tsx`).
 * The tree groups one client's submitted files by step (phase, then checklist step) or by
 * category (the checklist section). The preview pane on the right names the file and its place,
 * with an Open link that fetches the same signed URL the old cards used.
 */

function IndentGuides({ depth }: { depth: number }) {
  return (
    <>
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          className="absolute inset-y-0 w-px bg-line"
          style={{ left: 22 + i * 31 }}
          aria-hidden
        />
      ))}
    </>
  );
}

/** A folder row: chevron, folder tile, label and the file count. */
export function VaultFolderRow({
  label,
  depth,
  count,
  open,
  onToggle,
  onZip,
}: {
  label: string;
  depth: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** Download the folder's files as one ZIP (G-26). */
  onZip?: () => void;
}) {
  return (
    <div
      role="treeitem"
      aria-selected={false}
      aria-expanded={open}
      className="relative flex h-9 items-center pr-3 text-[14px] hover:bg-surface-sunken"
    >
      <IndentGuides depth={depth} />
      <button
        type="button"
        onClick={onToggle}
        className="flex h-full min-w-0 flex-1 items-center gap-2 text-left"
        style={{ paddingLeft: 14 + depth * 31 }}
      >
        <ChevronRight
          className={cn('h-[15px] w-[15px] flex-none text-ink-muted transition-transform', open && 'rotate-90')}
          strokeWidth={1.6}
          aria-hidden
        />
        <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-sm bg-brand-soft text-brand-text" aria-hidden>
          <Folder className="h-3 w-3 fill-current" strokeWidth={1.6} />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{label}</span>
        <span className="w-8 flex-none text-right text-[12.5px] tabular-nums text-ink-muted">{count}</span>
      </button>
      {onZip && count > 0 ? (
        <button
          type="button"
          onClick={onZip}
          className="ml-1 grid h-7 w-7 flex-none place-items-center rounded-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
          aria-label={`Download ${label} as ZIP`}
          title="Download folder as ZIP"
        >
          <Download className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** A file row: small type badge, file name, an optional section tag and the upload date. */
export function VaultFileRow({
  doc,
  depth,
  selected,
  tag,
  sub,
  onSelect,
  checked,
  onCheck,
  reviewStatus,
}: {
  doc: VaultDocument;
  depth: number;
  selected: boolean;
  tag?: string;
  sub?: string;
  onSelect: () => void;
  /** Ticked for a ZIP of the selection (G-26). */
  checked?: boolean;
  onCheck?: (checked: boolean) => void;
  reviewStatus?: string | null;
}) {
  const review = reviewWord(reviewStatus);
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      className={cn(
        'relative flex min-h-9 items-center pr-3 text-[14px]',
        selected ? 'bg-brand-soft text-ink' : 'hover:bg-surface-sunken',
      )}
    >
      {selected ? <span className="absolute inset-y-0 left-0 w-[3px] bg-brand" aria-hidden /> : null}
      <IndentGuides depth={depth} />
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 py-1 text-left"
        style={{ paddingLeft: 22 + depth * 31 - 6 }}
      >
        <FileBadge name={doc.fileName} className="h-[18px] w-[30px] text-[9px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{doc.fileName}</span>
          {sub ? <span className="block truncate text-[12px] text-ink-muted">{sub}</span> : null}
        </span>
        {tag ? <Tag className="hidden sm:inline-flex">{tag}</Tag> : null}
        {review ? (
          <Tag tone={reviewStatus === 'approved' ? 'ok' : reviewStatus === 'changes' ? 'bad' : 'prog'} className="hidden sm:inline-flex">
            {review}
          </Tag>
        ) : null}
        <span className="hidden flex-none text-[12.5px] tabular-nums text-ink-muted sm:inline">
          {formatUploadDate(doc.uploadedAt)}
        </span>
      </button>
      {onCheck ? (
        <Checkbox
          checked={Boolean(checked)}
          onCheckedChange={(v) => onCheck(v === true)}
          aria-label={`Select ${doc.fileName}`}
          className="ml-2 flex-none"
        />
      ) : null}
    </div>
  );
}

function IndexedDocumentLink({
  documentId,
  fileName,
  className,
}: {
  documentId: string;
  fileName: string;
  className?: string;
}) {
  const [href, setHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getIndexedDocumentSignedUrl(documentId).then((url) => {
      if (!cancelled) {
        setHref(url);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (loading) {
    return <span className={cn('text-[13px] text-ink-faint', className)}>Loading…</span>;
  }
  if (!href) {
    return <span className={cn('text-[13px] text-ink-faint', className)}>{fileName} (link unavailable)</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-text underline-offset-2 hover:underline',
        className,
      )}
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {fileName}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** Open link for a vault file: the indexed document route or the milestone storage route. */
export function DocumentOpenLink({ doc, className }: { doc: VaultDocument; className?: string }) {
  if (doc.source === 'index' && doc.documentId && !isMilestoneStoragePath(doc.storagePath)) {
    return <IndexedDocumentLink documentId={doc.documentId} fileName={doc.fileName} className={className} />;
  }
  return (
    <MilestoneDocumentLink
      storagePath={doc.storagePath}
      label={doc.fieldLabel}
      className={cn('text-[13px] font-medium', className)}
    />
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-t border-line-soft px-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

export interface VaultReviewInfo {
  status: string;
  note: string | null;
  reviewedAt: string | null;
}

type ReviewStatus = 'pending' | 'approved' | 'changes';

/** Review controls (G-26): the state and note, and the three actions. "Send back" needs a note. */
function ReviewBlock({
  review,
  onReview,
}: {
  review: VaultReviewInfo | null;
  onReview: (status: ReviewStatus, note?: string) => Promise<boolean>;
}) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<ReviewStatus | null>(null);
  const word = reviewWord(review?.status);

  async function act(status: ReviewStatus, withNote?: string) {
    setBusy(status);
    const ok = await onReview(status, withNote);
    setBusy(null);
    if (ok) {
      setAsking(false);
      setNote('');
    }
  }

  return (
    <div className="grid gap-2 border-t border-line-soft px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] text-ink-muted">Review</span>
        {word ? <Chip>{word}</Chip> : <span className="text-[13px] text-ink-faint">—</span>}
        {review?.reviewedAt ? (
          <span className="text-[12.5px] tabular-nums text-ink-muted">{formatUploadDate(review.reviewedAt)}</span>
        ) : null}
        <span className="ml-auto flex flex-wrap gap-1.5">
          {review?.status !== 'pending' ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void act('pending')}>
              {busy === 'pending' ? <Loader2 className="animate-spin" aria-hidden /> : null}
              In review
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" disabled={busy !== null} onClick={() => setAsking((v) => !v)}>
            Send back
          </Button>
          {review?.status !== 'approved' ? (
            <Button type="button" size="sm" disabled={busy !== null} onClick={() => void act('approved')}>
              {busy === 'approved' ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Approve
            </Button>
          ) : null}
        </span>
      </div>
      {review?.status === 'changes' && review.note ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-ink">{review.note}</p>
      ) : null}
      {asking ? (
        <div className="grid gap-2">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="What needs to change"
            aria-label="What needs to change"
            className="text-[13.5px]"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy !== null || !note.trim()}
              onClick={() => void act('changes', note)}
            >
              {busy === 'changes' ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Send back
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Inline preview through the same-origin route (G-26): a frame for PDFs, the image itself otherwise. */
function InlinePreview({ fileRef, kind, fileName }: { fileRef: VaultRef; kind: 'pdf' | 'image'; fileName: string }) {
  const src = fileUrl(fileRef);
  return kind === 'pdf' ? (
    <iframe src={src} title={`Preview of ${fileName}`} className="h-[520px] w-full rounded-md border-1.5 border-line bg-surface-raised" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- a private, same-origin stream; next/image would cache it
    <img src={src} alt={fileName} className="max-h-[520px] max-w-full rounded-md border-1.5 border-line bg-surface-raised object-contain" />
  );
}

/**
 * The preview pane: a 52px head with the badge, name and download, the preview (a PDF or an
 * image inline, otherwise the open card), then the facts and the review controls.
 */
export function VaultPreviewPane({
  doc,
  fileRef,
  contentType,
  review,
  onReview,
}: {
  doc: VaultDocument;
  /** What the preview and download routes take for this file; null when it has neither. */
  fileRef?: VaultRef | null;
  contentType?: string | null;
  review?: VaultReviewInfo | null;
  /** Staff review (G-26); a file the routes cannot name has no review. */
  onReview?: (status: ReviewStatus, note?: string) => Promise<boolean>;
}) {
  const kind = fileRef ? previewKind(doc.fileName, contentType) : null;
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[52px] items-center gap-3 border-b border-line-soft px-4">
        <FileBadge name={doc.fileName} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{doc.fileName}</span>
        {fileRef ? (
          <Button asChild size="icon" variant="ghost" className="h-8 w-8 min-w-0">
            <a href={fileUrl(fileRef, 'download')} aria-label={`Download ${doc.fileName}`} title="Download">
              <Download className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden />
            </a>
          </Button>
        ) : null}
      </div>
      <div className="grid flex-1 place-items-center bg-surface-sunken px-6 py-8">
        {kind && fileRef ? (
          <InlinePreview key={doc.id} fileRef={fileRef} kind={kind} fileName={doc.fileName} />
        ) : (
          <div className="grid w-full max-w-[340px] justify-items-center gap-3 rounded-md border-1.5 border-line bg-surface-raised px-4 py-10 text-center">
            <FileBadge name={doc.fileName} />
            <span className="max-w-full truncate text-[14px] font-medium text-ink">{doc.fieldLabel}</span>
            <DocumentOpenLink doc={doc} className="max-w-full truncate" />
          </div>
        )}
      </div>
      <dl className="text-[14px]">
        <Fact label="Client">{doc.companyName}</Fact>
        <Fact label="Step">{vaultLocationLabel(doc) || doc.milestoneTitle}</Fact>
        <Fact label="Date">{formatUploadDate(doc.uploadedAt)}</Fact>
        <Fact label="File">{doc.fileName}</Fact>
      </dl>
      {onReview ? <ReviewBlock key={doc.id} review={review ?? null} onReview={onReview} /> : null}
    </div>
  );
}
