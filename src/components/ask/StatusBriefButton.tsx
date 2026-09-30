'use client';

import { FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAskOptional } from './ask-context';

/** C4: download this month's status brief. Client only, behind ASK_VCFO_FEATURE_C4. */
export function StatusBriefButton({ className }: { className?: string }) {
  const ask = useAskOptional();
  if (!ask?.enabled || !ask.features.C4 || ask.shell !== 'client' || ask.preview || !ask.engagementId) return null;
  return (
    <a
      href={`/api/ask/brief?${new URLSearchParams({ engagementId: ask.engagementId })}`}
      className={cn(
        'inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3 text-[13px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
    >
      <FileDown className="h-4 w-4" aria-hidden /> Monthly status brief
    </a>
  );
}
