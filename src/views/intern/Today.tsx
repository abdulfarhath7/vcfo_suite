'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useInternPortfolio } from '@/lib/use-intern-portfolio';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { LeadHero } from '@/components/intern/LeadHero';
import { LeadFocusCard } from '@/components/intern/LeadFocusCard';
import { LeadWeekStrip } from '@/components/intern/LeadWeekStrip';
import { LeadActionQueue } from '@/components/intern/LeadActionQueue';
import { LeadPhaseProgress } from '@/components/intern/LeadPhaseProgress';
import { LeadSideRail } from '@/components/intern/LeadSideRail';
import { internActionQueueByCompany } from '@/lib/intern-work';
import { cn } from '@/lib/utils';
import { useClientLocaleNow } from '@/hooks/use-client-locale-date';

export default function InternToday() {
  const { user, getStateForEngagement } = useApp();
  const { myEngagements, workItems, kpis, filings } = useInternPortfolio();
  const nowLabel = useClientLocaleNow();
  const now = useMemo(() => new Date(), []);
  const queueGroups = internActionQueueByCompany(workItems, now);
  const queueLeads = queueGroups.length >= Math.max(myEngagements.length, 1) && queueGroups.length > 0;

  return (
    <PageTransition>
      <SEO
        title="Today — VCFO Suite"
        description="What needs you, what’s waiting, and what’s due this week."
        path="/app/intern/today"
      />

      <div className="flex flex-col gap-4">
        <LeadHero
          name={user?.name ?? ''}
          clockLabel={nowLabel}
          kpis={kpis}
        />

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="flex min-w-0 flex-col gap-4">
            <LeadWeekStrip items={workItems} now={now} />
            <div
              className={cn(
                'grid grid-cols-1 items-start gap-4',
                queueLeads
                  ? 'lg:grid-cols-[minmax(0,1.28fr)_minmax(17rem,0.82fr)]'
                  : 'lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,1fr)]',
              )}
            >
              <LeadActionQueue userId={user?.id ?? ''} items={workItems} now={now} />
              <div className="flex min-w-0 flex-col gap-4">
                <LeadFocusCard userId={user?.id ?? ''} items={workItems} />
                <LeadPhaseProgress engagements={myEngagements} getState={getStateForEngagement} />
              </div>
            </div>
          </div>
          <LeadSideRail
            items={workItems}
            filings={filings}
            now={now}
          />
        </div>
      </div>
    </PageTransition>
  );
}
