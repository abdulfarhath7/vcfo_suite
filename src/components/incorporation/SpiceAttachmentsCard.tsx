'use client';

import Link from 'next/link';
import { DashSection } from '@/components/dash/DashSection';
import { DashDataTable, type DashColumn } from '@/components/dash/DashDataTable';
import { STATE_WORD_CLASS, TONE_TEXT, type IconChipTone } from '@/components/common/IconChip';
import { useSpiceAttachments } from '@/hooks/use-spice-attachments';
import {
  SPICE_ATTACHMENT_STATUS_LABEL,
  type SpiceAttachment,
  type SpiceAttachmentStatus,
} from '@/lib/spice-attachments/derive';
import { cn } from '@/lib/utils';

const TONE: Record<SpiceAttachmentStatus, IconChipTone> = {
  done: 'success',
  waiting: 'warning',
  'not-started': 'neutral',
};

function StatusWord({ status }: { status: SpiceAttachmentStatus }) {
  return <span className={cn(STATE_WORD_CLASS, TONE_TEXT[TONE[status]])}>{SPICE_ATTACHMENT_STATUS_LABEL[status]}</span>;
}

/**
 * SPICe+ attachments (spec T6 of the Board resolution (NOC) page): the documents SPICe+ Part B
 * needs, each with Not started, Waiting or Done from existing records. The accepted board
 * resolution links to its Vault copy. Staff engagement page only; `shellBase` is the shell root
 * (`/app/intern`, `/app/manager`, `/app/admin`, `/app/super`) for the Vault link.
 */
export function SpiceAttachmentsCard({
  engagementId,
  shellBase,
  className = 'mt-4',
}: {
  engagementId: string;
  shellBase: string;
  className?: string;
}) {
  const query = useSpiceAttachments(engagementId);
  const list = query.data;

  const vaultHref = (row: SpiceAttachment) =>
    row.vaultDocumentId ? `${shellBase}/vault/view/${encodeURIComponent(row.vaultDocumentId)}` : null;

  const columns: DashColumn<SpiceAttachment>[] = [
    { key: 'label', header: 'Document', width: 'minmax(0,2fr)', render: (row) => <span className="truncate text-ink">{row.label}</span> },
    { key: 'step', header: 'From', width: 'minmax(0,1fr)', render: (row) => <span className="truncate text-ink-muted">{row.stepTitle}</span> },
    { key: 'detail', header: 'State', width: 'minmax(0,1fr)', render: (row) => <span className="truncate text-ink-muted">{row.detail}</span> },
    { key: 'status', header: 'Status', width: '104px', render: (row) => <StatusWord status={row.status} /> },
    {
      key: 'open',
      header: '',
      width: '88px',
      align: 'right',
      render: (row) => {
        const href = vaultHref(row);
        return href ? (
          <Link href={href} className="text-[13px] font-medium text-brand-text hover:underline">
            Open copy
          </Link>
        ) : null;
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
        <DashDataTable
          bare
          columns={columns}
          rows={list?.items ?? []}
          rowKey={(row) => row.key}
          empty="No attachments."
          mobile={(row) => {
            const href = vaultHref(row);
            return (
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] text-ink">{row.label}</div>
                  <div className="truncate text-[12.5px] text-ink-muted">
                    {row.stepTitle} · {row.detail}
                  </div>
                  {href ? (
                    <Link href={href} className="text-[12.5px] font-medium text-brand-text hover:underline">
                      Open copy
                    </Link>
                  ) : null}
                </div>
                <StatusWord status={row.status} />
              </div>
            );
          }}
        />
      )}
    </DashSection>
  );
}
