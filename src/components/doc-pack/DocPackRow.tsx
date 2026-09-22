'use client';

import Link from 'next/link';
import { Download, Eye } from 'lucide-react';

import { getItem } from '@/data/checklist';
import { DocStatusChip } from '@/components/doc-pack/DocStatusChip';
import { AccentButton, Mono } from '@/components/noir';
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
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
    <li className="grid grid-cols-1 gap-3 border-t border-border px-5 py-4 first:border-t-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_auto] md:items-center md:gap-4">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-foreground">{docPackRowName(item)}</p>
        <Mono className="mt-0.5 block text-[11.5px] text-muted-foreground">from {sources}</Mono>
      </div>

      <div className="min-w-0 text-[13px]">
        <DocStatusChip status={item.status} />
        {provenance ? <span className="ml-2 text-[12px] text-muted-foreground">{provenance}</span> : null}
        {item.missing.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Missing inputs">
            {item.missing.map((input) => (
              <li key={input.key}>
                <Link
                  href={hrefForMissing(input)}
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-warning bg-panel px-2 py-0.5 text-[12.5px] text-foreground hover:bg-warning-light"
                >
                  {missingInputLabel(input)}
                  <span className="text-muted-foreground">in {stepTitle(input.stepId)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {item.blockedBy ? (
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {item.blockedBy.gate === 'br-finalized' ? (
              <>
                Opens once the board resolution is finalized in{' '}
                <Link href={hrefForStep(item.blockedBy.stepId)} className="font-medium text-primary hover:underline">
                  {stepTitle(item.blockedBy.stepId)}
                </Link>
                .
              </>
            ) : (
              <>
                {item.blockedBy.label} in{' '}
                <Link href={hrefForStep(item.blockedBy.stepId)} className="font-medium text-primary hover:underline">
                  {stepTitle(item.blockedBy.stepId)}
                </Link>
                .
              </>
            )}
          </p>
        ) : null}
      </div>

      <div className="flex gap-1.5 md:justify-end">
        <AccentButton
          type="button"
          variant="outline"
          size="sm"
          disabled={!ready}
          onClick={() => onPreview(item)}
          aria-label={`Preview ${docPackRowName(item)}`}
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Preview
        </AccentButton>
        {ready ? (
          <a
            href={downloadUrl}
            download
            className="inline-flex h-9 min-h-[44px] items-center rounded-md border border-border bg-panel px-3 text-xs font-medium text-primary hover:border-primary/35 hover:bg-primary-light sm:min-h-9"
            aria-label={`Download ${docPackRowName(item)} as Word`}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Download .docx
          </a>
        ) : (
          <AccentButton type="button" variant="outline" size="sm" disabled>
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Download .docx
          </AccentButton>
        )}
      </div>
    </li>
  );
}
