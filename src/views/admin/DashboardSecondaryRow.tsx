'use client';

import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { Eyebrow } from '@/components/noir/Eyebrow';
import { NoirCard, Mono } from '@/components/noir';
import { toneForKey, TONE_BADGE } from '@/components/common/IconChip';
import { ArrowUpRight } from 'lucide-react';
import type { AdminDashboardViewProps } from '@/views/admin/DashboardSections';

export function AdminDashboardFilingsPanel({
  engagements,
  dueSoon,
}: Pick<AdminDashboardViewProps, 'engagements' | 'dueSoon'>) {
  const router = useRouter();

  return (
    <NoirCard flat className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <Eyebrow>Upcoming filings</Eyebrow>
        <button
          type="button"
          onClick={() => router.push('/app/manager/compliance')}
          className="inline-flex items-center gap-1 text-[11.5px] text-brand hover:text-brand-deep"
        >
          Compliance calendar
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
      <div className="p-2">
        {dueSoon.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-text-tertiary">
            No filings due in the next 14 days.
          </p>
        ) : (
          dueSoon.slice(0, 8).map((c, i) => {
            const eng = engagements.find((e) => e.id === c.engagementId);
            return (
              <m.button
                type="button"
                key={c.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * i }}
                onClick={() => router.push('/app/manager/compliance')}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    c.status === 'overdue'
                      ? 'bg-danger'
                      : c.status === 'in-progress'
                        ? 'bg-warning'
                        : 'bg-gold'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-[12.5px] text-ink">
                    <span className="truncate">{c.filing}</span>
                    <span
                      className={`inline-flex shrink-0 rounded px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide ${TONE_BADGE[toneForKey(c.authority)]}`}
                    >
                      {c.authority}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-text-tertiary">{eng?.companyName}</div>
                </div>
                <Mono className="shrink-0 tabular-nums text-[10.5px]">
                  {new Date(c.nextDue).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </Mono>
              </m.button>
            );
          })
        )}
      </div>
    </NoirCard>
  );
}
