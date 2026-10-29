"use client";

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Clock, Timer, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { StatCard } from '@/components/dash/StatCard';
import { DashDonut, DashSection } from '@/components/dash/DashSection';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { CHART_STATUS, ChartLegend, DashBarChart, type ChartSeries } from '@/components/charts';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { useAnalyticsMetrics } from '@/components/metrics/use-metrics';
import { OnTimeColumns } from '@/components/compliances/OnTimeColumns';
import type { StepTimeMetric } from '@/lib/metrics/practice-metrics';
import { shortCompany } from '@/components/super/parts/super-text';
import { cn } from '@/lib/utils';
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

const STEP_TIME_COLUMNS: EFilingColumn<StepTimeMetric>[] = [
  { key: 'step', header: 'Step', render: (s) => <span className="font-medium text-ink">{s.title}</span> },
  {
    key: 'median',
    header: 'Median days',
    width: '110px',
    align: 'right',
    render: (s) => <span className="tabular-nums">{s.medianDays ?? '–'}</span>,
  },
  {
    key: 'longest',
    header: 'Longest now',
    width: '104px',
    align: 'right',
    render: (s) => (
      <span className={cn('tabular-nums', (s.longestDays ?? 0) > 7 && 'font-medium text-danger')}>{s.longestDays ?? '–'}</span>
    ),
  },
  {
    key: 'client',
    header: 'Longest client',
    width: '160px',
    render: (s) => (s.longestCompany ? shortCompany(s.longestCompany) : <span className="text-ink-faint">–</span>),
  },
];

/**
 * Analytics (prototype AnalyticsScreen). The monthly charts, filings on time and time in step
 * come from `/api/metrics/analytics` (G-27): the filed-against-due history in the compliance
 * rows and the step events. The live counts below them still come from the checklist state the
 * app already holds.
 */
export default function Analytics() {
  const [period, setPeriod] = useState<'6' | '12'>('6');
  const metrics = useAnalyticsMetrics(period === '6' ? 6 : 12);
  const months = metrics.data?.months ?? [];
  const data = months.map((m) => ({ m: m.label, completion: m.completionPct, delay: m.avgDelayDays }));
  // Month words only ("Oct"); twelve months never repeat one, and the tooltip keeps the counts.
  const filingRows = months.map((m) => ({ key: m.key, label: m.label.split(' ')[0] ?? m.label, onTime: m.onTime, late: m.late }));
  const filedTotal = months.reduce((n, m) => n + m.onTime + m.late, 0);
  const onTimeTotal = months.reduce((n, m) => n + m.onTime, 0);
  const lastRated = [...months].reverse().find((m) => m.completionPct !== null);
  const hasRates = months.some((m) => m.completionPct !== null);
  const hasDelay = months.some((m) => m.avgDelayDays !== null);
  const stepTime = metrics.data?.stepTime ?? [];
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

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Projects" value={live.projects} tone="brand" icon={Briefcase} />
        <StatCard label="Steps completed" value={`${live.pct}%`} tone="positive" icon={CheckCircle2} />
        <StatCard label="Waiting on client" value={live.awaitingClient} tone="warning" icon={Users} />
        <StatCard
          label="Filed on time · 12 months"
          value={metrics.data?.onTime.pct === null || metrics.data?.onTime.pct === undefined ? '–' : `${metrics.data.onTime.pct}%`}
          tone="positive"
          icon={Timer}
        />
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
            meta={lastRated ? `${lastRated.completionPct}% in ${lastRated.label} · target 95%` : 'Target 95%'}
            loading={metrics.isPending}
            loadingVariant="block"
          >
            {hasRates ? (
              <div className="h-[232px]">
                <AnalyticsCompletionChart data={data} />
              </div>
            ) : (
              <EmptyState title="No filing has fallen due yet" />
            )}
          </DashSection>

          <DashSection
            title="Average filing delay"
            meta="Days past due date · benchmark 2 days"
            loading={metrics.isPending}
            loadingVariant="block"
          >
            {hasDelay ? (
              <div className="h-[232px]">
                <AnalyticsDelayChart data={data} />
              </div>
            ) : (
              <EmptyState title="No filing date recorded yet" />
            )}
          </DashSection>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <DashSection
            title="Filings on time"
            meta={filedTotal ? `${Math.round((onTimeTotal / filedTotal) * 100)}%` : undefined}
            loading={metrics.isPending}
            loadingVariant="block"
          >
            {/* C4 (B-23): the same on-time and late columns as the Filings rail. */}
            {filedTotal ? (
              <OnTimeColumns data={filingRows} height={180} />
            ) : (
              <EmptyState title="No filing recorded yet" />
            )}
          </DashSection>

          <DashSection title="Time in step" meta="Open and finished steps" loading={metrics.isPending} bodyClassName="px-2 pb-2 pt-1">
            <EFilingGrid
              caption="Time in step"
              columns={STEP_TIME_COLUMNS}
              rows={stepTime}
              rowKey={(s) => s.stepId}
              empty="No step has been timed yet"
              pageSize={8}
              minWidth={520}
            />
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
