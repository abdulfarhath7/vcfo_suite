'use client';

import { useCallback, useMemo, useState } from 'react';
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
import {
  formatIstWeekdayDay,
  internActionQueueByCompany,
  internWorkItemsForDay,
  ymdInIst,
} from '@/lib/intern-work';
import { cn } from '@/lib/utils';
import { useClientLocaleNow } from '@/hooks/use-client-locale-date';

export default function InternToday() {
  const { user, getStateForEngagement } = useApp();
  const { myEngagements, workItems, kpis, filings } = useInternPortfolio();
  const nowLabel = useClientLocaleNow();
  const now = useMemo(() => new Date(), []);
  const todayYmd = ymdInIst(now);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const dayItems = selectedDay ? internWorkItemsForDay(workItems, selectedDay, todayYmd) : null;
  const queueSource = dayItems ?? workItems;
  const queueGroups = internActionQueueByCompany(queueSource, now);
  const queueLeads = queueGroups.length >= Math.max(myEngagements.length, 1) && queueGroups.length > 0;

  const selectDay = useCallback((ymd: string) => {
    setSelectedDay((prev) => (prev === ymd ? null : ymd));
    window.requestAnimationFrame(() => {
      document.getElementById('intern-week-related')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  return (
    <PageTransition>
      <SEO
        title="Today — VCFO Suite"
        description="What needs you, what’s waiting, and what’s due this week."
        path="/app/intern/today"
      />

      <div className="flex flex-col gap-3">
        <LeadHero
          name={user?.name ?? ''}
          clockLabel={nowLabel}
          kpis={kpis}
        />

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="flex min-w-0 flex-col gap-3">
            <LeadWeekStrip
              items={workItems}
              now={now}
              selectedYmd={selectedDay}
              onSelectDay={selectDay}
            />
            {selectedDay ? (
              <p className="px-0.5 text-[12px] font-semibold text-muted-foreground">
                Showing {formatIstWeekdayDay(selectedDay).label}
                {selectedDay === todayYmd ? ' (today)' : ''}
                {' · '}
                {dayItems?.length ?? 0} item{(dayItems?.length ?? 0) === 1 ? '' : 's'}
                {' · '}
                <button
                  type="button"
                  className="font-extrabold text-primary hover:underline"
                  onClick={() => setSelectedDay(null)}
                >
                  Show all
                </button>
              </p>
            ) : null}
            <div
              id="intern-week-related"
              className={cn(
                'grid grid-cols-1 items-start gap-3',
                queueLeads
                  ? 'lg:grid-cols-[minmax(0,1.28fr)_minmax(17rem,0.82fr)]'
                  : 'lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,1fr)]',
              )}
            >
              <LeadActionQueue userId={user?.id ?? ''} items={queueSource} now={now} />
              <div className="flex min-w-0 flex-col gap-3">
                <LeadFocusCard userId={user?.id ?? ''} items={workItems} />
                <LeadPhaseProgress engagements={myEngagements} getState={getStateForEngagement} />
              </div>
            </div>
          </div>
          <LeadSideRail
            items={queueSource}
            filings={filings}
            now={now}
          />
        </div>
      </div>
    </PageTransition>
  );
}
