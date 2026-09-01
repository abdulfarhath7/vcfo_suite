'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, FileSpreadsheet } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { ComplianceCalendar } from '@/components/admin/ComplianceCalendar';
import { FilingStatusPill } from '@/components/compliances/FilingStatusPill';
import { useFilings } from '@/lib/use-filings';
import {
  filingStatus,
  financialYearForDate,
  formatFilingDate,
  monthKeyForDate,
  monthKeyOf,
  monthLabelOf,
  parseIsoDate,
  rowsInMonth,
  sortByDueDate,
  summarise,
  type FilingRow,
} from '@/lib/filings';
import type { ComplianceFiling } from '@/data/compliance';

/**
 * COMPLIANCE CALENDAR — the radar, for every role.
 *
 * Reuses the existing `ComplianceCalendar` component rather than building a
 * second calendar; the register rows are mapped onto the `ComplianceFiling`
 * shape it already speaks. Scope comes from `getFilings` via `AuthContext`, so
 * this same view serves the client and the firm.
 */
export function ComplianceCalendarView({ basePath }: { basePath: string }) {
  const params = useSearchParams();
  const now = useMemo(() => new Date(), []);

  const dateParam = parseIsoDate(params.get('date'));
  const [month, setMonth] = useState<Date>(() => dateParam ?? now);

  const fyStartYear = financialYearForDate(month).startYear;
  const query = useFilings({ fyStartYear });
  const rows = query.data?.rows ?? [];

  const monthKey = monthKeyForDate(month);
  const summary = useMemo(() => summarise(rows, monthKey, now), [rows, monthKey, now]);
  const monthRows = useMemo(
    () => sortByDueDate(rowsInMonth(rows, monthKey)),
    [rows, monthKey],
  );

  // The calendar component plots `ComplianceFiling`; map, do not fork.
  const calendarFilings: ComplianceFiling[] = useMemo(
    () =>
      rows.map((row) => ({
        id: row.id,
        engagementId: row.engagementId,
        filing: row.particular,
        authority: row.authority,
        frequency: row.frequency as ComplianceFiling['frequency'],
        nextDue: row.dueDate,
        ownerId: '',
        status: row.filedOn
          ? 'filed'
          : filingStatus(row, now) === 'overdue'
            ? 'overdue'
            : 'upcoming',
        penaltyRisk: 'low',
      })),
    [rows, now],
  );

  const hasAny = rows.length > 0;

  return (
    <PageTransition>
      <SEO
        title="Compliance calendar — VCFO Suite"
        description="Statutory filing obligations plotted by due date."
        path={`${basePath}/calendar`}
      />

      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="serif min-w-0 flex-1 text-[22px] leading-tight tracking-tight text-foreground">
            Compliance calendar
          </h1>
          <Link
            href={`${basePath}/filings`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-bold text-primary hover:bg-primary-light"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            Open filings
          </Link>
        </div>

        {query.isPending ? (
          <div className="surface p-4" aria-busy="true" aria-label="Loading calendar">
            <div className="h-64 animate-pulse rounded-md bg-muted/40" />
          </div>
        ) : !hasAny ? (
          <DashSection icon={CalendarDays} title="Compliance calendar" tone="primary">
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              Your filing calendar starts the day your Certificate of Incorporation is
              issued. Nothing is due yet.
            </p>
          </DashSection>
        ) : (
          <>
            {/* The emotional read first: what this month costs you. */}
            <div className="surface flex flex-wrap items-baseline gap-x-5 gap-y-1 px-4 py-3">
              <SummaryStat value={summary.dueThisMonth} label="due this month" />
              <SummaryStat value={summary.overdue} label="overdue" hot={summary.overdue > 0} />
              <SummaryStat value={summary.filed} label="filed" />
              <Link
                href={`${basePath}/filings?cadence=monthly&period=${monthKey}&fy=${fyStartYear}`}
                className="ml-auto text-[11.5px] font-bold text-primary hover:underline"
              >
                View this month&rsquo;s filings
              </Link>
            </div>

            <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="surface min-w-0 p-3">
                <ComplianceCalendar
                  filings={calendarFilings}
                  month={month}
                  onMonthChange={setMonth}
                />
              </div>

              <DashSection
                icon={CalendarDays}
                title={monthLabelOf(monthKey)}
                tone="sky"
                meta={`${monthRows.length}`}
              >
                {monthRows.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground">
                    Nothing falls due in this month.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {monthRows.map((row) => (
                      <MonthRow key={row.id} row={row} now={now} basePath={basePath} />
                    ))}
                  </ul>
                )}
              </DashSection>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}

function SummaryStat({
  value,
  label,
  hot = false,
}: {
  value: number;
  label: string;
  hot?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={`serif text-[1.25rem] font-bold leading-none tabular-nums ${
          hot ? 'text-danger-text' : 'text-ink'
        }`}
      >
        {value}
      </span>
      <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
    </span>
  );
}

function MonthRow({
  row,
  now,
  basePath,
}: {
  row: FilingRow;
  now: Date;
  basePath: string;
}) {
  const monthKey = monthKeyOf(row.dueDate);
  return (
    <li className="flex min-w-0 items-start gap-2.5">
      <span className="mono grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-[11px] font-extrabold tabular-nums text-ink">
        {row.dueDate.slice(8, 10)}
      </span>
      <span className="min-w-0 flex-1">
        <Link
          href={`${basePath}/filings?cadence=monthly&period=${monthKey}`}
          className="block truncate text-[12.5px] font-semibold text-ink hover:text-primary"
        >
          {row.particular}
        </Link>
        <span className="text-[11px] text-muted-foreground">
          {row.compliance} · {formatFilingDate(row.dueDate)}
        </span>
      </span>
      <FilingStatusPill status={filingStatus(row, now)} />
    </li>
  );
}
