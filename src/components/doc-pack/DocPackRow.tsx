'use client';

import { sep } from '@/lib/date-format';
import Link from 'next/link';
import { Download, Eye } from 'lucide-react';

import { getItem } from '@/data/checklist';
import { DocStatusChip } from '@/components/doc-pack/DocStatusChip';
import { Button } from '@/components/ui/button';
import { FileBadge } from '@/components/ui/file-badge';
import { docPackRowName } from '@/lib/doc-pack/labels';
import type { DocPackItem, DocPackMissingInput } from '@/lib/doc-pack/types';
import { missingInputLabel } from '@/lib/doc-pack/unblock';

export type DocPackRowProps = {
  item: DocPackItem;
  downloadUrl: string;
  hrefForMissing: (input: DocPackMissingInput) => string;
  hrefForStep: (stepId: string) => string;
  onPreview: (item: DocPackItem) => void;
};

function stepTitle(stepId: string): string {
  return getItem(stepId)?.title ?? stepId;
}

function formatAttachedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return sep(date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
}

/** One document: name and sources, status with the way to unblock it, preview and download. */
export function DocPackRow({ item, downloadUrl, hrefForMissing, hrefForStep, onPreview }: DocPackRowProps) {
  const ready = item.status === 'ready';
  const sources = item.sourceStepIds.map(stepTitle).join(' · ');
  const provenance =
    item.status !== 'ready'
      ? null
      : item.source === 'attached'
        ? item.docId === 'board-resolution'
          ? `Finalized${item.attachedAt ? ` · ${formatAttachedAt(item.attachedAt)}` : ''}`
          : `Attached to Pre-7${item.attachedAt ? ` · ${formatAttachedAt(item.attachedAt)}` : ''}`
        : 'Generated now';

  return (
    <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-3 border-t border-line-soft px-4 py-3 first:border-t-0 md:grid-cols-[44px_minmax(0,1.3fr)_minmax(0,1.6fr)_auto] md:items-center md:gap-4">
      {ready ? (
        <FileBadge type="DOCX" />
      ) : (
        <span className="inline-flex h-6 w-11 items-center justify-center rounded-mark border-1.5 border-dashed border-line-strong font-mono text-[11px] text-ink-faint">
          DOCX
        </span>
      )}
      <div className="min-w-0">
        <p className={ready ? 'text-[14px] font-medium text-ink' : 'text-[14px] font-medium text-ink-2'}>{docPackRowName(item)}</p>
        <span className="mt-0.5 block text-[12.5px] text-ink-muted">from {sources}</span>
      </div>

      <div className="col-start-2 min-w-0 text-[13px] md:col-start-auto">
        <DocStatusChip status={item.status} />
        {provenance ? <span className="ml-2 text-[12px] text-ink-muted">{provenance}</span> : null}
        {item.missing.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Missing inputs">
            {item.missing.map((input) => (
              <li key={input.key}>
                <Link
                  href={hrefForMissing(input)}
                  className="inline-flex h-6 items-center gap-1 rounded-md border-1.5 border-dashed border-warning-mid bg-surface-raised px-2 text-[12.5px] text-ink hover:bg-warning-soft"
                >
                  {missingInputLabel(input)}
                  <span className="text-ink-muted">in {stepTitle(input.stepId)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {item.blockedBy ? (
          <p className="mt-1.5 text-[12.5px] text-ink-muted">
            {item.blockedBy.gate === 'br-finalized' ? (
              <>
                Opens once the board resolution is finalized in{' '}
                <Link href={hrefForStep(item.blockedBy.stepId)} className="font-medium text-brand-text hover:underline">
                  {stepTitle(item.blockedBy.stepId)}
                </Link>
                .
              </>
            ) : (
              <>
                {item.blockedBy.label} in{' '}
                <Link href={hrefForStep(item.blockedBy.stepId)} className="font-medium text-brand-text hover:underline">
                  {stepTitle(item.blockedBy.stepId)}
                </Link>
                .
              </>
            )}
          </p>
        ) : null}
      </div>

      <div className="col-start-2 flex gap-1.5 md:col-start-auto md:justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!ready}
          onClick={() => onPreview(item)}
          aria-label={`Preview ${docPackRowName(item)}`}
        >
          <Eye strokeWidth={1.6} aria-hidden />
          Preview
        </Button>
        {ready ? (
          <Button variant="secondary" size="sm" asChild>
            <a href={downloadUrl} download aria-label={`Download ${docPackRowName(item)} as Word`}>
              <Download strokeWidth={1.6} aria-hidden />
              Download .docx
            </a>
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" disabled>
            <Download strokeWidth={1.6} aria-hidden />
            Download .docx
          </Button>
        )}
      </div>
    </li>
  );
}
