'use client';

import { Users } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import {
  CHART_STATUS,
  ChartLegend,
  DashBarChart,
  type ChartRow,
  type ChartSeries,
} from '@/components/charts';
import type { SuperOverview } from '@/lib/super-overview';

/**
 * Where the work actually sits. Horizontal bars because delivery leads have
 * names, and names need room to be read — same chart layer, `rows` layout.
 */
export function SuperWorkloadPanel({ overview }: { overview: SuperOverview }) {
  const data: ChartRow[] = overview.charts.workload.map((row) => ({
    name: row.name,
    open: row.open,
  }));

  const series: ChartSeries[] = [
    { key: 'open', label: 'Open steps', color: CHART_STATUS.active },
  ];

  const flagged = overview.charts.workload.filter((row) => row.attention > 0);

  return (
    <DashSection
      icon={Users}
      tone="sky"
      title="Workload by lead"
      meta={`${overview.people.length} in delivery`}
      href="/app/admin/people"
      hrefLabel="People"
    >
      <DashBarChart
        data={data}
        categoryKey="name"
        series={series}
        layout="rows"
        categoryWidth={104}
        hideValueAxis
        emptyLabel="No projects assigned yet."
      />
      {flagged.length > 0 ? (
        <ChartLegend
          className="mt-2"
          items={flagged.map((row) => ({
            label: `${row.name} · ${row.attention} needing attention`,
            color: CHART_STATUS.overdue,
          }))}
          layout="stack"
        />
      ) : null}
    </DashSection>
  );
}
