import { DOC_STATUS_LABEL } from '@/lib/doc-pack/labels';
import type { DocStatus } from '@/lib/doc-pack/types';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { cn } from '@/lib/utils';

/* VCFO Spectrum status chip (R-13) for a pack document, as the prototype `DocumentPackScreen`
   draws it: ready is green, needs inputs amber, waiting for release grey. The words stay the
   pack's own. `DOC_STATUS_TAG_TONE` is the same tone for the count tags in the page head. */
export const DOC_STATUS_TAG_TONE: Record<DocStatus, ChipTone> = {
  ready: 'ok',
  'needs-inputs': 'warn',
  'waiting-release': 'idle',
};
const TONE = DOC_STATUS_TAG_TONE;
export const DOC_STATUS_BAR: Record<DocStatus, string> = {
  ready: 'bg-positive-mid',
  'needs-inputs': 'bg-warning-mid',
  'waiting-release': 'bg-upcoming-mid',
};
const DOT = DOC_STATUS_BAR;

export function DocStatusChip({ status, className }: { status: DocStatus; className?: string }) {
  return (
    <Chip tone={TONE[status]} className={className}>
      {DOC_STATUS_LABEL[status]}
    </Chip>
  );
}

export function DocStatusDot({ status, className }: { status: DocStatus; className?: string }) {
  return <span className={cn('inline-block h-[7px] w-[7px] shrink-0 rounded-[2px]', DOT[status], className)} aria-hidden />;
}
