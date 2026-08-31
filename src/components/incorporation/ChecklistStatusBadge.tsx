'use client';

import type { StatusCode } from '@/data/checklist';
import { StatusBadge } from '@/components/common/StatusBadge';
import { StatusPill } from '@/components/common/StatusPill';
import { cn } from '@/lib/utils';

/**
 * Status for one checklist step — the badge or the pill, nothing else.
 *
 * This replaced `ChecklistExpectedTimeline`, which printed explanatory copy
 * beside the status ("Expected timeline · 2–3 working days"). The product does
 * not explain itself in the UI: a step shows what it is and what state it is
 * in. `expectedTimeline` stays on the catalog item for callers that need the
 * value itself (deadline math, email copy) — it is simply not rendered as
 * prose.
 */

export function ChecklistStatusBadge({
  status,
  className,
  badgeClassName,
  hideStatus = false,
}: {
  status: StatusCode;
  className?: string;
  badgeClassName?: string;
  /** Intern/lead rails omit the badge entirely. */
  hideStatus?: boolean;
}) {
  if (hideStatus) return null;
  return (
    <span className={cn('inline-flex shrink-0 items-center', className)}>
      <StatusBadge status={status} className={badgeClassName} />
    </span>
  );
}

export function ChecklistStatusPill({
  status,
  className,
  pillClassName,
  hideStatus = false,
}: {
  status: StatusCode;
  className?: string;
  pillClassName?: string;
  hideStatus?: boolean;
}) {
  if (hideStatus) return null;
  return (
    <span className={cn('inline-flex shrink-0 items-center', className)}>
      <StatusPill status={status} className={pillClassName} />
    </span>
  );
}
