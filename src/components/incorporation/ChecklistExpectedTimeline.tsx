'use client';

import type { ChecklistItem } from '@/data/checklist';
import { getChecklistStepTimelineLabel } from '@/data/checklist';
import type { StatusCode } from '@/data/checklist';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StatusPill } from '@/components/common/StatusPill';
import { cn } from '@/lib/utils';

interface ChecklistTimelineProps {
  item: ChecklistItem;
  className?: string;
}

/** Muted mono timeline label for inline use beside status badges. */
export function ChecklistInlineTimeline({ item, className }: ChecklistTimelineProps) {
  const label = getChecklistStepTimelineLabel(item);
  return (
    <span
      className={cn(
        'text-[10px] font-mono leading-none text-muted-foreground tabular-nums',
        className,
      )}
      title={item.expectedTimeline ? 'Expected timeline' : 'Timeline'}
    >
      · {label}
    </span>
  );
}

/** Shows expected working-day timeline (or statutory deadline) for a checklist step. */
export function ChecklistExpectedTimeline({ item, className }: ChecklistTimelineProps) {
  const label = getChecklistStepTimelineLabel(item);
  const prefix = item.expectedTimeline ? 'Expected timeline' : 'Timeline';

  return (
    <p className={cn('text-[11px] leading-relaxed text-muted-foreground', className)}>
      <span className="font-medium text-foreground">{prefix}</span>
      {' · '}
      {label}
    </p>
  );
}

export function StatusBadgeWithTimeline({
  status,
  item,
  className,
  badgeClassName,
  timelineClassName,
}: {
  status: StatusCode;
  item: ChecklistItem;
  className?: string;
  badgeClassName?: string;
  timelineClassName?: string;
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1', className)}>
      <StatusBadge status={status} className={badgeClassName} />
      <ChecklistInlineTimeline item={item} className={timelineClassName} />
    </span>
  );
}

export function StatusPillWithTimeline({
  status,
  item,
  className,
  pillClassName,
  timelineClassName,
}: {
  status: StatusCode;
  item: ChecklistItem;
  className?: string;
  pillClassName?: string;
  timelineClassName?: string;
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5', className)}>
      <StatusPill status={status} className={pillClassName} />
      <ChecklistInlineTimeline item={item} className={timelineClassName} />
    </span>
  );
}
