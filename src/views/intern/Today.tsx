'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useInternPortfolio } from '@/hooks/use-intern-portfolio';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { LeadHero } from '@/components/intern/LeadHero';
import { LeadFocusCard } from '@/components/intern/LeadFocusCard';
import { LeadActionQueue } from '@/components/intern/LeadActionQueue';
import { LeadPhaseProgress } from '@/components/intern/LeadPhaseProgress';
import { LeadPracticeStrip } from '@/components/intern/LeadPracticeStrip';
import { LeadOverdueFilings } from '@/components/intern/LeadOverdueFilings';
import { LeadSideRail } from '@/components/intern/LeadSideRail';

/**
 * The lead's Today (K-31, audit rows 108, 111, 112 and 127): five blocks. The greeting, the
 * practice strip, the Action queue with the Inbox rail (Todos and Waiting on), Phase progress
 * and the overdue filings. This week, Compliance health and My managers left the page: their
 * numbers repeat other cards.
 */
export default function InternToday() {
  const { user, getStateForEngagement } = useApp();
  const { myEngagements, workItems, kpis, filings } = useInternPortfolio();
  const now = useMemo(() => new Date(), []);

  return (
    <PageTransition>
      <SEO
        title="Today — VCFO Suite"
        description="What needs you, what’s waiting, and what’s due this week."
        path="/app/intern/today"
      />

      <div className="flex flex-col gap-3">
        <LeadHero name={user?.name ?? ''} kpis={kpis} />
        <LeadPracticeStrip engagements={myEngagements} getState={getStateForEngagement} filings={filings} now={now} />

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="flex min-w-0 flex-col gap-3">
            <LeadActionQueue userId={user?.id ?? ''} items={workItems} now={now} />
            <LeadPhaseProgress engagements={myEngagements} getState={getStateForEngagement} />
            <LeadOverdueFilings filings={filings} engagements={myEngagements} now={now} />
          </div>
          <div className="flex min-w-0 flex-col gap-3" aria-label="Inbox">
            <LeadFocusCard userId={user?.id ?? ''} items={workItems} />
            <LeadSideRail items={workItems} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
