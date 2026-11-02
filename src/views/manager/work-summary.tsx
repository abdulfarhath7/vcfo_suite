'use client';

import { DashDonut, DashLegendRow, DashSection } from '@/components/dash/DashSection';
import { EmptyState } from '@/components/ui/empty-state';
import { AreaPill } from '@/components/ui/spectrum-chip';
import type { TodayStatus } from '@/components/staff/today/today-rows';
import { areaSplit, statusCounts } from '@/views/manager/team-work';

type Counted = { status: TodayStatus; area: string };

/**
 * "Name · status" (prototype `statusSegments` donut): the items by status word, with the
 * total in the middle and a legend. The head link opens the matching Work list.
 */
export function WorkStatusCard({
  title,
  items,
  href,
  hrefLabel = 'Open Work',
  loading,
}: {
  title: string;
  items: Counted[];
  href?: string;
  hrefLabel?: string;
  loading?: boolean;
}) {
  const counts = statusCounts(items);
  return (
    <DashSection title={title} href={href} hrefLabel={hrefLabel} loading={loading}>
      {items.length === 0 ? (
        <EmptyState title="No work items" />
      ) : (
        <div className="flex min-w-0 items-center gap-6">
          <DashDonut
            size={96}
            segments={counts.map((c) => ({ n: c.n, color: c.stroke }))}
            centerLabel={items.length}
            centerCaption="items"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {counts.map((c) => (
              <DashLegendRow key={c.status} swatchClassName={c.bar} label={c.status} count={c.n} />
            ))}
          </div>
        </div>
      )}
    </DashSection>
  );
}

/** "By area": one row per area with done, pending and overdue parts and "done / total". */
export function WorkAreaCard({ items, title = 'By area', loading }: { items: Counted[]; title?: string; loading?: boolean }) {
  const rows = areaSplit(items);
  const legend = (
    <span className="hidden items-center gap-3 text-[12px] text-ink-muted sm:flex">
      {[
        ['bg-positive-mid', 'Done'],
        ['bg-warning-mid', 'Pending'],
        ['bg-danger-mid', 'Overdue'],
      ].map(([cls, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <i className={`h-[7px] w-[7px] rounded-[2px] ${cls}`} aria-hidden />
          {label}
        </span>
      ))}
    </span>
  );
  return (
    <DashSection title={title} right={legend} loading={loading}>
      {rows.length === 0 ? (
        <EmptyState title="No work items" />
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const w = (n: number) => `${(n / r.total) * 100}%`;
            return (
              <li
                key={r.area}
                className="grid grid-cols-[112px_minmax(0,1fr)_44px] items-center gap-3 text-[13px]"
                title={`${r.area}: ${r.done} done, ${r.pending} pending, ${r.late} overdue`}
              >
                <AreaPill area={r.area} />
                <span className="flex h-2.5 gap-0.5 overflow-hidden rounded-bar bg-line-soft" aria-hidden>
                  {r.done > 0 ? <i className="block rounded-[2px] bg-positive-mid" style={{ width: w(r.done) }} /> : null}
                  {r.pending > 0 ? <i className="block rounded-[2px] bg-warning-mid" style={{ width: w(r.pending) }} /> : null}
                  {r.late > 0 ? <i className="block rounded-[2px] bg-danger-mid" style={{ width: w(r.late) }} /> : null}
                </span>
                <span className="text-right text-[12.5px] text-ink-muted tabular-nums">
                  {r.done}/{r.total}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </DashSection>
  );
}
