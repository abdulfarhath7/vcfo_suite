'use client';

import { useMemo, useState } from 'react';
import { Download, Printer, Save } from 'lucide-react';
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
import { buildRisks, type SuperTeamManager } from '@/components/super/insights/super-insights-model';
import { useSuperInsights } from '@/views/super/use-super-insights';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button-variants';
import { SaveReportDialog } from '@/components/super/reports/SaveReportDialog';
import { SavedReportsCard } from '@/components/super/reports/SavedReportsCard';
import { useApp } from '@/context/AppContext';
import { clientLine, monthNumbers, onTimePct, recentMonths, type SavedReport } from '@/lib/reports/partner-report';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { useSavedReportMutations, useSavedReports } from '@/views/super/reports/use-saved-reports';

/**
 * REPORTS (prototype `ReportsScreen`, the monthly partner report), counts only.
 *
 * Each month reads from stored dates: engagements started, certificates issued, and the
 * filings due that month split into filed on time (`filed_on` on or before `due_date`), filed
 * late, and overdue. Below the report, filings on time and late per month as stacked columns
 * (R-25, C4). Print opens the browser's print dialog for the report.
 *
 * G-21: "Download PDF" renders the same report on the server (`/api/super/reports/pdf`, built
 * from the same insights through `src/lib/reports/partner-report.ts`, which this page also
 * uses for its numbers). "Save report" stores the report with its month, a schedule (none,
 * weekly, monthly) and recipients in `saved_reports`; the Inngest function
 * `saved-reports-send` emails due schedules with the PDF attached. The prototype's fee report
 * stays out (R-37: no money).
 */
export const SUPER_REPORTS_HREF = '/app/super/reports';

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
    render: (m) => <span className="tabular-nums">{m.avgDaysToCoi === null ? '–' : `${m.avgDaysToCoi} ${m.avgDaysToCoi === 1 ? 'day' : 'days'}`}</span>,
  },
];

const TONE_TEXT = { bad: 'text-danger', warn: 'text-warning', ok: 'text-positive' } as const;

export default function SuperReports() {
  const query = useSuperInsights();
  const insights = query.data;
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const { user } = useApp();
  const saved = useSavedReports();
  const { save, remove } = useSavedReportMutations();
  const [saving, setSaving] = useState<SavedReport | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SavedReport | null>(null);

  const recent = useMemo(() => (insights ? recentMonths(insights) : []), [insights]);
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
  const clients = clientLine(insights);
  const latestKey = recent[recent.length - 1]?.key;

  function openSaved(r: SavedReport) {
    setMonthKey(r.params.month === 'latest' ? null : recent.some((m) => m.key === r.params.month) ? r.params.month : null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
          <Button variant="outline" onClick={() => setSaving('new')} disabled={!month}>
            <Save aria-hidden />
            Save report
          </Button>
          {month ? (
            <Button asChild>
              <a href={`/api/super/reports/pdf?month=${month.key === latestKey ? 'latest' : month.key}`}>
                <Download aria-hidden />
                Download PDF
              </a>
            </Button>
          ) : null}
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
              <p className="text-[13.5px] text-ink-2">{clients}</p>
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

        <SavedReportsCard
          reports={saved.data ?? []}
          loading={saved.isPending}
          error={saved.isError ? errorMessage(saved.error, 'Saved reports could not load.') : null}
          onOpen={openSaved}
          onSchedule={setSaving}
          onDelete={setDeleting}
        />

        <DashSection title="Filings on time and late" meta="Last 12 months, by due month">
          <DashBarChart data={data} categoryKey="month" series={series} height={220} emptyLabel="No filings yet" />
          <ChartLegend className="mt-2" items={series.map((s) => ({ label: s.label, color: s.color }))} />
        </DashSection>
      </div>

      <SaveReportDialog
        open={saving !== null}
        onOpenChange={(o) => !o && setSaving(null)}
        report={saving === 'new' ? null : saving}
        monthKey={month?.key ?? ''}
        monthLabel={month?.longLabel ?? ''}
        defaultRecipient={user?.email ?? ''}
        saving={save.isPending}
        onSave={(values) =>
          save.mutate(
            { id: saving && saving !== 'new' ? saving.id : undefined, values },
            {
              onSuccess: (r) => {
                toastSuccess(`${r.name} saved`);
                setSaving(null);
              },
              onError: (err) => toastError('Could not save the report', errorMessage(err)),
            },
          )
        }
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this saved report?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `${deleting.name} and its schedule will be removed. Nothing more goes to its recipients.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              className={buttonVariants({ variant: 'destructive' })}
              onClick={(e) => {
                e.preventDefault();
                if (!deleting) return;
                remove.mutate(deleting.id, {
                  onSuccess: () => setDeleting(null),
                  onError: (err) => toastError('Could not delete the report', errorMessage(err)),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}
