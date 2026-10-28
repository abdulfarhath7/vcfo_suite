"use client";

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Clock, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { StatCard } from '@/components/dash/StatCard';
import { DashDonut, DashSection } from '@/components/dash/DashSection';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Tag } from '@/components/ui/spectrum-chip';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { CHART_STATUS, ChartLegend, DashBarChart, type ChartSeries } from '@/components/charts';
import { SEO } from '@/components/SEO';
import { checklist } from '@/data/checklist';
import { PlainPageHead } from '@/views/admin/PlainPageHead';
import {
  clientHealthCounts,
  stepsCompletedPerWeek,
  workloadByLead,
  type AnalyticsProject,
} from '@/views/admin/analytics/analytics-stats';

const chartLoading = () => <div className="h-full animate-pulse rounded-md bg-surface-sunken" />;

const AnalyticsCompletionChart = dynamic(
  () => import('@/views/admin/AnalyticsCharts').then((m) => m.AnalyticsCompletionChart),
  { ssr: false, loading: chartLoading },
);
const AnalyticsDelayChart = dynamic(
  () => import('@/views/admin/AnalyticsCharts').then((m) => m.AnalyticsDelayChart),
  { ssr: false, loading: chartLoading },
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

const ITEM_IDS = checklist.map((item) => item.id);

/* R-25: status colours only. Waiting is teal, overdue red, not started grey. */
const HEALTH_ROWS = [
  { key: 'progress', label: 'In progress', color: CHART_STATUS.active },
  { key: 'waiting', label: 'Waiting', color: CHART_STATUS.waiting },
  { key: 'overdue', label: 'Overdue', color: CHART_STATUS.overdue },
  { key: 'notStarted', label: 'Not started', color: CHART_STATUS.locked },
  { key: 'done', label: 'Done', color: CHART_STATUS.done },
] as const;

const WORKLOAD_SERIES: ChartSeries[] = [
  { key: 'overdue', label: 'Overdue', color: CHART_STATUS.overdue, stackId: 'load' },
  { key: 'waiting', label: 'Waiting', color: CHART_STATUS.waiting, stackId: 'load' },
  { key: 'progress', label: 'In progress', color: CHART_STATUS.active, stackId: 'load' },
  { key: 'notStarted', label: 'Not started', color: CHART_STATUS.locked, stackId: 'load' },
];

/** The two monthly charts still draw sample figures until filing history is stored. */
function SampleTag() {
  return (
    <Tag tone="warn" className="h-5 px-1.5">
      Sample data
    </Tag>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState<'6' | '12'>('6');
  const data = period === '6' ? data6 : data12;
  const { engagements, getStateForEngagement, internOptions, teamMembers, role, engagementsLoading } = useApp();

  const projects = useMemo<AnalyticsProject[]>(
    () => engagements.map((eng) => ({ internId: eng.internId, state: getStateForEngagement(eng) })),
    [engagements, getStateForEngagement],
  );

  /** Live portfolio KPIs computed from real engagement state. */
  const live = useMemo(() => {
    let stepsDone = 0;
    let stepsTotal = 0;
    let awaitingClient = 0;
    let overdue = 0;
    for (const p of projects) {
      for (const id of ITEM_IDS) {
        const s = p.state[id]?.status ?? 'not-started';
        if (s === 'not-applicable') continue;
        stepsTotal += 1;
        if (s === 'completed') stepsDone += 1;
        if (s === 'awaiting-client') awaitingClient += 1;
        if (s === 'overdue') overdue += 1;
      }
    }
    const pct = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0;
    return { projects: projects.length, pct, awaitingClient, overdue };
  }, [projects]);

  const weeks = useMemo(() => stepsCompletedPerWeek(projects, ITEM_IDS, new Date()), [projects]);
  const weeksTotal = weeks.reduce((sum, w) => sum + w.steps, 0);
  const health = useMemo(() => clientHealthCounts(projects, ITEM_IDS), [projects]);
  const healthRows = HEALTH_ROWS.filter((h) => health[h.key] > 0);

  const leads = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const p of [...internOptions, ...teamMembers]) if (!seen.has(p.id)) seen.set(p.id, p);
    return [...seen.values()];
  }, [internOptions, teamMembers]);
  const workload = useMemo(() => workloadByLead(projects, ITEM_IDS, leads), [projects, leads]);
  const showWorkload = role !== 'intern' && workload.length > 0;

  const lastMonth = data[data.length - 1];

  return (
    <PageTransition>
      <SEO title="Analytics — VCFO Suite" description="Portfolio performance charts." path="/app/manager/analytics" />

      <PlainPageHead
        title="Analytics"
        meta={period === '6' ? 'Last 6 months' : 'Last 12 months'}
        actions={
          <SpectrumTabs
            size="md"
            label="Period"
            items={[
              { key: '6', label: 'Last 6 months' },
              { key: '12', label: 'Last 12 months' },
            ]}
            value={period}
            onChange={(key) => setPeriod(key as '6' | '12')}
          />
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Projects" value={live.projects} tone="brand" icon={Briefcase} />
        <StatCard label="Steps completed" value={`${live.pct}%`} tone="positive" icon={CheckCircle2} />
        <StatCard label="Waiting on client" value={live.awaitingClient} tone="warning" icon={Users} />
        <StatCard
          label="Overdue steps"
          value={live.overdue}
          tone={live.overdue > 0 ? 'danger' : 'positive'}
          icon={Clock}
        />
      </div>

      <div className="grid gap-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <DashSection
            title="Compliance completion rate"
            meta={
              <span className="inline-flex items-center gap-2">
                {lastMonth.completion}% in {lastMonth.m} · target 95%
                <SampleTag />
              </span>
            }
          >
            <div className="h-[232px]">
              <AnalyticsCompletionChart data={data} />
            </div>
          </DashSection>

          <DashSection
            title="Average filing delay"
            meta={
              <span className="inline-flex items-center gap-2">
                Days past due date · benchmark 2 days
                <SampleTag />
              </span>
            }
          >
            <div className="h-[232px]">
              <AnalyticsDelayChart data={data} />
            </div>
          </DashSection>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <DashSection title="Steps completed per week" meta={`${weeksTotal} in 8 weeks`}>
            <DashBarChart
              data={weeks}
              categoryKey="w"
              series={[{ key: 'steps', label: 'Steps', color: CHART_STATUS.active }]}
              height={232}
              loading={engagementsLoading}
              emptyLabel="No steps completed yet"
            />
          </DashSection>

          <DashSection title="Client health" meta={`${projects.length} clients`}>
            {healthRows.length === 0 ? (
              engagementsLoading ? (
                <SkeletonRows rows={3} />
              ) : (
                <EmptyState title="No clients yet" />
              )
            ) : (
              <div className="flex flex-wrap items-center gap-6 py-2">
                <DashDonut
                  size={96}
                  segments={healthRows.map((h) => ({ n: health[h.key], color: h.color }))}
                  centerLabel={projects.length}
                  centerCaption="clients"
                />
                <ChartLegend
                  layout="stack"
                  className="flex-1"
                  items={healthRows.map((h) => ({ label: h.label, color: h.color, count: health[h.key] }))}
                />
              </div>
            )}
          </DashSection>
        </div>

        {showWorkload ? (
          <DashSection title="Workload" meta="Open steps by project lead">
            <DashBarChart
              data={workload.map((w) => ({ ...w }))}
              categoryKey="name"
              layout="rows"
              series={WORKLOAD_SERIES}
              categoryWidth={120}
            />
            <ChartLegend
              className="mt-3"
              items={WORKLOAD_SERIES.map((s) => ({
                label: s.label,
                color: s.color,
                count: workload.reduce((sum, w) => sum + Number(w[s.key as keyof typeof w] ?? 0), 0),
              }))}
            />
          </DashSection>
        ) : null}
      </div>
    </PageTransition>
  );
}
