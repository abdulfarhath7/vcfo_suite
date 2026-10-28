'use client';

import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { CHART_STATUS, ChartLegend, DashBarChart, type ChartRow, type ChartSeries } from '@/components/charts';
import { PhaseBar } from '@/components/ui/step-track';
import {
  StackedBar,
  SuperNumberStrip,
  SuperPageError,
  SuperPageHead,
  SuperPageSkeleton,
} from '@/components/super/parts/super-parts';
import { useSuperInsights } from '@/views/super/use-super-insights';

/**
 * GROWTH (prototype `GrowthScreen`), counts only.
 *
 * New engagements by the month they started (`created_at`) and certificates by the month they
 * were issued, over the last twelve months, plus how much of the current book is incorporated. The
 * prototype's sales pipeline, proposal win rate and per-manager capacity need a store the
 * product does not have, so they are left out. No money (R-37).
 */
export const SUPER_GROWTH_HREF = '/app/super/growth';

export default function SuperGrowth() {
  const query = useSuperInsights();
  const insights = query.data;

  const seo = <SEO title="Growth — VCFO Suite" description="New engagements and certificates over time." path={SUPER_GROWTH_HREF} />;

  if (query.isPending) {
    return (
      <PageTransition>
        {seo}
        <SuperPageSkeleton label="Loading growth" />
      </PageTransition>
    );
  }
  if (query.isError || !insights) {
    return (
      <PageTransition>
        {seo}
        <SuperPageError title="Growth could not load" error={query.error} onRetry={() => void query.refetch()} />
      </PageTransition>
    );
  }

  const months = insights.months;
  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  const yearStarted = months.reduce((sum, m) => sum + m.engagementsStarted, 0);
  const yearCertificates = months.reduce((sum, m) => sum + m.certificatesIssued, 0);
  const incorporating = insights.clients.filter((c) => !c.summary.incorporated).length;

  const data: ChartRow[] = months.map((m) => ({
    month: m.label,
    started: m.engagementsStarted,
    certificates: m.certificatesIssued,
  }));
  const series: ChartSeries[] = [
    { key: 'started', label: 'New engagements', color: CHART_STATUS.active },
    { key: 'certificates', label: 'Certificates issued', color: CHART_STATUS.done },
  ];

  const phaseTotals = insights.clients[0]?.summary.phases.map((p) => p.total) ?? [];
  const phaseNames = insights.clients[0]?.summary.phases.map((p) => p.label) ?? [];
  const phaseDone = phaseTotals.map((_, i) =>
    insights.clients.reduce((sum, c) => sum + (c.summary.phases[i]?.done ?? 0), 0),
  );
  const phaseAll = phaseTotals.map((t) => t * insights.clients.length);

  return (
    <PageTransition>
      {seo}
      <div className="flex flex-col gap-5">
        <SuperPageHead title="Growth" meta="Last 12 months" />

        <SuperNumberStrip
          items={[
            {
              label: `New engagements in ${current?.longLabel.split(' ')[0] ?? 'this month'}`,
              value: current?.engagementsStarted ?? 0,
              sub: previous ? `${previous.engagementsStarted} in ${previous.longLabel.split(' ')[0]}` : undefined,
            },
            { label: 'New engagements · 12 months', value: yearStarted },
            {
              label: 'Certificates · 12 months',
              value: yearCertificates,
              sub: current ? `${current.certificatesIssued} this month` : undefined,
              good: yearCertificates > 0,
            },
            { label: 'Clients in incorporation', value: incorporating },
          ]}
        />

        <DashSection title="New engagements and certificates" meta={`${yearStarted} started · ${yearCertificates} certificates`}>
          <DashBarChart data={data} categoryKey="month" series={series} height={220} emptyLabel="No engagements yet" />
          <ChartLegend className="mt-2" items={series.map((s) => ({ label: s.label, color: s.color }))} />
        </DashSection>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <DashSection title="Clients by incorporation" meta={String(insights.clients.length)}>
            <StackedBar
              segments={[
                { label: 'Incorporated', value: insights.clients.length - incorporating, tone: 'ok' },
                { label: 'In incorporation', value: incorporating, tone: 'prog' },
              ]}
            />
          </DashSection>
          <DashSection title="Steps done across the book" meta={`${phaseDone.reduce((a, b) => a + b, 0)} steps`}>
            {phaseTotals.length === 0 ? null : (
              <>
                <PhaseBar done={phaseDone} totals={phaseAll} names={phaseNames} tall />
                <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] text-ink-2 sm:grid-cols-4">
                  {phaseNames.map((name, i) => (
                    <li key={name} className="flex items-baseline gap-1.5">
                      <span className="truncate">{name}</span>
                      <b className="font-medium tabular-nums text-ink">
                        {phaseDone[i]}/{phaseAll[i]}
                      </b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </DashSection>
        </div>
      </div>
    </PageTransition>
  );
}
