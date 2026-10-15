'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { CalendarLayoutStudio } from '@/views/compliances/CalendarLayoutStudio';
import { useFilings } from '@/lib/use-filings';
import { financialYearForDate, monthKeyForDate, parseIsoDate, rowsInMonth, sortByDueDate } from '@/lib/filings';
import {
  ALL_COMPANIES,
  normaliseCompanyParam,
  rowsForCompany,
  soleCompany,
  type ComplianceScope,
} from '@/views/compliances/compliance-scope';

/**
 * COMPLIANCE CALENDAR — one page for every role.
 *
 * A year of month cards, then the open month: the list beside the grid.
 * Scope still comes from `getFilings` and the roster. Acts and due dates
 * stay the VCFO statutory calendar.
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

        <CalendarLayoutStudio
          basePath={basePath}
          scope={scope}
          month={month}
          onMonthChange={setMonth}
          companyId={companyId}
          onCompanyChange={setPickedId}
          filings={monthRows}
          filingsPending={query.isPending}
          companyQuery={companyQuery}
          showCompany={showCompany}
          now={now}
        />
      </div>
    </PageTransition>
  );
}
