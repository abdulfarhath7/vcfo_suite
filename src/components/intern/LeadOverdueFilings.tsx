'use client';

import Link from 'next/link';
import { DashSection } from '@/components/dash/DashSection';
import { CHIP_CLASS, CHIP_COLUMN_CLASS, TONE_SOLID } from '@/components/common/IconChip';
import type { ComplianceFiling } from '@/data/compliance';
import type { Engagement } from '@/data/engagements';
import { sep } from '@/lib/date-format';
import { ymdFromIsoInIst } from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Overdue and due-soon filings on the lead's Today (K-31, audit row 127): only clients with a
 * filing that is late or due soon appear. Each row has a 44px date tile tinted by urgency, the
 * filing and the company, and a state chip on the right (rule R-20).
 */
/** Overdue, or open and due within the next 15 days. Shared with the practice strip. */
export function isOverdueOrDueSoon(f: ComplianceFiling, now: Date): boolean {
  if (f.status === 'overdue') return true;
  if (f.status !== 'upcoming' && f.status !== 'in-progress') return false;
  const due = Date.parse(f.nextDue);
  return Number.isFinite(due) && due - now.getTime() <= 15 * 86_400_000;
}

export function LeadOverdueFilings({ filings, engagements, now }: { filings: ComplianceFiling[]; engagements: Engagement[]; now: Date }) {
  const byId = new Map(engagements.map((e) => [e.id, e]));
  const rows = filings
    .filter((f) => isOverdueOrDueSoon(f, now))
    .sort((a, b) => (a.status === 'overdue' ? 0 : 1) - (b.status === 'overdue' ? 0 : 1) || a.nextDue.localeCompare(b.nextDue))
    .slice(0, 8);
  return (
    <DashSection title="Overdue filings" meta={rows.length ? `${rows.length}` : undefined} href="/app/intern/compliances/filings" hrefLabel="Filings" bodyClassName="px-0 py-0">
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-ink-muted">No filing is overdue or due soon.</p>
      ) : (
        rows.map((f, i) => {
          const ymd = ymdFromIsoInIst(f.nextDue) ?? f.nextDue.slice(0, 10);
          const late = f.status === 'overdue';
          const company = byId.get(f.engagementId)?.companyName ?? '';
          return (
            <Link
              key={f.id}
              href="/app/intern/compliances/calendar"
              className={cn('flex min-w-0 items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken', i > 0 && 'border-t border-line-soft')}
            >
              <span
                className={cn(
                  'grid h-12 w-11 shrink-0 place-items-center content-center rounded-md',
                  late ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning',
                )}
              >
                <span className="text-[17px] font-semibold leading-none tabular-nums">{ymd.slice(8, 10)}</span>
                <span className="text-[11px] font-semibold">{sep(MON[Number(ymd.slice(5, 7)) - 1] ?? '')}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  {f.periodLabel && !f.periodLabel.startsWith(f.filing) ? `${f.filing} · ${f.periodLabel}` : (f.periodLabel ?? f.filing)}
                </span>
                <span className="block truncate text-[12px] text-ink-muted">
                  {company} · {f.authority}
                </span>
              </span>
              <span className={cn(CHIP_CLASS, CHIP_COLUMN_CLASS, late ? TONE_SOLID.overdue : TONE_SOLID.waiting)}>
                {late ? 'Overdue' : 'Due soon'}
              </span>
            </Link>
          );
        })
      )}
    </DashSection>
  );
}
