'use client';

import Link from 'next/link';
import { m, useReducedMotion } from 'framer-motion';
import { Mono } from '@/components/noir';
import { ClientCard, clientCardActionClass } from '@/components/client/overview/ClientCard';
import {
  COMPLIANCE_GROUP_ORDER,
  type ClientOverviewComplianceItem,
  type ComplianceGroup,
} from '@/lib/client-overview';
import {
  formatClientDate,
  relativeDayLabel,
} from '@/components/client/overview/client-overview-format';
import { ease } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Module 7 — the next 90 days of filings, grouped by authority.
 *
 * Reads Inngest-generated `compliance_instances` only. Pre-COI there are none,
 * and the card says so honestly instead of inventing a series.
 */
export function ClientComplianceRunway({
  upcoming,
  incorporated,
  title = 'Taxes',
}: {
  upcoming: ClientOverviewComplianceItem[];
  incorporated: boolean;
  title?: string;
}) {
  const reduceMotion = useReducedMotion();
  const groups = groupByAuthority(upcoming);
  const maxCount = groups.reduce((max, group) => Math.max(max, group.items.length), 0);

  return (
    <ClientCard
      title={title}
      action={
        <Link
          href="/app/client/compliances"
          className={clientCardActionClass}
        >
          All filings
        </Link>
      }
    >
      {upcoming.length === 0 ? (
        <TaxBoard incorporated={incorporated} />
      ) : (
        <>
          <ul className="space-y-2.5" aria-label="Filings by authority">
            {groups.map((group, index) => (
              <m.li
                key={group.group}
                initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * index, duration: 0.26, ease }}
                className="flex items-center gap-3"
              >
                <span className="w-[5.5rem] shrink-0 truncate text-[13px] font-medium text-foreground">
                  {group.group}
                </span>
                <div className="client-bar-track h-2.5 flex-1">
                  <i
                    className="client-bar-fill"
                    style={{
                      width: `${maxCount === 0 ? 0 : (group.items.length / maxCount) * 100}%`,
                      background: GROUP_FILL[group.group],
                    }}
                  />
                </div>
                <span className="w-5 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
                  {group.items.length}
                </span>
              </m.li>
            ))}
          </ul>

          <div className="mt-3.5 border-t border-border pt-3">
            <p className="mb-2 text-[13px] text-muted-foreground">
              Coming up in the next 90 days
            </p>
            <ul className="space-y-2">
              {upcoming.slice(0, 5).map((item) => (
                /* Two lines, like the lead dashboard's dense rows: at rail width
                   a single line squeezes the filing name down to one letter. */
                <li key={item.id} className="flex min-w-0 gap-2">
                  <span
                    className="mt-[6px] h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: GROUP_FILL[item.group] }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-baseline gap-1.5">
                      <span className="min-w-0 truncate text-[13.5px] font-medium text-foreground">
                        {item.title}
                      </span>
                      {item.periodLabel && (
                        <span className="shrink-0 text-[12px] text-muted-foreground">
                          {item.periodLabel}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[12px] text-muted-foreground">
                      <span>{item.group}</span>
                      <span aria-hidden>·</span>
                      <Mono className="tabular-nums">{formatClientDate(item.dueDate)}</Mono>
                      <span
                        className={cn(
                          'ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          item.status === 'filed'
                            ? 'bg-success-light text-success-text'
                            : 'bg-raised text-muted-foreground',
                        )}
                      >
                        {relativeDayLabel(item.dueDate)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {upcoming.length > 5 && (
              <p className="mt-2 text-[13px] text-muted-foreground">
                +{upcoming.length - 5} more in the window
              </p>
            )}
          </div>
        </>
      )}
    </ClientCard>
  );
}

const TAX_HEADS = ['GST', 'Income tax', 'Payroll', 'MCA'] as const;

const TAX_DOT: Record<(typeof TAX_HEADS)[number], string> = {
  GST: 'oklch(0.72 0.13 200)',
  'Income tax': 'oklch(0.48 0.19 255)',
  Payroll: 'oklch(0.50 0.16 145)',
  MCA: 'oklch(0.45 0.18 295)',
};

function TaxBoard({ incorporated }: { incorporated: boolean }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-foreground">
        {incorporated ? 'Nothing due' : 'After incorporation'}
      </p>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {TAX_HEADS.map((head) => (
          <li key={head}>
            <Link
              href="/app/client/compliances"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground hover:underline"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: TAX_DOT[head] }}
                aria-hidden
              />
              {head}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function groupByAuthority(items: ClientOverviewComplianceItem[]) {
  const buckets = new Map<ComplianceGroup, ClientOverviewComplianceItem[]>();
  for (const item of items) {
    const list = buckets.get(item.group) ?? [];
    list.push(item);
    buckets.set(item.group, list);
  }
  return COMPLIANCE_GROUP_ORDER.filter((group) => buckets.has(group)).map((group) => ({
    group,
    items: buckets.get(group)!,
  }));
}

/** Analogous washes — the runway must not out-shout the primary blue. */
const GROUP_FILL: Record<ComplianceGroup, string> = {
  GST: 'oklch(var(--phase-filing))',
  'Income tax': 'oklch(var(--phase-pre))',
  Payroll: 'oklch(var(--phase-post))',
  MCA: 'oklch(var(--phase-registration))',
  FEMA: 'oklch(var(--phase-fema))',
  Other: 'oklch(var(--muted-foreground))',
};
