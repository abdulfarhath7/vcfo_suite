'use client';

import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { toneForKey, TONE_BADGE } from '@/components/common/IconChip';
import type { AdminDashboardViewProps } from '@/views/admin/DashboardSections';

/** Status dot color for a filing — overdue reads red, in-progress amber,
    everything else the calm primary. */
function filingDotClass(status: string): string {
  if (status === 'overdue') return 'bg-danger';
  if (status === 'in-progress') return 'bg-warning';
  return 'bg-primary';
}

export function AdminDashboardFilingsPanel({
  engagements,
  dueSoon,
}: Pick<AdminDashboardViewProps, 'engagements' | 'dueSoon'>) {
  const router = useRouter();

  return (
    <DashSection
      icon={CalendarDays}
      tone="cyan"
      title="Upcoming filings"
      href="/app/manager/compliance"
      hrefLabel="Calendar"
    >
      {dueSoon.length === 0 ? (
        <p className="py-3 text-center text-[12.5px] text-muted-foreground">
          No filings due in the next 14 days.
        </p>
      ) : (
        dueSoon.slice(0, 8).map((c, i) => {
          const eng = engagements.find((e) => e.id === c.engagementId);
          const due = new Date(c.nextDue);
          const day = due.toLocaleDateString('en-IN', { day: '2-digit' });
          const month = due.toLocaleDateString('en-IN', { month: 'short' });
          return (
            <m.button
              type="button"
              key={c.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.03 * i }}
              onClick={() => router.push('/app/manager/compliance')}
              className="group flex w-full min-w-0 items-center gap-2.5 border-t border-border py-2.5 text-left first:border-0 first:pt-0 last:pb-0"
            >
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised">
                <span className="flex flex-col items-center leading-none">
                  <span className="text-[13px] font-extrabold tabular-nums text-ink">{day}</span>
                  <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
                    {month}
                  </span>
                </span>
                <span
                  className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-panel ${filingDotClass(c.status)}`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-semibold text-ink transition-colors group-hover:text-primary">
                    {c.filing}
                  </span>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2 py-px text-[9.5px] font-extrabold uppercase tracking-wide ${TONE_BADGE[toneForKey(c.authority)]}`}
                  >
                    {c.authority}
                  </span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {eng?.companyName}
                </span>
              </span>
            </m.button>
          );
        })
      )}
    </DashSection>
  );
}
