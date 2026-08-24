'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Zap } from 'lucide-react';
import { InternWorkQueueRow } from '@/components/intern/InternWorkRow';
import { internToneBadge } from '@/components/intern/intern-tones';
import {
  internActionQueueByCompany,
  internQueueCompanyHref,
  readInternQueueExpanded,
  writeInternQueueExpanded,
  INTERN_TASKS_PATH,
  type InternActionCompanyGroup,
  type InternWorkItem,
} from '@/lib/intern-work';
import { initialsFromName } from '@/lib/auth';
import { TONE_BADGE, toneForKey } from '@/components/common/IconChip';
import { cn } from '@/lib/utils';

function LeadActionCompanyCard({
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
    <div className="mb-2.5 overflow-hidden rounded-xl border border-border last:mb-0">
      <div
        className={cn(
          'relative flex items-center gap-2.5 bg-raised px-3.5 py-2.5 transition-colors',
          'hover:bg-primary-light/40',
        )}
      >
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Hide tasks for ${group.companyName}` : `Show tasks for ${group.companyName}`}
          onClick={onToggle}
        />
        <span
          className={`pointer-events-none relative z-10 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-[11px] font-extrabold ${TONE_BADGE[toneForKey(group.engagementId)]}`}
        >
          {initialsFromName(group.companyName).slice(0, 2)}
        </span>
        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          className="relative z-10 min-w-0 truncate text-[13px] font-extrabold text-ink hover:text-primary hover:underline"
        >
          {group.companyName}
        </Link>
        <span
          className={`pointer-events-none relative z-10 ml-auto shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${internToneBadge(group.pill.tone)}`}
        >
          {group.pill.label}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'pointer-events-none relative z-10 h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-200',
            open && 'rotate-180',
          )}
          strokeWidth={2.4}
        />
      </div>
      {open ? (
        <div id={panelId} role="region" aria-label={`${group.companyName} tasks`}>
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
    <section className="surface h-fit min-w-0 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-violet text-white">
          <Zap className="h-3.5 w-3.5" />
        </span>
        <h2 className="min-w-0 truncate text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">
          Action queue · by company
        </h2>
        <span className="ml-auto shrink-0 text-[11.5px] font-semibold text-text-tertiary">sorted by urgency</span>
      </div>
      <div className={cn('px-4 pb-4 pt-3', dense && 'max-h-[min(34rem,70vh)] overflow-y-auto pr-3')}>
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing needs you right now.</p>
        ) : (
          groups.map((group) => (
            <LeadActionCompanyCard
              key={group.engagementId}
              group={group}
              open={expanded.has(group.engagementId)}
              onToggle={() => toggle(group.engagementId)}
            />
          ))
        )}
        <Link href={INTERN_TASKS_PATH} className="mt-3 inline-flex text-xs font-extrabold text-primary hover:underline">
          View all work →
        </Link>
      </div>
    </section>
  );
}
