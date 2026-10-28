'use client';

import Link from 'next/link';
import { DashSection } from '@/components/dash/DashSection';
import { OwnerChip } from '@/components/ui/spectrum-chip';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { CompanyTile } from '@/components/staff/today/today-parts';
import { internWaitingItems, type InternWorkItem } from '@/lib/intern/intern-work';

/* The rail's Waiting on card (prototype WaitingOnClient, K-31): what the client or the manager
   still owes. Each row has the company tile, the item, the company and how long it has waited,
   the owner chip (R-14) and the reminder or nudge action. */
export function LeadSideRail({ items }: { items: InternWorkItem[] }) {
  const all = internWaitingItems(items);
  const waiting = all.slice(0, 5);

  return (
    <div className="flex flex-col gap-5" data-intern-waiting-on>
      <DashSection title="Waiting on" meta={all.length ? String(all.length) : undefined} bodyClassName="p-0">
        {waiting.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-ink-muted">Nobody is blocking you.</p>
        ) : (
          <ul>
            {waiting.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-3 first:border-t-0">
                <CompanyTile name={item.companyName} />
                <span className="min-w-0 flex-1">
                  <Link href={item.href} className="block truncate font-medium text-ink hover:underline" title={item.title}>
                    {item.title}
                  </Link>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {[item.companyName, item.ageLabel ? `${item.ageLabel} waiting` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <OwnerChip owner={item.kind === 'waiting-manager' ? 'manager' : 'client'} />
                  <InternWorkCtaButton item={item} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashSection>
    </div>
  );
}
