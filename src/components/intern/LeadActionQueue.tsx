'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ListTodo } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { InternWorkQueueRow } from '@/components/intern/InternWorkRow';
import { internToneSolid } from '@/components/intern/intern-tones';
import {
  internActionQueueByCompany,
  internQueueCompanyHref,
  readInternQueueExpanded,
  writeInternQueueExpanded,
  INTERN_TASKS_PATH,
  type InternActionCompanyGroup,
  type InternWorkItem,
} from '@/lib/intern/intern-work';
import { initialsFromName } from '@/lib/auth';
import { CHIP_CLASS, CHIP_COLUMN_CLASS } from '@/components/common/IconChip';
import { cn } from '@/lib/utils';

/* One company per row, hairlines between rows, no card inside the card. The
   status chip takes the column width so every row's chip lines up. */
function LeadActionCompanyRow({
  group,
  open,
  onToggle,
}: {
  group: InternActionCompanyGroup;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const href = internQueueCompanyHref(group.engagementId, group.items);

  return (
    <div className="border-t border-line first:border-0">
      <div className="relative flex min-h-row min-w-0 items-center gap-2.5 py-2">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Hide tasks for ${group.companyName}` : `Show tasks for ${group.companyName}`}
          onClick={onToggle}
        />
        <span className="pointer-events-none relative z-10 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md bg-surface-sunken text-[11px] font-semibold text-ink-muted">
          {initialsFromName(group.companyName).slice(0, 2)}
        </span>
        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          className="relative z-10 min-w-0 truncate text-[13px] font-semibold text-ink hover:text-brand hover:underline"
        >
          {group.companyName}
        </Link>
        {/* K-32 (audit 173): the item count is a soft count chip; a zero shows nothing. */}
        {group.items.length > 0 ? (
          <span
            className={cn('pointer-events-none relative z-10 ml-auto shrink-0', CHIP_CLASS, 'bg-surface-sunken text-ink-muted tabular-nums')}
            aria-label={`${group.items.length} ${group.items.length === 1 ? 'item' : 'items'}`}
          >
            {group.items.length}
          </span>
        ) : null}
        <span
          className={cn(
            'pointer-events-none relative z-10 shrink-0',
            group.items.length > 0 ? null : 'ml-auto',
            CHIP_CLASS,
            CHIP_COLUMN_CLASS,
            internToneSolid(group.pill.tone),
          )}
        >
          {group.pill.label}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'pointer-events-none relative z-10 h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform duration-200',
            open && 'rotate-180',
          )}
          strokeWidth={2}
        />
      </div>
      {open ? (
        <div id={panelId} role="region" aria-label={`${group.companyName} tasks`} className="pb-1">
          {group.items.slice(0, 3).map((item) => (
            <InternWorkQueueRow key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LeadActionQueue({
  userId,
  items,
  now,
}: {
  userId: string;
  items: InternWorkItem[];
  now: Date;
}) {
  const groups = internActionQueueByCompany(items, now).slice(0, 6);
  const dense = groups.length > 3;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!userId) return;
    setExpanded(new Set(readInternQueueExpanded(userId)));
  }, [userId]);

  const toggle = (engagementId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(engagementId)) next.delete(engagementId);
      else next.add(engagementId);
      if (userId) writeInternQueueExpanded(userId, next);
      return next;
    });
  };

  return (
    <DashSection
      icon={ListTodo}
      title="Action queue · by company"
      className="h-fit"
      bodyClassName={cn(dense && 'max-h-[min(34rem,70vh)] overflow-y-auto')}
    >
      {groups.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-muted">Nothing needs you right now.</p>
      ) : (
        groups.map((group) => (
          <LeadActionCompanyRow
            key={group.engagementId}
            group={group}
            open={expanded.has(group.engagementId)}
            onToggle={() => toggle(group.engagementId)}
          />
        ))
      )}
      <Link
        href={INTERN_TASKS_PATH}
        className="mt-2 inline-flex text-[12px] font-semibold text-brand hover:text-brand-strong hover:underline"
      >
        View all work →
      </Link>
    </DashSection>
  );
}
