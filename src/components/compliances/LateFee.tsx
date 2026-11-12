import { cn } from '@/lib/utils';
import { computeLateFee, lateFeeExplanation, lateFeeLabel, type LateFeeInput } from '@/lib/compliance/late-fees';

/**
 * The late fee of one filing (A1.5): the amount so far, with how it was worked out on hover.
 * Shows a dash when the filing is on time or its obligation has no fee rule. Used by the staff
 * obligation record and the client filing detail, so both read the same figure.
 */
export function LateFeeAmount({ filing, now, className }: { filing: LateFeeInput; now: Date; className?: string }) {
  const fee = computeLateFee(filing, now);
  if (!fee) return <span className="text-ink-faint">—</span>;
  return (
    <span className={cn('whitespace-nowrap', fee.ongoing ? 'font-medium text-danger' : 'text-warning', className)} title={lateFeeExplanation(fee)}>
      {lateFeeLabel(fee)}
      <span className="ml-1 text-[12px] font-normal text-ink-muted">est.</span>
    </span>
  );
}
