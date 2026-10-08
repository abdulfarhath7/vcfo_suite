'use client';

import { WhatsThisButton } from '@/components/ask/WhatsThisButton';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { StatutoryCalendar } from '@/components/admin/StatutoryCalendar';
import { useFilings } from '@/lib/use-filings';
import {
  FILING_STATUS_LABEL,
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
  type FilingStatus,
} from '@/lib/filings';
import {
  ALL_COMPANIES,
  normaliseCompanyParam,
  rowsForCompany,
  soleCompany,
  type ComplianceScope,
} from '@/views/compliances/compliance-scope';
import { cn } from '@/lib/utils';

/**
 * COMPLIANCE CALENDAR — the radar, one view for every role.
 *
 * ONE calendar, one colour language. The page is the firm's FY 2026-27
 * statutory master calendar (`StatutoryCalendar`: month and year views, act
 * filter, keyboard grid, full-screen mode), with the client's own filing
 * register read underneath it as a month register. It used to stack a second,
 * separately-styled month picker below the grid; that is gone — navigating
 * months is the toolbar's job, and two calendars with two palettes on one page
 * is what made this screen hard to show a client.
 *
 * Every shell renders this exact layout; WHAT it shows is decided by
 * `getFilings` through `AuthContext` and by the roster in `scope` — a client's
 * own company, a lead's assignments, the whole firm. Nothing is keyed off the
 * role. One company selection narrows both the calendar and the register.
 *
 * Pre-incorporation is `StatutoryCalendar`'s notice, read off `scope` (derived
 * by the caller from `isIncorporated`, never a rule of this view's own). The
 * layout stays in its genuine empty state under it — nothing is generated or
 * invented to fill a calendar.
 *
 * COLOUR: status only (overdue / due soon / upcoming). See the `.cal-*`
 * contract at the top of that block in `app/globals.css`.
 */
export function ComplianceCalendarView({
  basePath,
  scope,
}: {
  basePath: string;
  scope: ComplianceScope;
}) {
  const params = useSearchParams();
  const now = useMemo(() => new Date(), []);
  const { engagements } = scope;
  const sole = soleCompany(engagements);

  const dateParam = parseIsoDate(params.get('date'));
  // Owned here, driven by the calendar's own toolbar: the register below has
  // to show the month the grid is sitting on, not whatever month it loaded in.
  const [month, setMonth] = useState<Date>(() => dateParam ?? now);
  const [pickedId, setPickedId] = useState<string>(() =>
    normaliseCompanyParam(params.get('company'), engagements),
  );
  const companyId = sole ? sole.id : pickedId;

  const fyStartYear = financialYearForDate(month).startYear;
  const query = useFilings({ fyStartYear });
  const scopedRows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const rows = useMemo(() => rowsForCompany(scopedRows, companyId), [scopedRows, companyId]);

  const monthKey = monthKeyForDate(month);
  const summary = useMemo(() => summarise(rows, monthKey, now), [rows, monthKey, now]);
  const monthRows = useMemo(() => sortByDueDate(rowsInMonth(rows, monthKey)), [rows, monthKey]);

  // Only a real choice travels in the URL; a sole company is implicit.
  const companyQuery = !sole && companyId !== ALL_COMPANIES ? `&company=${companyId}` : '';
  const showCompany = companyId === ALL_COMPANIES;

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
            href={`${basePath}/filings${companyQuery ? `?${companyQuery.slice(1)}` : ''}`}
            className="cal-ghost"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            Open filings
          </Link>
        </div>

        <StatutoryCalendar
          engagements={engagements}
          companyId={companyId}
          onCompanyChange={setPickedId}
          month={month}
          onMonthChange={setMonth}
          audience={scope.audience}
        />

        {/* ── The register: this company's own filings, same visual language ── */}
        {query.isPending ? (
          <div className="cal-panel p-4" aria-busy="true" aria-label="Loading register">
            <div className="h-40 animate-pulse rounded-md bg-muted/40" />
          </div>
        ) : (
          <section className="cal-panel" aria-label={`${monthLabelOf(monthKey)} register`}>
            <div className="cal-panel-head">
              <h2 className="cal-panel-title">{monthLabelOf(monthKey)} · your filings</h2>
              <Link
                href={`${basePath}/filings?cadence=monthly&period=${monthKey}&fy=${fyStartYear}${companyQuery}`}
                className="cal-stats-link"
              >
                View this month&rsquo;s filings
              </Link>
            </div>

            <div className="cal-stats is-bare">
              <SummaryStat value={summary.dueThisMonth} label="due this month" />
              <SummaryStat value={summary.overdue} label="overdue" hot={summary.overdue > 0} />
              <SummaryStat value={summary.filed} label="filed" />
            </div>

            <div className="cal-rail-body">
              {monthRows.length === 0 ? (
                <p className="cal-empty">Nothing falls due in this month.</p>
              ) : (
                <ul className="cal-rows">
                  {monthRows.map((row) => (
                    <MonthRow
                      key={row.id}
                      row={row}
                      now={now}
                      basePath={basePath}
                      companyQuery={companyQuery}
                      showCompany={showCompany}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
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
    <span className={cn('cal-stat', hot && 'is-hot')}>
      <span className="cal-stat-n">{value}</span>
      <span className="cal-stat-label">{label}</span>
    </span>
  );
}

/**
 * Register status → the calendar's own colour lane.
 *
 * `filed` is the register's one state the statutory calendar has no equivalent
 * for. It reads as quiet rather than green: a completed filing is settled, and
 * on a page whose whole point is what still needs doing it should recede.
 */
const REGISTER_STATUS_CLASS: Record<FilingStatus, string> = {
  overdue: 'is-overdue',
  'due-soon': 'is-due-soon',
  filed: 'is-upcoming',
  upcoming: 'is-upcoming',
};

function MonthRow({
  row,
  now,
  basePath,
  companyQuery,
  showCompany,
}: {
  row: FilingRow;
  now: Date;
  basePath: string;
  companyQuery: string;
  /** "All companies": say whose filing this is. */
  showCompany: boolean;
}) {
  const monthKey = monthKeyOf(row.dueDate);
  const status = filingStatus(row, now);
  const d = new Date(`${row.dueDate}T12:00:00`);
  return (
    <li className="cal-row" data-ask-focus={row.id}>
      <span className="cal-row-date" aria-hidden>
        <span className="cal-row-day">{row.dueDate.slice(8, 10)}</span>
        <span className="cal-row-dow">
          {d.toLocaleDateString('en-IN', { weekday: 'short' })}
        </span>
      </span>
      <span className="cal-row-main">
        <span className="flex min-w-0 items-center gap-1">
          <Link
            href={`${basePath}/filings?cadence=monthly&period=${monthKey}${companyQuery}`}
            className="cal-row-title hover:underline"
          >
            {row.particular}
          </Link>
          <WhatsThisButton compact kind="compliance" refId={row.obligationId} label={row.particular} />
        </span>
        <span className="cal-row-meta">
          {showCompany ? <span className="cal-tag mono">{row.companyName}</span> : null}
          <span className="cal-tag mono">{row.compliance}</span>
          <span className="cal-period-tag">{formatFilingDate(row.dueDate)}</span>
        </span>
      </span>
      <span className={cn('cal-status', REGISTER_STATUS_CLASS[status])}>
        {FILING_STATUS_LABEL[status]}
      </span>
    </li>
  );
}
