'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useInternPortfolio } from '@/hooks/use-intern-portfolio';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { LeadHero } from '@/components/intern/LeadHero';
import { LeadFocusCard } from '@/components/intern/LeadFocusCard';
import { LeadActionQueue } from '@/components/intern/LeadActionQueue';
import { LeadPhaseProgress } from '@/components/intern/LeadPhaseProgress';
import { LeadOverdueFilings } from '@/components/intern/LeadOverdueFilings';
import { LeadSideRail } from '@/components/intern/LeadSideRail';
import { LeadManagersCard } from '@/components/intern/LeadManagersCard';
import { TodayScopeTabs } from '@/components/staff/today/today-parts';
import { engagementInScope, todayStatusOf, type TodayScope } from '@/components/staff/today/today-rows';
import { internWorkKpis, type InternWorkItem } from '@/lib/intern/intern-work';

/** Main column and a rail, as on every staff Today (prototype TodayScreen GRID). */
const GRID = 'grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2.4fr)_minmax(300px,1fr)]';

/**
 * The lead's Today (prototype TodayScreen, C-0103): the home card with the scope switch and
 * five numbers, then the Action queue, Phase progress and the overdue filings beside the rail
 * (Todos, Waiting on, My managers). The practice strip left the page; its numbers are in the
 * home card and the cards below. The scope switch narrows every card to the incorporating
 * companies or the incorporated ones.
 */
export default function InternToday() {
  const { user, getStateForEngagement } = useApp();
  const { myEngagements, workItems, filings } = useInternPortfolio();
  const now = useMemo(() => new Date(), []);
  const [scope, setScope] = useState<TodayScope>('all');

  const scopeCounts = useMemo(() => {
    const incorporating = myEngagements.filter((e) => engagementInScope('incorporating', e, getStateForEngagement(e))).length;
    return { all: myEngagements.length, incorporating, compliance: myEngagements.length - incorporating };
  }, [myEngagements, getStateForEngagement]);
  const engagements = useMemo(
    () => myEngagements.filter((e) => engagementInScope(scope, e, getStateForEngagement(e))),
    [myEngagements, scope, getStateForEngagement],
  );
  const ids = useMemo(() => new Set(engagements.map((e) => e.id)), [engagements]);
  const items = useMemo(() => workItems.filter((i) => ids.has(i.engagementId)), [workItems, ids]);
  const scopedFilings = useMemo(() => filings.filter((f) => ids.has(f.engagementId)), [filings, ids]);
  const kpis = useMemo(() => internWorkKpis(items, now), [items, now]);

  const byId = useMemo(() => new Map(myEngagements.map((e) => [e.id, e])), [myEngagements]);
  const statusOf = (item: InternWorkItem) => {
    const eng = byId.get(item.engagementId);
    const slice = eng && item.catalogId ? getStateForEngagement(eng)[item.catalogId] : undefined;
    return todayStatusOf(item, slice, now);
  };

  return (
    <PageTransition>
      <SEO
        title="Today — VCFO Suite"
        description="What needs you, what’s waiting, and what’s due this week."
        path="/app/intern/today"
      />

      <div className="flex flex-col gap-5">
        <LeadHero name={user?.name ?? ''} kpis={kpis}>
          <TodayScopeTabs value={scope} onChange={setScope} counts={scopeCounts} />
        </LeadHero>

        <div className={GRID}>
          <div className="flex min-w-0 flex-col gap-5">
            <LeadActionQueue userId={user?.id ?? ''} items={items} now={now} statusOf={statusOf} />
            <LeadPhaseProgress engagements={engagements} getState={getStateForEngagement} />
            {scope !== 'incorporating' ? (
              <LeadOverdueFilings filings={scopedFilings} engagements={engagements} now={now} />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-5" aria-label="Inbox">
            <LeadFocusCard userId={user?.id ?? ''} items={workItems} />
            <LeadSideRail items={items} />
            <LeadManagersCard engagements={myEngagements} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
