'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';

import { docsFedByStep } from '@/lib/doc-pack/step-strip';
import type { DocPackSummary } from '@/lib/doc-pack/types';
import { cn } from '@/lib/utils';

/** One line at the top of a step form: which documents read this step, and where they stand. Status + link only. */
export function DocSourceStrip({
  summary,
  stepId,
  packHref,
  className,
}: {
  summary: DocPackSummary;
  stepId: string;
  packHref: string;
  className?: string;
}) {
  const fed = docsFedByStep(summary, stepId);
  if (fed.total === 0) return null;
  const parts = [`${fed.counts.ready} ready`];
  if (fed.counts['needs-inputs'] > 0) parts.push(`${fed.counts['needs-inputs']} need inputs`);
  if (fed.counts['waiting-release'] > 0) parts.push(`${fed.counts['waiting-release']} waiting for release`);
  return (
    <p
      className={cn(
        'mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-panel px-3 py-2 text-[12.5px] text-muted-foreground',
        className,
      )}
    >
      <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
      <span>
        <b className="font-semibold text-foreground">{fed.total}</b> {fed.total === 1 ? 'document uses' : 'documents use'}{' '}
        this step&apos;s data
      </span>
      <span aria-hidden>·</span>
      <span>{parts.join(', ')}</span>
      <span aria-hidden>·</span>
      <Link href={packHref} className="font-medium text-primary hover:underline">
        Open in document pack
      </Link>
    </p>
  );
}
