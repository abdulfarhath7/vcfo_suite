'use client';

import { FolderClosed } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { DashDataTable, type DashColumn } from '@/components/dash/DashDataTable';
import { TONE_BADGE } from '@/components/common/IconChip';
import { formatSuperDayMonth } from '@/components/super/overview/super-overview-format';
import type { SuperDocument, SuperEngagementDetail } from '@/lib/super-overview';
import { cn } from '@/lib/utils';

/**
 * Everything filed against this engagement. Read-only: no download links are
 * minted here, because a signed URL is a write-shaped action and this surface
 * does not take those (context §3). The firm project screen owns downloads.
 */
export function SuperProjectDocuments({ detail }: { detail: SuperEngagementDetail }) {
  const documents = detail.documents;
  const shared = documents.filter((doc) => doc.sharedWithClient).length;

  return (
    <DashSection
      icon={FolderClosed}
      tone="amber"
      title="Documents"
      meta={documents.length === 0 ? undefined : `${shared} of ${documents.length} shared`}
      href={detail.enterAs.firm}
      hrefLabel="Firm view"
      bodyClassName="px-0 pb-0 pt-1"
    >
      <DashDataTable
        bare
        columns={COLUMNS}
        rows={documents}
        rowKey={(row) => row.id}
        mobile={(row) => <DocumentMobileRow document={row} />}
        empty="No documents filed yet."
      />
    </DashSection>
  );
}

const COLUMNS: DashColumn<SuperDocument>[] = [
  {
    key: 'file',
    header: 'File',
    width: 'minmax(0,1.6fr)',
    render: (row) => <span className="block min-w-0 truncate text-ink">{row.fileName}</span>,
  },
  {
    key: 'category',
    header: 'Category',
    width: 'minmax(0,0.8fr)',
    render: (row) => (
      <span className="block min-w-0 truncate text-muted-foreground">{row.category ?? '—'}</span>
    ),
  },
  {
    key: 'step',
    header: 'Step',
    width: 'minmax(0,0.7fr)',
    mono: true,
    render: (row) => <span className="text-muted-foreground">{row.stepId ?? '—'}</span>,
  },
  {
    key: 'shared',
    header: 'Client',
    width: 'minmax(4.5rem,0.5fr)',
    render: (row) => (
      <span
        className={cn(
          'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
          row.sharedWithClient ? TONE_BADGE.success : TONE_BADGE.neutral,
        )}
      >
        {row.sharedWithClient ? 'Shared' : 'Internal'}
      </span>
    ),
  },
  {
    key: 'created',
    header: 'Filed',
    width: 'minmax(4.5rem,0.5fr)',
    align: 'right',
    mono: true,
    render: (row) => <span>{formatSuperDayMonth(row.createdAt)}</span>,
  },
];

function DocumentMobileRow({ document }: { document: SuperDocument }) {
  return (
    <div className="min-w-0">
      <p className="min-w-0 truncate text-[13px] font-extrabold text-ink">{document.fileName}</p>
      <p className="mt-1 min-w-0 truncate text-[11.5px] font-semibold text-muted-foreground">
        {[document.category, document.stepId, formatSuperDayMonth(document.createdAt)]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  );
}
