'use client';

import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { CHART_STATUS, ChartLegend, DashBarChart, type ChartRow, type ChartSeries } from '@/components/charts';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Button } from '@/components/ui/button';
import {
  SuperPageError,
  SuperPageHead,
  SuperPageSkeleton,
} from '@/components/super/parts/super-parts';
import { plainDay } from '@/components/super/parts/super-text';
import {
  buildRisks,
  type SuperMonth,
  type SuperTeamManager,
} from '@/components/super/insights/super-insights-model';
import { useSuperInsights } from '@/views/super/use-super-insights';
import { cn } from '@/lib/utils';

/**
 * REPORTS (prototype `ReportsScreen`, the monthly partner report), counts only.
 *
 * Each month reads from stored dates: engagements started, certificates issued, and the
 * filings due that month split into filed on time (`filed_on` on or before `due_date`), filed
 * late, and overdue. Below the report, filings on time and late per month as stacked columns
 * (R-25, C4). Print opens the browser's print dialog for the report. The prototype's saved
 * reports, schedules and fee report have no backend store and are left out (R-37: no money).
 */
export const SUPER_REPORTS_HREF = '/app/super/reports';

const REPORT_MONTHS = 6;

function onTimePct(m: SuperTeamManager): string {
  const filed = m.filedOnTime + m.filedLate;
  return filed === 0 ? '–' : `${Math.round((m.filedOnTime / filed) * 100)}%`;
}

const managerColumns: EFilingColumn<SuperTeamManager>[] = [
  { key: 'name', header: 'Manager', render: (m) => <span className="font-medium text-ink">{m.name}</span> },
  { key: 'clients', header: 'Clients', width: '80px', align: 'right', render: (m) => <span className="tabular-nums">{m.clients}</span> },
  { key: 'ontime', header: 'On time', width: '84px', align: 'right', render: (m) => <span className="tabular-nums">{onTimePct(m)}</span> },
  {
    key: 'overdue',
    header: 'Overdue',
    width: '84px',
    align: 'right',
    render: (m) => (
      <span className={cn('tabular-nums', m.overdueFilings + m.overdueSteps > 0 && 'font-medium text-danger')}>
        {m.overdueFilings + m.overdueSteps}
      </span>
    ),
  },
  {
    key: 'coi',
    header: 'Days to COI',
    width: '104px',
    align: 'right',
    render: (m) => <span className="tabular-nums">{m.avgDaysToCoi === null ? '–' : `${m.avgDaysToCoi} days`}</span>,
  },
];

function monthNumbers(m: SuperMonth): Array<{ k: string; v: string | number; tone?: 'bad' | 'warn' | 'ok' }> {
  return [
    { k: 'New engagements', v: m.engagementsStarted },
    { k: 'Certificates issued', v: m.certificatesIssued, tone: m.certificatesIssued > 0 ? 'ok' : undefined },
    { k: 'Average days to COI', v: m.avgDaysToCoi === null ? '–' : m.avgDaysToCoi },
    { k: 'Filings due', v: m.filingsDue },
    { k: 'Filed on time', v: m.filedOnTime, tone: m.filedOnTime > 0 ? 'ok' : undefined },
    { k: 'Filed late', v: m.filedLate, tone: m.filedLate > 0 ? 'warn' : undefined },
    { k: 'Overdue, not filed', v: m.overdue, tone: m.overdue > 0 ? 'bad' : undefined },
    { k: 'Still to file', v: m.open },
  ];
}

const TONE_TEXT = { bad: 'text-danger', warn: 'text-warning', ok: 'text-positive' } as const;

export default function SuperReports() {
  const query = useSuperInsights();
  const insights = query.data;
  const [monthKey, setMonthKey] = useState<string | null>(null);

  const recent = useMemo(() => (insights?.months ?? []).slice(-REPORT_MONTHS), [insights]);
  const risks = useMemo(() => (insights ? buildRisks(insights, new Date()).slice(0, 4) : []), [insights]);

  const seo = <SEO title="Reports — VCFO Suite" description="The monthly partner report, from the firm's records." path={SUPER_REPORTS_HREF} />;

  if (query.isPending) {
    return (
      <PageTransition>
        {seo}
        <SuperPageSkeleton label="Loading reports" />
      </PageTransition>
    );
  }
  if (query.isError || !insights) {
    return (
      <PageTransition>
        {seo}
        <SuperPageError title="Reports could not load" error={query.error} onRetry={() => void query.refetch()} />
      </PageTransition>
    );
  }

  const month = recent.find((m) => m.key === monthKey) ?? recent[recent.length - 1];
  const incorporating = insights.clients.filter((c) => !c.summary.incorporated).length;
  const clientLine = `${insights.clients.length} clients in the book: ${incorporating} in incorporation and ${insights.clients.length - incorporating} incorporated.`;

  const data: ChartRow[] = insights.months.map((m) => ({
    month: m.label,
    onTime: m.filedOnTime,
    late: m.filedLate,
    overdue: m.overdue,
  }));
  const series: ChartSeries[] = [
    { key: 'onTime', label: 'Filed on time', color: CHART_STATUS.done, stackId: 'filings' },
    { key: 'late', label: 'Filed late', color: CHART_STATUS.due, stackId: 'filings' },
    { key: 'overdue', label: 'Overdue', color: CHART_STATUS.overdue, stackId: 'filings' },
  ];

  return (
    <PageTransition>
      {seo}
      <div className="flex flex-col gap-5">
        <SuperPageHead title="Reports" meta={`Partner report · prepared ${plainDay(insights.generatedAt)}`}>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden />
            Print
          </Button>
        </SuperPageHead>

        <SpectrumTabs
          label="Month"
          size="md"
          items={recent.map((m) => ({ key: m.key, label: m.longLabel.split(' ')[0]! }))}
          value={month?.key ?? ''}
          onChange={setMonthKey}
        />

        {month ? (
          <article className="mx-auto grid w-full min-w-0 max-w-[900px] grid-cols-1 gap-6 rounded-md border-1.5 border-line bg-surface-raised px-5 py-6 md:px-10 md:py-9 [&>*]:min-w-0">
            <header className="border-b-1.5 border-line pb-4">
              <span className="text-[12.5px] text-ink-muted">SBC · monthly partner report</span>
              <h2 className="text-[28px] font-medium leading-tight tracking-[-0.01em] text-ink">{month.longLabel}</h2>
            </header>
            <section>
              <h3 className="mb-2 text-[15px] font-medium text-ink">The month in numbers</h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {monthNumbers(month).map((n) => (
                  <div key={n.k} className="flex min-w-0 flex-col gap-1.5 rounded-md border-1.5 border-line px-4 py-3.5">
                    <span className="truncate text-[13px] font-medium text-ink-2" title={n.k}>
                      {n.k}
                    </span>
                    <b className={cn('text-[26px] font-medium leading-none tabular-nums', n.tone && TONE_TEXT[n.tone])}>{n.v}</b>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-1 text-[15px] font-medium text-ink">Clients</h3>
              <p className="text-[13.5px] text-ink-2">{clientLine}</p>
            </section>
            <section>
              <h3 className="mb-2 text-[15px] font-medium text-ink">Managers</h3>
              <EFilingGrid caption="Managers" columns={managerColumns} rows={insights.team.managers} rowKey={(m) => m.id} empty="No manager yet" minWidth={560} />
            </section>
            <section>
              <h3 className="mb-1 text-[15px] font-medium text-ink">Top risks</h3>
              {risks.length === 0 ? (
                <p className="text-[13.5px] text-ink-2">None</p>
              ) : (
                <ol className="grid list-decimal gap-1.5 pl-5 text-[13.5px] text-ink-2">
                  {risks.map((r) => (
                    <li key={r.id}>
                      {r.title} · {r.companyName}
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <footer className="border-t border-line-soft pt-3 text-[12px] text-ink-muted">
              Prepared by VCFO Suite from the firm&apos;s records on {plainDay(insights.generatedAt)}.
            </footer>
          </article>
        ) : null}

        <DashSection title="Filings on time and late" meta="Last 12 months, by due month">
          <DashBarChart data={data} categoryKey="month" series={series} height={220} emptyLabel="No filings yet" />
          <ChartLegend className="mt-2" items={series.map((s) => ({ label: s.label, color: s.color }))} />
        </DashSection>
      </div>
    </PageTransition>
  );
}
