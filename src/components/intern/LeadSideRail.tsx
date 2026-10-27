'use client';

import { CardHeadTile } from '@/components/common/CardHeadTile';
import { InternWorkDenseRow } from '@/components/intern/InternWorkRow';
import { internWaitingItems, type InternWorkItem } from '@/lib/intern/intern-work';

/* The Inbox rail's Waiting on card (K-31). The Compliance health donut left Today: its
   numbers are in the practice strip and the Overdue filings card. */
export function LeadSideRail({ items }: { items: InternWorkItem[] }) {
  const waiting = internWaitingItems(items).slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      <section className="surface overflow-hidden" data-intern-waiting-on>
        <div className="flex min-h-[52px] min-w-0 items-center gap-2.5 border-b border-line-soft px-4 py-2">
          <CardHeadTile title="Waiting on" />
          <h2 className="min-w-0 truncate text-[14.5px] font-semibold text-ink">Waiting on</h2>
        </div>
        <div className="px-4 pb-3 pt-3">
          {waiting.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">Nobody is blocking you.</p>
          ) : (
            waiting.map((item) => (
              <div key={item.id} className="border-t border-line py-2.5 first:border-0 first:pt-0">
                <InternWorkDenseRow item={item} showCompany />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
