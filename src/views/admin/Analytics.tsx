"use client";

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { BarChart3, Briefcase, CheckCircle2, Clock, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { AccentKpi } from '@/components/admin/AccentKpi';
import { SEO } from '@/components/SEO';
import { checklist } from '@/data/checklist';

const AnalyticsCompletionChart = dynamic(
  () => import('@/views/admin/AnalyticsCharts').then((m) => m.AnalyticsCompletionChart),
  { ssr: false, loading: () => <div className="h-full animate-pulse rounded-md bg-muted/40" /> },
);
const AnalyticsDelayChart = dynamic(
  () => import('@/views/admin/AnalyticsCharts').then((m) => m.AnalyticsDelayChart),
  { ssr: false, loading: () => <div className="h-full animate-pulse rounded-md bg-muted/40" /> },
);

const data6 = [
  { m: 'Oct 25', completion: 88, target: 95, delay: 3.2, benchmark: 2.0 },
  { m: 'Nov 25', completion: 91, target: 95, delay: 2.8, benchmark: 2.0 },
  { m: 'Dec 25', completion: 87, target: 95, delay: 3.6, benchmark: 2.0 },
  { m: 'Jan 26', completion: 93, target: 95, delay: 2.0, benchmark: 2.0 },
  { m: 'Feb 26', completion: 94, target: 95, delay: 1.7, benchmark: 2.0 },
  { m: 'Mar 26', completion: 96, target: 95, delay: 1.5, benchmark: 2.0 },
];

const data12 = [
  { m: 'Apr 25', completion: 82, target: 95, delay: 4.4, benchmark: 2.0 },
  { m: 'May 25', completion: 84, target: 95, delay: 4.0, benchmark: 2.0 },
  { m: 'Jun 25', completion: 86, target: 95, delay: 3.6, benchmark: 2.0 },
  { m: 'Jul 25', completion: 85, target: 95, delay: 3.8, benchmark: 2.0 },
  { m: 'Aug 25', completion: 87, target: 95, delay: 3.4, benchmark: 2.0 },
  { m: 'Sep 25', completion: 89, target: 95, delay: 3.1, benchmark: 2.0 },
  ...data6,
];

function SampleBadge() {
  return (
    <span className="rounded-full bg-warning-light px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning-text">
      Sample data
    </span>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState<'6' | '12'>('6');
  const data = period === '6' ? data6 : data12;
  const { engagements, getStateForEngagement } = useApp();

  /** Live portfolio KPIs computed from real engagement state. */
  const live = useMemo(() => {
    let projects = 0;
    let stepsDone = 0;
    let stepsTotal = 0;
    let awaitingClient = 0;
    let overdue = 0;
    for (const eng of engagements) {
      projects += 1;
      const state = getStateForEngagement(eng);
      for (const item of checklist) {
        const s = state[item.id]?.status ?? 'not-started';
        if (s === 'not-applicable') continue;
        stepsTotal += 1;
        if (s === 'completed') stepsDone += 1;
        if (s === 'awaiting-client') awaitingClient += 1;
        if (s === 'overdue') overdue += 1;
      }
    }
    const pct = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0;
    return { projects, pct, awaitingClient, overdue };
  }, [engagements, getStateForEngagement]);

  return (
    <PageTransition>
      <SEO title="Analytics — VCFO Suite" description="Portfolio performance charts." path="/app/manager/analytics" />

      <PageHeader
        accent="sky"
        icon={BarChart3}
        title="Analytics"
        actions={
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '6' | '12')}
            className="h-9 px-3 rounded-md border border-border bg-surface text-[12.5px] text-ink"
          >
            <option value="6">Last 6 Months</option>
            <option value="12">Last 12 Months</option>
          </select>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AccentKpi label="Projects" value={live.projects} tone="primary" icon={Briefcase} />
        <AccentKpi
          label="Steps completed"
          value={`${live.pct}%`}
          tone="success"
          icon={CheckCircle2}
        />
        <AccentKpi
          label="Waiting on client"
          value={live.awaitingClient}
          tone="warning"
          icon={Users}
        />
        <AccentKpi
          label="Overdue steps"
          value={live.overdue}
          tone={live.overdue > 0 ? 'warning' : 'success'}
          icon={Clock}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="surface p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-ink">Compliance completion rate</div>
            <SampleBadge />
          </div>
          <div className="text-[11.5px] text-text-tertiary mt-0.5 mb-3">Monthly actuals vs 95% target</div>
          <div className="h-[260px]">
            <AnalyticsCompletionChart data={data} />
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-ink">Average filing delay</div>
            <SampleBadge />
          </div>
          <div className="text-[11.5px] text-text-tertiary mt-0.5 mb-3">Days past statutory due date (benchmark 2d)</div>
          <div className="h-[260px]">
            <AnalyticsDelayChart data={data} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
