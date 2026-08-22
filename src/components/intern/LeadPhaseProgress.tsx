'use client';

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { internCompanyPhaseProgress } from '@/lib/intern-work';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { internToneBadge } from '@/components/intern/intern-tones';
import { cn } from '@/lib/utils';

const PHASE_FILL = [
  'bg-[oklch(var(--phase-pre))]',
  'bg-[oklch(var(--phase-filing))]',
  'bg-[oklch(var(--phase-post))]',
  'bg-[oklch(var(--phase-registration))]',
];

const PHASE_KEY = [
  { flex: 5, label: 'Part A', color: 'bg-[oklch(var(--phase-pre))]', text: 'text-[oklch(var(--phase-pre-text))]' },
  { flex: 7, label: 'Part B', color: 'bg-[oklch(var(--phase-filing))]', text: 'text-[oklch(var(--phase-filing-text))]' },
  { flex: 11, label: 'Post-inc', color: 'bg-[oklch(var(--phase-post))]', text: 'text-[oklch(var(--phase-post-text))]' },
  { flex: 23, label: 'Registration', color: 'bg-[oklch(var(--phase-registration))]', text: 'text-[oklch(var(--phase-registration-text))]' },
];

export function LeadPhaseProgress({
  engagements,
  getState,
}: {
  engagements: Engagement[];
  getState: (engagement: Engagement) => Record<string, ChecklistItemStateSlice>;
}) {
  const rows = engagements.map((eng) => internCompanyPhaseProgress(eng, getState(eng)));
  const dense = rows.length > 5;
  const compact = rows.length <= 2;

  return (
    <section className="surface h-fit min-w-0 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success text-white">
          <TrendingUp className="h-3.5 w-3.5" />
        </span>
        <h2 className="min-w-0 truncate text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">
          My companies · phase progress
        </h2>
        <span className="ml-auto hidden shrink-0 text-[11.5px] font-semibold text-text-tertiary sm:inline">
          Part A → Registration
        </span>
      </div>
      <div className={cn('px-4 pb-4 pt-3', dense && 'max-h-[22rem] overflow-y-auto pr-3')}>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No companies assigned yet.</p>
        ) : (
          rows.map((row) => {
            const complete = row.phases.length > 0 && row.phases.every((phase) => phase.pct >= 100);
            const chip = row.stuck ? 'Stuck' : complete ? 'Complete' : 'In progress';
            return (
              <Link
                key={row.engagementId}
                href={row.href}
                title={row.currentLabel}
                className={cn('block', compact ? 'mt-2.5 first:mt-0.5' : 'mt-3.5 first:mt-0.5')}
              >
                <div className="mb-1.5 flex items-center gap-2 text-[12.5px]">
                  <b className="min-w-0 truncate font-extrabold text-ink">{row.companyName}</b>
                  <span
                    className={cn(
                      'ml-auto inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
                      row.stuck ? internToneBadge('danger') : complete ? internToneBadge('success') : internToneBadge('sky'),
                    )}
                  >
                    {chip}
                  </span>
                </div>
                <div className="flex h-2.5 gap-1">
                  {row.phases.map((phase, i) => (
                    <div
                      key={phase.id}
                      className="relative overflow-hidden rounded-full bg-raised"
                      style={{ flex: Math.max(phase.total, 1) }}
                    >
                      <i
                        className={cn('absolute inset-y-0 left-0 rounded-full', PHASE_FILL[i] ?? 'bg-primary')}
                        style={{ width: `${phase.pct}%` }}
                      />
                    </div>
                  ))}
                </div>
              </Link>
            );
          })
        )}
        <div className="mt-2 flex text-[10.5px] font-bold">
          {PHASE_KEY.map((k) => (
            <span key={k.label} className="flex min-w-0 items-center gap-1.5" style={{ flex: k.flex }}>
              <i className={cn('h-2 w-2 shrink-0 rounded-sm', k.color)} />
              <span className={cn('truncate', k.text)}>{k.label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
