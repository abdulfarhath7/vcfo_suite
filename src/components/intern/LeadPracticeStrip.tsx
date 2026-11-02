'use client';

import Link from 'next/link';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import type { ComplianceFiling } from '@/data/compliance';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { internCompanyPhaseProgress } from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';
import { isOverdueOrDueSoon } from '@/components/intern/LeadOverdueFilings';

/**
 * The practice strip on the lead's Today (K-31, audit row 127): three numbers, one per
 * practice. Incorporation counts companies whose SPICe+ parts are not done yet,
 * Registrations counts incorporated companies with registration steps open, and
 * Compliances counts filings that are overdue or due soon. Each number opens its list.
 */
export function LeadPracticeStrip({
  engagements,
  getState,
  filings,
  now,
}: {
  engagements: Engagement[];
  getState: (engagement: Engagement) => Record<string, ChecklistItemStateSlice>;
  filings: ComplianceFiling[];
  now: Date;
}) {
  const rows = engagements.map((eng) => internCompanyPhaseProgress(eng, getState(eng)));
  const incorporating = rows.filter((r) => r.phases.slice(0, 2).some((p) => p.pct < 100)).length;
  const registering = rows.filter(
    (r) => r.phases.slice(0, 2).every((p) => p.pct >= 100) && (r.phases[3]?.pct ?? 100) < 100,
  ).length;
  const filingsOpen = filings.filter((f) => isOverdueOrDueSoon(f, now)).length;
  const cells = [
    { label: 'Incorporation', value: incorporating, unit: incorporating === 1 ? 'company' : 'companies', href: '/app/intern/clients' },
    { label: 'Registrations', value: registering, unit: registering === 1 ? 'company' : 'companies', href: '/app/intern/clients' },
    { label: 'Compliances', value: filingsOpen, unit: filingsOpen === 1 ? 'filing due' : 'filings due', href: '/app/intern/compliances/calendar' },
  ];
  return (
    <section className="surface grid min-w-0 grid-cols-1 overflow-hidden sm:grid-cols-3" aria-label="Practice">
      {cells.map((c, i) => (
        <Link
          key={c.label}
          href={c.href}
          className={cn(
            'flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-sunken',
            i > 0 && 'border-t border-line-soft sm:border-l sm:border-t-0',
          )}
        >
          <CardHeadTile title={c.label} size={30} />
          <span className="flex min-w-0 flex-col">
            <span className="text-[12px] text-ink-muted">{c.label}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[20px] font-semibold leading-6 tabular-nums text-ink">{c.value}</span>
              <span className="truncate text-[12px] text-ink-muted">{c.unit}</span>
            </span>
          </span>
        </Link>
      ))}
    </section>
  );
}
