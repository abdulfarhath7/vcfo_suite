'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, Eye } from 'lucide-react';
import { useDocViewer } from '@/components/client-portal/pages/documents/DocViewer';
import { DashSection } from '@/components/dash/DashSection';
import { DocumentIconButton } from '@/components/document-downloads/DocumentIconButton';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { useDocumentCatalog } from '@/hooks/use-document-downloads';
import { useSpiceAttachments } from '@/hooks/use-spice-attachments';
import { catalogViewerDocs, downloadDocumentKeys } from '@/lib/document-downloads/client';
import {
  attachmentFilesUnavailableReason,
  filesForSpiceAttachment,
} from '@/lib/document-downloads/spice-attachment-files';
import {
  SPICE_ATTACHMENT_STATUS_LABEL,
  type SpiceAttachment,
  type SpiceAttachmentStatus,
} from '@/lib/spice-attachments/derive';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';

const TONE: Record<SpiceAttachmentStatus, ChipTone> = {
  done: 'ok',
  waiting: 'teal',
  'not-started': 'idle',
};

function StatusChip({ status }: { status: SpiceAttachmentStatus }) {
  return (
    <Chip tone={TONE[status]} fixed>
      {SPICE_ATTACHMENT_STATUS_LABEL[status]}
    </Chip>
  );
}

/**
 * SPICe+ attachments (spec T6 of the Board resolution (NOC) page): the documents SPICe+ Part B
 * needs, each with Not started, Waiting or Done from existing records. The accepted board
 * resolution links to its Vault copy. Each row has an eye (the shared `DocViewer`: PDFs and images
 * inline, Word rendered) and a download icon over the row's own files from the download catalog;
 * one file downloads as itself, several as a ZIP. A row with no file yet has both icons off, with
 * the reason in the tip. Staff engagement page only; `shellBase` is the shell root
 * (`/app/lead`, `/app/manager`, `/app/admin`, `/app/super`) for the Vault link.
 */
export function SpiceAttachmentsCard({
  engagementId,
  shellBase,
  className,
}: {
  engagementId: string;
  shellBase: string;
  className?: string;
}) {
  const query = useSpiceAttachments(engagementId);
  const list = query.data;
  const catalog = useDocumentCatalog(engagementId);
  const viewer = useDocViewer();
  const [downloading, setDownloading] = useState<string | null>(null);

  const rowFiles = (row: SpiceAttachment) => filesForSpiceAttachment(row.key, catalog.data?.root).filter((f) => f.ready);
  const unavailable = (row: SpiceAttachment): string | null => {
    if (catalog.isPending) return 'Loading the files…';
    if (catalog.isError) return 'The files could not be loaded';
    return attachmentFilesUnavailableReason(filesForSpiceAttachment(row.key, catalog.data?.root), row.detail);
  };

  const download = async (row: SpiceAttachment) => {
    setDownloading(row.key);
    try {
      const out = await downloadDocumentKeys(engagementId, rowFiles(row).map((f) => f.key));
      if (out.queued) toastSuccess('Making the ZIP', `${out.fileName ?? row.label} will be in your notifications when it is ready.`);
    } catch (err) {
      toastError('The download did not start', errorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  const vaultHref = (row: SpiceAttachment) =>
    row.vaultDocumentId ? `${shellBase}/vault/view/${encodeURIComponent(row.vaultDocumentId)}` : null;

  const columns: EFilingColumn<SpiceAttachment>[] = [
    { key: 'label', header: 'Document', render: (row) => <span className="text-ink">{row.label}</span> },
    { key: 'step', header: 'From', width: '22%', render: (row) => <span className="text-ink-muted">{row.stepTitle}</span> },
    { key: 'detail', header: 'State', width: '18%', render: (row) => <span className="text-ink-muted">{row.detail}</span> },
    { key: 'status', header: 'Status', width: '134px', render: (row) => <StatusChip status={row.status} /> },
    {
      key: 'open',
      header: '',
      width: '172px',
      align: 'right',
      render: (row) => {
        const href = vaultHref(row);
        const reason = unavailable(row);
        return (
          <span className="inline-flex items-center justify-end gap-1.5">
            {href ? (
              <Link href={href} className="mr-1 text-[13px] font-medium text-brand-text hover:underline">
                Open copy
              </Link>
            ) : null}
            <DocumentIconButton
              label={`Preview ${row.label}`}
              icon={<Eye size={15} strokeWidth={1.6} aria-hidden />}
              disabledReason={reason}
              onClick={() => viewer.open(catalogViewerDocs(engagementId, rowFiles(row)), 0)}
              testId={`spice-preview-${row.key}`}
            />
            <DocumentIconButton
              label={`Download ${row.label}`}
              icon={<Download size={15} strokeWidth={1.6} aria-hidden />}
              disabledReason={reason}
              busy={downloading === row.key}
              onClick={() => void download(row)}
              testId={`spice-download-${row.key}`}
            />
          </span>
        );
      },
    },
  ];

  return (
    <DashSection
      title="SPICe+ attachments"
      meta={list ? `${list.done} of ${list.total} done` : undefined}
      flush
      loading={query.isPending}
      className={className}
    >
      {query.isError ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">Could not load the attachments.</p>
      ) : (
        <EFilingGrid caption="SPICe+ attachments" columns={columns} rows={list?.items ?? []} rowKey={(row) => row.key} pageSize={20} empty="No attachments." />
      )}
      {viewer.node}
    </DashSection>
  );
}
