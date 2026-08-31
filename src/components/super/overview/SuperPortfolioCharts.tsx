'use client';

import { Layers, PieChart } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import {
  CHART_STATUS,
  ChartLegend,
  DashBarChart,
  type ChartRow,
  type ChartSeries,
} from '@/components/charts';
import { SUPER_PROJECTS_HREF, type SuperOverview } from '@/lib/super-overview';

/**
 * The two portfolio charts. Both go through the shared chart layer, so their
 * axes, grid, tooltip and colour scale are identical to every other chart in
 * the product (context §9). Neither styles anything itself.
 */

/** Where the portfolio sits by delivery stage, split by whether it is moving. */
export function SuperStagePanel({ overview }: { overview: SuperOverview }) {
  const data: ChartRow[] = overview.charts.byStage.map((bar) => ({
    stage: bar.label,
    onTrack: bar.onTrack,
    attention: bar.attention,
  }));

  const series: ChartSeries[] = [
    { key: 'onTrack', label: 'On track', color: CHART_STATUS.done, stackId: 'stage' },
    { key: 'attention', label: 'Needs attention', color: CHART_STATUS.overdue, stackId: 'stage' },
  ];

  const total = overview.charts.byStage.reduce((sum, bar) => sum + bar.onTrack + bar.attention, 0);

  return (
    <DashSection
      icon={PieChart}
      tone="primary"
      title="Portfolio by stage"
      meta={`${total} project${total === 1 ? '' : 's'}`}
      href={SUPER_PROJECTS_HREF}
      hrefLabel="All projects"
    >
      <DashBarChart
        data={data}
        categoryKey="stage"
        series={series}
        emptyLabel="No projects yet."
      />
      <ChartLegend
        className="mt-2"
        items={series.map((entry) => ({ label: entry.label, color: entry.color }))}
      />
    </DashSection>
  );
}

/**
 * Journey throughput: how many steps across the whole firm sit in each phase,
 * and who owns them. Phase fills reuse the `--phase-*` tokens the lead
 * dashboard's progress bars paint with, so the same phase is the same colour on
 * both surfaces.
 */
export function SuperPhasePanel({ overview }: { overview: SuperOverview }) {
  const data: ChartRow[] = overview.charts.byPhase.map((bar) => ({
    phase: bar.label,
    done: bar.done,
    active: bar.active,
    waiting: bar.waiting,
    locked: bar.locked,
  }));

  const series: ChartSeries[] = [
    { key: 'done', label: 'Done', color: CHART_STATUS.done, stackId: 'phase' },
    { key: 'active', label: 'With the firm', color: CHART_STATUS.active, stackId: 'phase' },
    { key: 'waiting', label: 'With the client', color: CHART_STATUS.waiting, stackId: 'phase' },
    { key: 'locked', label: 'Not open yet', color: CHART_STATUS.locked, stackId: 'phase' },
  ];

  const doneTotal = overview.charts.byPhase.reduce((sum, bar) => sum + bar.done, 0);
  const allSteps = overview.charts.byPhase.reduce(
    (sum, bar) => sum + bar.done + bar.active + bar.waiting + bar.locked,
    0,
  );

  return (
    <DashSection
      icon={Layers}
      tone="violet"
      title="Journey throughput"
      meta={allSteps === 0 ? undefined : `${doneTotal} of ${allSteps} steps done`}
    >
      <DashBarChart
        data={data}
        categoryKey="phase"
        series={series}
        emptyLabel="No checklist activity yet."
      />
      <ChartLegend
        className="mt-2"
        items={series.map((entry) => ({ label: entry.label, color: entry.color }))}
      />
    </DashSection>
  );
}
