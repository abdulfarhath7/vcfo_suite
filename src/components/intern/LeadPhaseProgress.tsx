'use client';

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { internCompanyPhaseProgress } from '@/lib/intern-work';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { internToneBadge } from '@/components/intern/intern-tones';
import { CHIP_CLASS, CHIP_COLUMN_CLASS } from '@/components/common/IconChip';
import { cn } from '@/lib/utils';

const PHASE_LABELS = ['Part A', 'Part B', 'Post-inc', 'Registration'];

/* Progress is one colour. The phases used to have a hue each; now the gaps
   between segments mark the phases and the state chip carries the status. */
export function LeadPhaseProgress({
  engagements,
  getState,
}: {
  engagements: Engagement[];
  getState: (engagement: Engagement) => Record<string, ChecklistItemStateSlice>;
}) {
  const rows = engagements.map((eng) => internCompanyPhaseProgress(eng, getState(eng)));
  const dense = rows.length > 5;

  return (
    <DashSection
      icon={TrendingUp}
      title="My companies · phase progress"
      className="h-fit"
      bodyClassName={cn(dense && 'max-h-[22rem] overflow-y-auto')}
    >
      {rows.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-muted">No companies assigned yet.</p>
      ) : (
        rows.map((row) => {
          const complete = row.phases.length > 0 && row.phases.every((phase) => phase.pct >= 100);
          const chip = row.stuck ? 'Stuck' : complete ? 'Complete' : 'In progress';
          return (
            <Link
              key={row.engagementId}
              href={row.href}
              title={row.currentLabel}
              className="mt-2.5 block first:mt-0.5"
            >
              <div className="mb-1.5 flex min-w-0 items-center gap-2 text-[12.5px]">
                <b className="min-w-0 truncate font-semibold text-ink">{row.companyName}</b>
                <span
                  className={cn(
                    'ml-auto shrink-0',
                    CHIP_CLASS,
                    CHIP_COLUMN_CLASS,
                    row.stuck
                      ? internToneBadge('danger')
                      : complete
                        ? internToneBadge('success')
                        : internToneBadge('primary'),
                  )}
                >
                  {chip}
                </span>
              </div>
              <div className="flex h-2 gap-1">
                {row.phases.map((phase) => (
                  <div
                    key={phase.id}
                    className="relative overflow-hidden rounded-[3px] bg-surface-sunken"
                    style={{ flex: Math.max(phase.total, 1) }}
                  >
                    <i
                      className="absolute inset-y-0 left-0 rounded-[3px] bg-brand"
                      style={{ width: `${phase.pct}%` }}
                    />
                  </div>
                ))}
              </div>
            </Link>
          );
        })
      )}
      <p className="mt-2 text-[11px] text-ink-muted">
        Segments, left to right: {PHASE_LABELS.join(' · ')}.
      </p>
    </DashSection>
  );
}
