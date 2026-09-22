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
        'inline-flex h-9 items-center gap-2 rounded-md border border-border bg-panel px-3 text-[13px] font-medium text-primary hover:border-primary/35 hover:bg-primary-light',
        className,
      )}
    >
      <FileText className="h-3.5 w-3.5" aria-hidden />
      Document pack
      {summary ? (
        <Mono
          className={cn(
            'rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
            allReady ? 'bg-success-light text-success-text' : 'bg-warning-light text-warning-text',
          )}
        >
          {ready} / {total}
        </Mono>
      ) : null}
    </Link>
  );
}
