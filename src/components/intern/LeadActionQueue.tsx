'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { InternWorkQueueRow } from '@/components/intern/InternWorkRow';
import { internToneBadge } from '@/components/intern/intern-tones';
import { internActionQueueByCompany, INTERN_TASKS_PATH, type InternWorkItem } from '@/lib/intern-work';
import { initialsFromName } from '@/lib/auth';
import { TONE_BADGE, toneForKey } from '@/components/common/IconChip';
import { cn } from '@/lib/utils';

export function LeadActionQueue({ items, now }: { items: InternWorkItem[]; now: Date }) {
  const groups = internActionQueueByCompany(items, now).slice(0, 6);
  const dense = groups.length > 3;

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
            <div key={group.engagementId} className="mb-2.5 overflow-hidden rounded-xl border border-border last:mb-0">
              <div className="flex items-center gap-2.5 bg-raised px-3.5 py-2.5">
                <span
                  className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-[11px] font-extrabold ${TONE_BADGE[toneForKey(group.engagementId)]}`}
                >
                  {initialsFromName(group.companyName).slice(0, 2)}
                </span>
                <b className="min-w-0 truncate text-[13px] font-extrabold">{group.companyName}</b>
                <span className={`ml-auto shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${internToneBadge(group.pill.tone)}`}>
                  {group.pill.label}
                </span>
              </div>
              {group.items.slice(0, 3).map((item) => (
                <InternWorkQueueRow key={item.id} item={item} />
              ))}
            </div>
          ))
        )}
        <Link href={INTERN_TASKS_PATH} className="mt-3 inline-flex text-xs font-extrabold text-primary hover:underline">
          View all work →
        </Link>
      </div>
    </section>
  );
}
