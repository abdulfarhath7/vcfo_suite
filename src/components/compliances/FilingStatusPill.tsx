import { TONE_BADGE } from '@/components/common/IconChip';
import { FILING_STATUS_LABEL, FILING_STATUS_TONE, type FilingStatus } from '@/lib/filings';
import { cn } from '@/lib/utils';

/**
 * The canonical status pill, given filing wording.
 *
 * This is NOT a new pill variant: the classes are `TONE_BADGE[tone]` plus the
 * inventory's `rounded-full px-2.5 py-0.5 text-[11px] font-extrabold`, exactly
 * as the lead dashboard's chips. It exists so four screens do not each repeat
 * the status → tone mapping.
 */
export function FilingStatusPill({
  status,
  className,
}: {
  status: FilingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
        TONE_BADGE[FILING_STATUS_TONE[status]],
        className,
      )}
    >
      {FILING_STATUS_LABEL[status]}
    </span>
  );
}
