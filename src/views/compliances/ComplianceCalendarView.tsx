'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarDays, FileSpreadsheet } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { ComplianceCalendar } from '@/components/admin/ComplianceCalendar';
import { StatutoryCalendar } from '@/components/admin/StatutoryCalendar';
import { FilingStatusPill } from '@/components/compliances/FilingStatusPill';
import {
  PreIncorporationNotice,
  type PreIncorporationScope,
} from '@/components/compliances/PreIncorporationNotice';
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
import {
  ALL_COMPANIES,
  normaliseCompanyParam,
  rowsForCompany,
  type ComplianceAudience,
  type ComplianceStaffScope,
} from '@/views/compliances/staff-scope';

/**
 * COMPLIANCE CALENDAR — the radar, for every role.
 *
 * Reuses the existing `ComplianceCalendar` component rather than building a
 * second calendar; the register rows are mapped onto the `ComplianceFiling`
 * shape it already speaks. Scope comes from `getFilings` via `AuthContext`, so
 * this same view serves the client and the firm.
 *
 * `audience` decides the chrome, never the data:
 * - `'client'` (default): one engagement, no picker — unchanged.
 * - `'staff'`: the firm's statutory month grid (`StatutoryCalendar`, with its
 *   `CompanyPicker`, act legend and All / Overdue scope) sits above the register
 *   calendar, and the one picker narrows both. The pre-incorporation notice and
 *   the portfolio one-liner come from `StatutoryCalendar` itself, off the
 *   engagement list the caller already holds.
 *
 * `preIncorporation` is set by the caller (from `isIncorporated`, never a rule
 * of this view's own) when the company has no Certificate of Incorporation
 * yet. The view then shows the normal calendar layout in its genuine empty
 * state under one notice — nothing is generated or invented to fill it.
 */
export function ComplianceCalendarView({
  basePath,
  preIncorporation,
  audience = 'client',
  staff,
}: {
  basePath: string;
  preIncorporation?: PreIncorporationScope;
  audience?: ComplianceAudience;
  /** Required with `audience="staff"`: the scoped roster and its pre-COI ids. */
  staff?: ComplianceStaffScope;
}) {
  const params = useSearchParams();
  const now = useMemo(() => new Date(), []);
  const isStaff = audience === 'staff' && Boolean(staff);
  const engagements = useMemo(() => staff?.engagements ?? [], [staff?.engagements]);

  const dateParam = parseIsoDate(params.get('date'));
  const [month, setMonth] = useState<Date>(() => dateParam ?? now);
  const [companyId, setCompanyId] = useState<string>(() =>
    normaliseCompanyParam(params.get('company'), engagements),
  );

  const fyStartYear = financialYearForDate(month).startYear;
  const query = useFilings({ fyStartYear });
  const scopedRows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const rows = useMemo(
    () => (isStaff ? rowsForCompany(scopedRows, companyId) : scopedRows),
    [isStaff, scopedRows, companyId],
  );

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
  // Pre-COI the layout stays — the honest empty calendar is the design. A
  // portfolio always keeps its layout too: an empty month is a real answer.
  const showLayout = hasAny || Boolean(preIncorporation) || isStaff;
  const companyQuery = isStaff && companyId !== ALL_COMPANIES ? `&company=${companyId}` : '';

  return (
    <PageTransition>
      <SEO
        title="Compliance calendar — VCFO Suite"
        description="Statutory filing obligations plotted by due date."
        path={`${basePath}/calendar`}
      />

      <div className={isStaff ? 'stat-cal-intern flex flex-col gap-3' : 'flex flex-col gap-3'}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="serif min-w-0 flex-1 text-[22px] leading-tight tracking-tight text-foreground">
            Compliance calendar
          </h1>
          <Link
            href={`${basePath}/filings${companyQuery ? `?${companyQuery.slice(1)}` : ''}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-bold text-primary hover:bg-primary-light"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            Open filings
          </Link>
        </div>

        {isStaff ? (
          <StatutoryCalendar
            engagements={engagements}
            companyId={companyId}
            onCompanyChange={setCompanyId}
          />
        ) : null}

        {preIncorporation ? <PreIncorporationNotice scope={preIncorporation} /> : null}

        {query.isPending ? (
          <div className="surface p-4" aria-busy="true" aria-label="Loading calendar">
            <div className="h-64 animate-pulse rounded-md bg-muted/40" />
          </div>
        ) : !showLayout ? (
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
                href={`${basePath}/filings?cadence=monthly&period=${monthKey}&fy=${fyStartYear}${companyQuery}`}
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
                      <MonthRow
                        key={row.id}
                        row={row}
                        now={now}
                        basePath={basePath}
                        companyQuery={companyQuery}
                        showCompany={isStaff && companyId === ALL_COMPANIES}
                      />
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
  companyQuery = '',
  showCompany = false,
}: {
  row: FilingRow;
  now: Date;
  basePath: string;
  companyQuery?: string;
  /** Firm scope on "All companies": say whose filing this is. */
  showCompany?: boolean;
}) {
  const monthKey = monthKeyOf(row.dueDate);
  return (
    <li className="flex min-w-0 items-start gap-2.5">
      <span className="mono grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-[11px] font-extrabold tabular-nums text-ink">
        {row.dueDate.slice(8, 10)}
      </span>
      <span className="min-w-0 flex-1">
        <Link
          href={`${basePath}/filings?cadence=monthly&period=${monthKey}${companyQuery}`}
          className="block truncate text-[12.5px] font-semibold text-ink hover:text-primary"
        >
          {row.particular}
        </Link>
        <span className="text-[11px] text-muted-foreground">
          {showCompany ? `${row.companyName} · ` : ''}
          {row.compliance} · {formatFilingDate(row.dueDate)}
        </span>
      </span>
      <FilingStatusPill status={filingStatus(row, now)} />
    </li>
  );
}
