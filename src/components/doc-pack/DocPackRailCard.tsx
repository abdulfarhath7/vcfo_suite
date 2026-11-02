'use client';

import Link from 'next/link';

import { getItem } from '@/data/checklist';
import { DOC_STATUS_BAR, DocStatusDot } from '@/components/doc-pack/DocStatusChip';
import { Surface } from '@/components/noir';
import { buttonVariants } from '@/components/ui/button-variants';
import type { DocPackMissingInput, DocPackSummary, DocStatus } from '@/lib/doc-pack/types';
import { fastestUnblock, missingInputLabel } from '@/lib/doc-pack/unblock';
import { cn } from '@/lib/utils';

const LEGEND: Record<DocStatus, string> = {
  ready: 'ready to download',
  'needs-inputs': 'need inputs',
  'waiting-release': 'waiting for release',
};

/* The same three colours as the pack page's chips: waiting for release is grey. */
const BAR: Record<DocStatus, string> = DOC_STATUS_BAR;

export type DocPackRailCardProps = {
  summary: DocPackSummary | undefined;
  loading: boolean;
  error: boolean;
  packHref: string;
  currentStepId: string;
  hrefForMissing: (input: DocPackMissingInput) => string;
  className?: string;
};

/**
 * Status and a link, under the journey rail on SPICe+ Part A / B steps.
 * Never a download: the pack page is the only place that serves files.
 */
export function DocPackRailCard({
  summary,
  loading,
  error,
  packHref,
  currentStepId,
  hrefForMissing,
  className,
}: DocPackRailCardProps) {
  const hint = summary ? fastestUnblock(summary, currentStepId) : null;
  const total = summary?.total ?? 0;
  const ready = summary?.counts.ready ?? 0;

  return (
    <Surface
      className={cn('p-4', className)}
      aria-labelledby="doc-pack-rail-title"
      role="region"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="doc-pack-rail-title" className="text-[15px] font-medium text-ink">
          Pre-incorporation documents
        </h3>
        {summary ? (
          <span className="text-[12.5px] tabular-nums text-ink-muted">
            {ready} of {total} ready
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-[12.5px] text-ink-muted">Readiness could not be loaded.</p>
      ) : !summary ? (
        <p className="mt-2 text-[12.5px] text-ink-muted" aria-busy={loading}>
          Checking readiness…
        </p>
      ) : (
        <>
          <div className="my-3 flex h-2 gap-0.5 overflow-hidden rounded-bar bg-surface-sunken" aria-hidden>
            {(['ready', 'needs-inputs', 'waiting-release'] as const).map((status) =>
              summary.counts[status] > 0 ? (
                <span key={status} className={cn('block rounded-bar', BAR[status])} style={{ flex: summary.counts[status] }} />
              ) : null,
            )}
          </div>
          <ul className="mb-3 space-y-1 text-[12.5px] text-ink-muted">
            {(['ready', 'needs-inputs', 'waiting-release'] as const).map((status) => (
              <li key={status} className="flex items-center gap-2">
                <DocStatusDot status={status} />
                <b className="min-w-[1ch] font-medium tabular-nums text-ink">{summary.counts[status]}</b>
                {LEGEND[status]}
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href={packHref}
        className={cn(buttonVariants({ variant: 'default' }), 'w-full')}
      >
        Open document pack
      </Link>

      {hint ? (
        <p className="mt-3 border-t border-line-soft pt-3 text-[12.5px] text-ink-muted">
          Fastest unblock:{' '}
          <Link href={hrefForMissing(hint.input)} className="font-medium text-brand-text hover:underline">
            {missingInputLabel(hint.input)}
          </Link>{' '}
          {hint.input.stepId === currentStepId ? 'in this step' : `in ${getItem(hint.input.stepId)?.title ?? hint.input.stepId}`}
          {hint.releases > 0
            ? ` releases ${hint.releases} ${hint.releases === 1 ? 'document' : 'documents'}.`
            : ` is needed by ${hint.appearsIn} ${hint.appearsIn === 1 ? 'document' : 'documents'}.`}
        </p>
      ) : null}
    </Surface>
  );
}
