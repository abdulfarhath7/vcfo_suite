import { Check } from 'lucide-react';
import type { ChecklistItem } from '@/data/checklist';
import {
  formatResponseSummary,
  type ChecklistItemResponses,
} from '@/lib/checklist/checklist-responses';
import { cn } from '@/lib/utils';

interface MilestoneResponseRowSummaryProps {
  item: ChecklistItem;
  responses?: ChecklistItemResponses;
  variant?: 'admin' | 'client';
  /** Show "Add details" when empty (client portal) */
  showEmptyHint?: boolean;
  /** Intern/lead: omit the Submitted chip; keep the response summary text. */
  hideStatus?: boolean;
  className?: string;
}

export function MilestoneResponseRowSummary({
  item,
  responses,
  variant = 'admin',
  showEmptyHint = false,
  hideStatus = false,
  className,
}: MilestoneResponseRowSummaryProps) {
  const isClient = variant === 'client';
  const { summary, isComplete, hasAny } = formatResponseSummary(item, responses);

  if (!hasAny && !showEmptyHint) return null;

  if (!hasAny && showEmptyHint) {
    return (
      <p
        className={cn(
          'mt-1.5 text-xs',
          isClient ? 'text-ink-faint/80' : 'text-ink-faint',
          className,
        )}
      >
        Add details
      </p>
    );
  }

  return (
    <div className={cn('mt-1.5 flex min-w-0 flex-wrap items-center gap-2', className)}>
      {isComplete && !hideStatus && (
        <span
          className={cn(
            // Token pair that flips in dark mode (R-13 done tone), not a raw palette colour.
            'inline-flex shrink-0 items-center gap-1 rounded-sm bg-positive-soft px-2 py-0.5 text-[11px] font-medium text-positive',
          )}
        >
          <Check className="h-3 w-3" aria-hidden />
          Submitted
        </span>
      )}
      {summary && (
        <p
          className={cn(
            'min-w-0 flex-1 text-xs leading-snug line-clamp-2',
            'text-ink-muted',
          )}
          title={summary}
        >
          {summary}
        </p>
      )}
    </div>
  );
}
