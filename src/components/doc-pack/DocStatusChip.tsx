import { Check, Lock } from 'lucide-react';

import { DOC_STATUS_CHIP_TONE, DOC_STATUS_DOT_TONE, DOC_STATUS_LABEL } from '@/lib/doc-pack/labels';
import type { DocStatus } from '@/lib/doc-pack/types';
import { cn } from '@/lib/utils';

export function DocStatusChip({ status, className }: { status: DocStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold',
        DOC_STATUS_CHIP_TONE[status],
        className,
      )}
    >
      {status === 'ready' ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
      {status === 'waiting-release' ? <Lock className="h-3.5 w-3.5" aria-hidden /> : null}
      {DOC_STATUS_LABEL[status]}
    </span>
  );
}

export function DocStatusDot({ status, className }: { status: DocStatus; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', DOC_STATUS_DOT_TONE[status], className)} aria-hidden />;
}
