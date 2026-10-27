'use client';

import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { internCompanyPhaseProgress } from '@/lib/intern/intern-work';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { internToneSolid } from '@/components/intern/intern-tones';
import { CHIP_CLASS, CHIP_COLUMN_CLASS } from '@/components/common/IconChip';
import { cn } from '@/lib/utils';

const PHASE_LABELS = ['Part A', 'Part B', 'Post-inc', 'Registration'];

/* Progress is one colour (blue, green once a phase is done). Each phase is its own
   6px bar with its count under it, so no legend line is needed. */
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
                      ? internToneSolid('danger')
                      : complete
                        ? internToneSolid('success')
                        : internToneSolid('primary'),
                  )}
                >
                  {chip}
                </span>
              </div>
              {/* K-33 (audit 173): a 6px bar per phase with its count under it. */}
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.phases.length}, minmax(0, 1fr))` }}>
                {row.phases.map((phase, i) => (
                  <div key={phase.id} className="min-w-0">
                    <div className="relative h-1.5 overflow-hidden rounded-[3px] bg-upcoming-soft">
                      <i
                        className={cn('absolute inset-y-0 left-0 rounded-[3px]', phase.pct >= 100 ? 'bg-positive-mid' : 'bg-brand')}
                        style={{ width: `${phase.pct}%` }}
                      />
                    </div>
                    <p className="mt-1 truncate text-[11px] tabular-nums text-ink-muted">
                      {PHASE_LABELS[i] ?? phase.title} · {phase.done}/{phase.total}
                    </p>
                  </div>
                ))}
              </div>
            </Link>
          );
        })
      )}
    </DashSection>
  );
}
