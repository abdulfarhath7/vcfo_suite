'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';

import { Mono } from '@/components/noir';
import type { DocPackSummary } from '@/lib/doc-pack/types';
import { cn } from '@/lib/utils';

/** Narrow-screen stand-in for the rail card: shown only while the rail is hidden. */
export function DocPackHeaderButton({
  summary,
  packHref,
  className,
}: {
  summary: DocPackSummary | undefined;
  packHref: string;
  className?: string;
}) {
  const ready = summary?.counts.ready ?? 0;
  const total = summary?.total ?? 0;
  const allReady = total > 0 && ready === total;
  return (
    <Link
      href={packHref}
      className={cn(
        'inline-flex h-control-md items-center gap-2 rounded-md border-1.5 border-line-strong bg-surface-raised px-3 text-[14px] font-medium text-ink hover:bg-surface-sunken',
        className,
      )}
    >
      <FileText className="h-3.5 w-3.5" aria-hidden />
      Document pack
      {summary ? (
        <Mono
          className={cn(
            'rounded-sm px-2 py-0.5 text-[11.5px] font-semibold',
            allReady ? 'bg-positive-soft text-positive' : 'bg-warning-soft text-warning',
          )}
        >
          {ready} / {total}
        </Mono>
      ) : null}
    </Link>
  );
}
