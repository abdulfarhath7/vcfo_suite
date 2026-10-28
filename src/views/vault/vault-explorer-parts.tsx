'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, ExternalLink, Folder } from 'lucide-react';
import { MilestoneDocumentLink } from '@/components/common/MilestoneDocumentLink';
import { FileBadge } from '@/components/ui/file-badge';
import { Tag } from '@/components/ui/spectrum-chip';
import { getIndexedDocumentSignedUrl } from '@/hooks/use-vault-documents';
import { isMilestoneStoragePath } from '@/lib/documents/milestone-document-storage';
import { vaultLocationLabel, type VaultDocument } from '@/lib/documents/vault-documents';
import { formatUploadDate } from '@/views/vault/vault-tree';
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
}: {
  label: string;
  depth: number;
  count: number;
  open: boolean;
  onToggle: () => void;
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
}: {
  doc: VaultDocument;
  depth: number;
  selected: boolean;
  tag?: string;
  sub?: string;
  onSelect: () => void;
}) {
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
        <span className="hidden flex-none text-[12.5px] tabular-nums text-ink-muted sm:inline">
          {formatUploadDate(doc.uploadedAt)}
        </span>
      </button>
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

/** The preview pane: a 52px head with the badge and name, the open card, then the facts. */
export function VaultPreviewPane({ doc }: { doc: VaultDocument }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-[52px] items-center gap-3 border-b border-line-soft px-4">
        <FileBadge name={doc.fileName} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{doc.fileName}</span>
      </div>
      <div className="grid flex-1 place-items-center bg-surface-sunken px-6 py-8">
        <div className="grid w-full max-w-[340px] justify-items-center gap-3 rounded-md border-1.5 border-line bg-surface-raised px-4 py-10 text-center">
          <FileBadge name={doc.fileName} />
          <span className="max-w-full truncate text-[14px] font-medium text-ink">{doc.fieldLabel}</span>
          <DocumentOpenLink doc={doc} className="max-w-full truncate" />
        </div>
      </div>
      <dl className="text-[14px]">
        <Fact label="Client">{doc.companyName}</Fact>
        <Fact label="Step">{vaultLocationLabel(doc) || doc.milestoneTitle}</Fact>
        <Fact label="Date">{formatUploadDate(doc.uploadedAt)}</Fact>
        <Fact label="File">{doc.fileName}</Fact>
      </dl>
    </div>
  );
}
