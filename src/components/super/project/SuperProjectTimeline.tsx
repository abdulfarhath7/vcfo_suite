'use client';

import { useMemo } from 'react';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import { EmptyState } from '@/components/ui/empty-state';
import { GanttTimeline, buildRecordTimeline } from '@/components/timeline';
import type { SuperEngagementDetail } from '@/lib/super/super-overview';

/**
 * "Timeline" on the super admin client record (R-21; prototype `ClientRecordScreen`): the shared
 * Gantt, read-only. The super admin sees the plan; dates are set on the firm view of the record,
 * where the managers' "Edit" lives.
 */
export function SuperProjectTimeline({ detail }: { detail: SuperEngagementDetail }) {
  const today = new Date().toISOString().slice(0, 10);
  const input = detail.timeline;
  const timeline = useMemo(
    () =>
      buildRecordTimeline({
        state: input?.state,
        schedule: input?.schedule ?? null,
        expectedCoiOn: input?.expectedCoiOn ?? null,
        incorporationDate: input?.incorporationDate ?? null,
        today,
      }),
    [input, today],
  );

  return (
    <section className="surface min-w-0 overflow-hidden" aria-label="Timeline">
      <div className="flex min-h-[52px] min-w-0 items-center gap-2.5 border-b border-line-soft px-4 py-2">
        <CardHeadTile title="Timeline" />
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Timeline</h2>
      </div>
      {timeline.start ? (
        <GanttTimeline timeline={timeline} today={today} />
      ) : (
        <div className="p-4">
          <EmptyState title="No dates set yet" />
        </div>
      )}
    </section>
  );
}
