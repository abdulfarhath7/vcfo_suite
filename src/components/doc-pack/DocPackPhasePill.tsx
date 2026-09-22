'use client';

import Link from 'next/link';

import { Mono } from '@/components/noir';
import type { DocPackSummary } from '@/lib/doc-pack/types';
import { cn } from '@/lib/utils';

/** "Documents ready/total" on the SPICe+ Part A / B overview rows, opening the pack filtered to that part. */
export function DocPackPhasePill({
  summary,
  href,
  className,
}: {
  summary: DocPackSummary | undefined;
  href: string;
  className?: string;
}) {
  if (!summary) return null;
  const allReady = summary.total > 0 && summary.counts.ready === summary.total;
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-panel px-3 py-1 text-[12.5px] font-medium text-primary hover:bg-primary-light',
        className,
      )}
      aria-label={`Documents, ${summary.counts.ready} of ${summary.total} ready`}
    >
      Documents
      <Mono className={cn('font-semibold', allReady ? 'text-success-text' : 'text-warning-text')}>
        {summary.counts.ready} / {summary.total}
      </Mono>
    </Link>
  );
}
