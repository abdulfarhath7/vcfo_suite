'use client';

import { useMemo, useState } from 'react';
import { ListPlus, UserPlus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashHero } from '@/components/dash/DashHero';
import { Button } from '@/components/ui/button';
import { AssignClientDialog } from '@/components/super/assign/AssignClientDialog';
import { AssignTaskDialog } from '@/components/super/assign/AssignTaskDialog';
import { useSuperStaff } from '@/components/super/assign/use-super-staff';
import { SuperAdminsPanel } from '@/components/super/overview/SuperAdminsPanel';
import { EscalationsPanel } from '@/components/super/escalations/EscalationsPanel';
import { SuperPageError } from '@/components/super/parts/super-parts';
import {
  SuperPhasePanel,
  SuperStagePanel,
} from '@/components/super/overview/SuperPortfolioCharts';
import { SuperAttentionPanel } from '@/components/super/overview/SuperAttentionPanel';
import { SuperWorkloadPanel } from '@/components/super/overview/SuperWorkloadPanel';
import { SuperSideRail } from '@/components/super/overview/SuperSideRail';
import { SuperOverviewSkeleton } from '@/components/super/overview/SuperOverviewSkeleton';
import {
  SuperManagersPanel,
  SuperPracticeCards,
  SuperTopRisks,
} from '@/components/super/overview/SuperPracticeCards';
import { filingOutcome } from '@/components/super/insights/super-insights-model';
import { useSuperOverview } from '@/hooks/use-super-overview';
import { useSuperInsights } from '@/views/super/use-super-insights';
import { SUPER_ATTENTION_HREF, SUPER_PROJECTS_HREF } from '@/lib/super/super-overview';
import { internFirstName, internGreeting, internGreetingHour } from '@/lib/intern/intern-work';

/**
 * SUPER ADMIN OVERVIEW (L0) — the observatory.
 *
 * Answers "is the firm healthy, and what needs me?" in five seconds, and every
 * element drills to the detail behind it. The reads stay read-only; the writes
 * are the super admin's own actions (G-20): Assign client and Assign task on the
 * home card, and Resolve on an escalation. The admins table and the escalations
 * come from the People roster, the reporting lines and `/api/super/escalations`. The home card, attention list, charts and rail come from
 * `/api/super/overview`; the practice cards, managers and top risks come from
 * `/api/super/insights`, which loads beside it and never blocks the page.
 *
 * Layout follows the prototype's Overview (C-0109): the home card with KP1
 * tiles, the three practice cards, then a main column and a 318px rail of
 * `DashSection` panels.
 */
export default function SuperOverview() {
  const { user } = useApp();
  const query = useSuperOverview();
  const overview = query.data;
  // The practice cards, managers and risks come from the insights read. It loads beside the
  // overview and never blocks it: until it lands those panels show grey shapes.
  const insightsQuery = useSuperInsights();
  const insights = insightsQuery.data;
  const staff = useSuperStaff();
  const [assignOpen, setAssignOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const greeting = useMemo(() => {
    const first = internFirstName(user?.name ?? '');
    const greet = internGreeting(internGreetingHour(new Date()));
    return first ? `Good ${greet}, ${first}` : 'Firm overview';
  }, [user?.name]);

  const seo = (
    <SEO
      title="Firm overview — VCFO Suite"
      description="Every engagement, every filing, every person — one live picture."
      path="/app/super/dashboard"
    />
  );

  if (query.isPending) {
    return (
      <PageTransition>
        {seo}
        <SuperOverviewSkeleton />
      </PageTransition>
    );
  }

  if (query.isError || !overview) {
    return (
      <PageTransition>
        {seo}
        <SuperPageError
          title="The firm overview could not load"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </PageTransition>
    );
  }

  const { kpis } = overview;
  const healthy = Math.max(0, kpis.engagements - kpis.needsAttention);

  // Filed on time over every filing due by today in the report window (on time, late or open).
  const filedOnTime = (() => {
    if (!insights) return null;
    const today = insights.generatedAt.slice(0, 10);
    const outcomes = insights.filings.filter((f) => f.dueDate <= today).map((f) => filingOutcome(f, today));
    if (outcomes.length === 0) return null;
    return Math.round((outcomes.filter((o) => o === 'on-time').length / outcomes.length) * 100);
  })();
  // Trend (R-18): filed on time over filed, month by month, from the insights' real months.
  const onTimeTrend = (insights?.months ?? [])
    .filter((m) => m.filedOnTime + m.filedLate > 0)
    .map((m) => Math.round((m.filedOnTime / (m.filedOnTime + m.filedLate)) * 100));
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <PageTransition>
      {seo}

      <div className="flex flex-col gap-3">
        <DashHero
          title={greeting}
          stats={[
            {
              label: 'Clients',
              value: kpis.engagements,
              href: SUPER_PROJECTS_HREF,
              note: `${healthy} on track`,
              bar: kpis.engagements > 0 ? Math.round((healthy / kpis.engagements) * 100) : undefined,
              how: 'Every engagement in the firm; the bar is the share on track.',
            },
            {
              label: 'Need attention',
              value: kpis.needsAttention,
              href: SUPER_ATTENTION_HREF,
              hot: kpis.needsAttention > 0,
              note: kpis.awaitingClient > 0 ? `${kpis.awaitingClient} on clients` : undefined,
              how: 'Engagements that are overdue, stuck, or waiting on someone past the usual time.',
            },
            {
              label: 'Awaiting review',
              value: kpis.approvalsPending,
              href: '/app/admin/approvals',
              how: 'Steps waiting for a manager or admin decision.',
            },
            {
              label: 'Filings due',
              value: kpis.overdueFilings + kpis.filingsDueSoon,
              note: kpis.overdueFilings > 0 ? `${kpis.overdueFilings} overdue` : kpis.filingsDueSoon > 0 ? plural(kpis.filingsDueSoon, 'due soon', 'due soon') : undefined,
              href: '/app/admin/compliances/calendar',
              hot: kpis.overdueFilings > 0,
              how: 'Filings past their due date plus filings due soon, across every client.',
            },
            {
              label: 'Filed on time',
              value: filedOnTime !== null ? `${filedOnTime}%` : '–',
              href: '/app/super/reports',
              good: filedOnTime !== null,
              note: insights ? `${insights.months.length} months` : undefined,
              trend: onTimeTrend.length > 1 ? onTimeTrend : undefined,
              trendTone: 'ok',
              how: 'Filings filed by their due date, over every filing due by today in the report window.',
            },
          ]}
        >
          <Button onClick={() => setAssignOpen(true)}>
            <UserPlus aria-hidden />
            Assign client
          </Button>
          <Button variant="outline" onClick={() => setTaskOpen(true)}>
            <ListPlus aria-hidden />
            Assign task
          </Button>
        </DashHero>

        {insights ? <SuperPracticeCards insights={insights} /> : <InsightShapes count={3} />}

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="flex min-w-0 flex-col gap-3">
            <SuperAttentionPanel overview={overview} />
            <SuperAdminsPanel staff={staff} engagements={overview.engagements} />
            {insights ? <SuperManagersPanel insights={insights} /> : <InsightShapes count={1} />}
            <SuperWorkloadPanel overview={overview} />
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              <SuperStagePanel overview={overview} />
              <SuperPhasePanel overview={overview} />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <EscalationsPanel canResolve limit={6} />
            {insights ? <SuperTopRisks insights={insights} /> : <InsightShapes count={1} />}
            <SuperSideRail overview={overview} />
          </div>
        </div>
      </div>

      <AssignClientDialog open={assignOpen} onOpenChange={setAssignOpen} engagements={overview.engagements} staff={staff} />
      <AssignTaskDialog open={taskOpen} onOpenChange={setTaskOpen} engagements={overview.engagements} staff={staff} />
    </PageTransition>
  );
}

/** Grey shapes while the insights read lands (R-48). */
function InsightShapes({ count }: { count: number }) {
  return (
    <div className={count > 1 ? 'grid grid-cols-1 gap-3 lg:grid-cols-3' : undefined} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="block h-[220px] animate-pulse rounded-md bg-surface-sunken" />
      ))}
    </div>
  );
}
