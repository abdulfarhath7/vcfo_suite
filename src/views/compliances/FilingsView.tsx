'use client';

import { GlossaryText } from '@/components/ask/GlossaryTerm';
import { WhatsThisButton } from '@/components/ask/WhatsThisButton';
import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { CompanyPicker } from '@/components/admin/CompanyPicker';
import { Button } from '@/components/ui/button';
import { AreaPill } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { SkeletonRows } from '@/components/ui/empty-state';
import {
  PreIncorporationNotice,
  PreIncorporationPortfolioNote,
} from '@/components/compliances/PreIncorporationNotice';
import { useFilings } from '@/hooks/use-filings';
import {
  buildMatrix,
  filingStatus,
  financialYearForDate,
  financialYearLabel,
  financialYearMonths,
  financialYearQuarters,
  isFilingsCadence,
  monthKeyOf,
  monthLabelOf,
  parseFyParam,
  parseMonthParam,
  quarterForMonthKey,
  rowsForCadence,
  rowsInFinancialYear,
  rowsInMonth,
  sortByDueDate,
  type FilingRow,
  type FilingsCadence,
} from '@/lib/compliance/filings';
import { cn } from '@/lib/utils';
import {
  ALL_COMPANIES,
  isFilingStatusFilter,
  normaliseCompanyParam,
  pickedCompany,
  rowsForCompany,
  rowsForStatus,
  soleCompany,
  type ComplianceScope,
  type FilingStatusFilter,
} from '@/views/compliances/compliance-scope';
import {
  FILING_WORD,
  STATUS_FILTER_LABEL,
  STATUS_FILTER_ORDER,
  areaLabel,
  downloadCsv,
  emptyCounts,
  filingWord,
  plainDate,
  toCsv,
} from '@/views/compliances/spectrum-status';
import {
  CompactChip,
  DateTile,
  StatusBar,
  StatusDonutCard,
  Swatch,
  WordChip,
} from '@/views/compliances/spectrum-parts';
import { areaSwatch } from '@/views/compliances/area-swatch';
import { FilingProofCell, FilingWindowCell } from '@/views/compliances/filing-actions';
import { useMayWriteFilings } from '@/views/compliances/use-register';
import { HeadCard } from '@/views/compliances/grouped-grid';

/** The register shows a Client column only while more than one company is on the sheet. */
type RegisterColumnsMode = { company: boolean };
const ONE_COMPANY: RegisterColumnsMode = { company: false };
const ALL_AREAS = 'all';

/**
 * FILINGS — the compliance register, one view for every role (VCFO Spectrum).
 *
 * The caller passes its shell's base path (so links stay inside that role's
 * routes) and the `scope` it already holds. WHAT it shows is decided by
 * `getFilings`, which scopes by `AuthContext` — the client's register and the
 * super admin's are this component reading the same rows.
 *
 * Layout (prototype FilingsScreen, rules R-07, R-08, R-25): a status donut and
 * per-area bars for the period in view, area and status switches, then one
 * T1 grid whose head bar carries the company, period, year, cadence, full
 * year, export and calendar controls. URL state is unchanged: `?cadence=`,
 * `?status=`, `?company=`, `?period=`, `?fy=`, `?view=year`, plus `?area=`.
 *
 * The pre-COI notice appears for a company in `scope.preIncorporationIds`
 * (derived by the caller from `isIncorporated`); on "All companies" the
 * portfolio keeps its real rows and prints at most the one-line count.
 */
export function FilingsView({
  basePath,
  scope,
}: {
  basePath: string;
  scope: ComplianceScope;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const now = useMemo(() => new Date(), []);
  const { engagements } = scope;
  const sole = soleCompany(engagements);

  const cadenceParam = params.get('cadence');
  const cadence: FilingsCadence = isFilingsCadence(cadenceParam) ? cadenceParam : 'monthly';
  const fyFromUrl = parseFyParam(params.get('fy'));
  const periodParam = parseMonthParam(params.get('period'));
  const fullYear = params.get('view') === 'year';
  const companyId = sole ? sole.id : normaliseCompanyParam(params.get('company'), engagements);
  const statusParam = params.get('status');
  const statusFilter: FilingStatusFilter = isFilingStatusFilter(statusParam) ? statusParam : 'all';
  const areaParam = params.get('area')?.trim() || ALL_AREAS;

  const currentFy = financialYearForDate(now);
  // A `?period=` month decides the FY it belongs to, so a calendar cross-link
  // lands on the right sheet without needing both params.
  const fyStartYear =
    fyFromUrl ?? (periodParam ? financialYearForDate(new Date(`${periodParam}-01T00:00:00Z`)).startYear : currentFy.startYear);
  const monthKey = periodParam ?? monthKeyOf(now.toISOString())!;

  const query = useFilings({ fyStartYear });
  const allRows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);

  const months = useMemo(() => financialYearMonths(fyStartYear), [fyStartYear]);
  const quarters = useMemo(() => financialYearQuarters(fyStartYear), [fyStartYear]);
  const fyRows = useMemo(() => rowsInFinancialYear(allRows, fyStartYear), [allRows, fyStartYear]);
  const companyRows = useMemo(() => rowsForCompany(fyRows, companyId), [fyRows, companyId]);
  const cadenceRows = useMemo(() => rowsForCadence(companyRows, cadence), [companyRows, cadence]);
  const singleMonth = cadence === 'monthly' && !fullYear;
  // The period in view: one month on the monthly sheet, the whole year otherwise.
  const windowRows = useMemo(
    () => (singleMonth ? rowsInMonth(cadenceRows, monthKey) : cadenceRows),
    [singleMonth, cadenceRows, monthKey],
  );
  const areas = useMemo(
    () => [...new Set(windowRows.map((row) => row.compliance))].sort((a, b) => a.localeCompare(b)),
    [windowRows],
  );
  const area = areaParam !== ALL_AREAS && areas.includes(areaParam) ? areaParam : ALL_AREAS;
  const areaRows = useMemo(
    () => (area === ALL_AREAS ? windowRows : windowRows.filter((row) => row.compliance === area)),
    [windowRows, area],
  );
  const shownRows = useMemo(() => rowsForStatus(areaRows, statusFilter, now), [areaRows, statusFilter, now]);
  // The matrices plot every period, so they take the year's rows through the same filters.
  const matrixRows = useMemo(
    () => rowsForStatus(area === ALL_AREAS ? cadenceRows : cadenceRows.filter((row) => row.compliance === area), statusFilter, now),
    [cadenceRows, area, statusFilter, now],
  );

  const picked = pickedCompany(engagements, companyId);
  const pickedPreIncorporation = picked && scope.preIncorporationIds.has(picked.id) ? picked : null;
  const columnsMode: RegisterColumnsMode = { company: companyId === ALL_COMPANIES };

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null) search.delete(key);
      else search.set(key, value);
    }
    router.replace(`${basePath}/filings?${search.toString()}`, { scroll: false });
  };

  const monthIndex = months.findIndex((month) => month.key === monthKey);
  const stepMonth = (delta: number) => {
    const next = months[monthIndex + delta];
    if (next) setParams({ period: next.key, fy: String(fyStartYear) });
  };
  const canStepBack = monthIndex > 0;
  const canStepForward = monthIndex >= 0 && monthIndex < months.length - 1;

  const fyLabel = financialYearLabel(fyStartYear);
  const title =
    cadence === 'monthly'
      ? fullYear
        ? `Monthly · ${fyLabel}`
        : `Filings · ${monthLabelOf(monthKey)}`
      : cadence === 'quarterly'
        ? `Quarterly · ${fyLabel}`
        : `Annual · ${fyLabel}`;
  const periodShort = singleMonth ? monthLabelOf(monthKey) : fyLabel;
  const calendarQuery = picked && !sole ? `?company=${picked.id}` : '';
  const exportRows = singleMonth || cadence === 'annual' ? shownRows : matrixRows;

  const counts = useMemo(() => {
    const c = emptyCounts();
    for (const row of windowRows) c[filingStatus(row, now)] += 1;
    return c;
  }, [windowRows, now]);

  const filters = (
    <>
      {sole ? null : (
        <CompanyPicker
          engagements={engagements}
          value={companyId}
          allHint="Whole portfolio"
          onChange={(id) => setParams({ company: id === ALL_COMPANIES ? null : id })}
        />
      )}
      {singleMonth ? (
        <span className="inline-flex items-center">
          <Button size="icon" variant="quiet" className="h-7 w-7" disabled={!canStepBack} onClick={() => stepMonth(-1)} aria-label="Previous month">
            <ChevronLeft aria-hidden />
          </Button>
          <Button size="icon" variant="quiet" className="h-7 w-7" disabled={!canStepForward} onClick={() => stepMonth(1)} aria-label="Next month">
            <ChevronRight aria-hidden />
          </Button>
        </span>
      ) : null}
      <span className="inline-flex items-center gap-0.5 rounded-md border-1.5 border-line px-0.5">
        <Button size="icon" variant="quiet" className="h-6 w-6" onClick={() => setParams({ fy: String(fyStartYear - 1), period: null })} aria-label="Previous financial year">
          <ChevronLeft aria-hidden />
        </Button>
        <span className="px-1 text-[12.5px] font-medium tabular-nums text-ink">{fyLabel}</span>
        <Button
          size="icon"
          variant="quiet"
          className="h-6 w-6"
          disabled={fyStartYear >= currentFy.startYear + 2}
          onClick={() => setParams({ fy: String(fyStartYear + 1), period: null })}
          aria-label="Next financial year"
        >
          <ChevronRight aria-hidden />
        </Button>
      </span>
      <SpectrumTabs
        label="Filing cadence"
        items={[
          { key: 'monthly', label: 'Monthly' },
          { key: 'quarterly', label: 'Quarterly' },
          { key: 'annual', label: 'Annual' },
        ]}
        value={cadence}
        onChange={(next) => setParams({ cadence: next })}
      />
      {cadence === 'monthly' ? (
        <Button size="sm" variant="secondary" onClick={() => setParams({ view: fullYear ? null : 'year' })}>
          {fullYear ? 'This month' : 'Full year'}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        disabled={exportRows.length === 0}
        onClick={() => downloadCsv(`filings-${singleMonth ? monthKey : fyStartYear}.csv`, filingsCsv(exportRows, now))}
      >
        <Download aria-hidden />
        Export
      </Button>
      <Button size="sm" variant="secondary" asChild>
        <Link href={`${basePath}/calendar${calendarQuery}`}>
          <CalendarDays aria-hidden />
          Calendar
        </Link>
      </Button>
    </>
  );

  return (
    <PageTransition>
      <SEO
        title="Filings — VCFO Suite"
        description="The statutory filing register: monthly, quarterly and annual compliance sheets."
        path={`${basePath}/filings`}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <h1 className="sr-only">Filings</h1>

        {query.isPending ? null : (
          <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
            <StatusDonutCard counts={counts} caption="filings" label="Filings by status" />
            <AreaBreakdown
              rows={windowRows}
              now={now}
              title={`By area · ${periodShort}`}
              area={area}
              onArea={(next) => setParams({ area: next === area ? null : next })}
            />
          </div>
        )}

        {pickedPreIncorporation ? (
          <PreIncorporationNotice
            scope={{ audience: scope.audience, companyName: pickedPreIncorporation.companyName }}
          />
        ) : !picked ? (
          <PreIncorporationPortfolioNote count={scope.preIncorporationIds.size} />
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <SpectrumTabs
            label="Filter by area"
            items={[
              { key: ALL_AREAS, label: 'All', count: windowRows.length },
              ...areas.map((a) => ({ key: a, label: areaLabel(a), count: windowRows.filter((row) => row.compliance === a).length })),
            ]}
            value={area}
            onChange={(next) => setParams({ area: next === ALL_AREAS ? null : next })}
          />
          <SpectrumTabs
            label="Filter by status"
            className="sm:ml-auto"
            items={STATUS_FILTER_ORDER.map((status) => ({ key: status, label: STATUS_FILTER_LABEL[status] }))}
            value={statusFilter}
            onChange={(next) => setParams({ status: next === 'all' ? null : next })}
          />
        </div>

        <HeadCard title={title} count={query.isPending ? undefined : exportRows.length} right={filters}>
          {query.isPending ? (
            <div className="p-4" aria-busy="true" aria-label="Loading filings">
              <SkeletonRows rows={6} />
            </div>
          ) : query.isError ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-muted">Could not load the register. Try again in a moment.</p>
          ) : cadence === 'monthly' && fullYear ? (
            <PeriodMatrix
              rows={matrixRows}
              now={now}
              perCompany={columnsMode.company}
              columns={months.map((month) => ({
                key: month.key,
                label: month.shortLabel,
                emphasis: month.key === monthKeyOf(now.toISOString()),
              }))}
              periodOf={(row) => monthKeyOf(row.dueDate)}
            />
          ) : cadence === 'quarterly' ? (
            <PeriodMatrix
              rows={matrixRows}
              now={now}
              perCompany={columnsMode.company}
              showFiledRow
              columns={quarters.map((quarter) => ({
                key: quarter.key,
                label: quarter.label,
                sublabel: quarter.rangeLabel,
                emphasis: quarter.key === quarterForMonthKey(monthKeyOf(now.toISOString()) ?? '', fyStartYear)?.key,
              }))}
              periodOf={(row) => {
                const key = monthKeyOf(row.dueDate);
                return key ? (quarterForMonthKey(key, fyStartYear)?.key ?? null) : null;
              }}
            />
          ) : (
            <RegisterTable
              rows={shownRows}
              now={now}
              basePath={basePath}
              numbered={cadence === 'annual'}
              mode={columnsMode}
            />
          )}
        </HeadCard>
      </div>
    </PageTransition>
  );
}

// ---------------------------------------------------------------------------
// Head charts
// ---------------------------------------------------------------------------

/** R-25 C2: one stacked bar per area in status colours; a click narrows the table to that area. */
function AreaBreakdown({
  rows,
  now,
  title,
  area,
  onArea,
}: {
  rows: FilingRow[];
  now: Date;
  title: string;
  area: string;
  onArea: (area: string) => void;
}) {
  const byArea = useMemo(() => {
    const map = new Map<string, ReturnType<typeof emptyCounts>>();
    for (const row of rows) {
      const c = map.get(row.compliance) ?? emptyCounts();
      c[filingStatus(row, now)] += 1;
      map.set(row.compliance, c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, now]);

  return (
    <section className="surface px-5 py-4" aria-label="By area">
      <p className="mb-3 text-[15px] font-medium text-ink">{title}</p>
      {byArea.length === 0 ? (
        <p className="text-[13px] text-ink-faint">No filings in this period</p>
      ) : (
        <div className="grid gap-1.5">
          {byArea.map(([name, c]) => {
            const total = c.filed + c.overdue + c['due-soon'] + c.upcoming;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onArea(name)}
                aria-pressed={area === name}
                className={cn(
                  '-mx-1.5 grid grid-cols-[112px_minmax(0,1fr)_44px] items-center gap-3 rounded-sm px-1.5 py-0.5 text-left hover:bg-surface-sunken',
                  area === name && 'bg-brand-soft',
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink-2">
                  <Swatch className={areaSwatch(name)} />
                  <span className="truncate">{areaLabel(name)}</span>
                </span>
                <StatusBar counts={c} label={`${areaLabel(name)} · ${total} filings`} />
                <span className="text-right text-[12.5px] tabular-nums text-ink-muted">
                  {c.filed}/{total}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Register grid
// ---------------------------------------------------------------------------

const EMPTY_REGISTER = 'No filings in this period';

function filingsCsv(rows: FilingRow[], now: Date): string {
  return toCsv(
    ['Due', 'Client', 'Area', 'Filing', 'Period', 'Frequency', 'Filed on', 'Status'],
    sortByDueDate(rows).map((row) => [
      row.dueDate,
      row.companyName,
      areaLabel(row.compliance),
      row.particular,
      row.periodLabel,
      row.frequency,
      row.filedOn,
      filingWord(row, now),
    ]),
  );
}

function RegisterTable({
  rows,
  now,
  basePath,
  numbered,
  mode = ONE_COMPANY,
}: {
  rows: FilingRow[];
  now: Date;
  basePath: string;
  numbered?: boolean;
  mode?: RegisterColumnsMode;
}) {
  const mayWrite = useMayWriteFilings();
  const ordered = useMemo(() => sortByDueDate(rows), [rows]);
  const slNo = new Map(ordered.map((row, index) => [row.id, index + 1]));

  const columns: EFilingColumn<FilingRow>[] = [];
  if (numbered) {
    columns.push({ key: 'sl', header: 'No.', width: '52px', render: (row) => <span className="tabular-nums text-ink-muted">{slNo.get(row.id)}</span> });
  }
  columns.push(
    {
      key: 'due',
      header: 'Due',
      width: '68px',
      render: (row) => (
        <Link href={`${basePath}/calendar?date=${row.dueDate}`} aria-label={`Open ${plainDate(row.dueDate, now)} in the calendar`} className="inline-flex py-1">
          <DateTile iso={row.dueDate} status={filingStatus(row, now)} />
        </Link>
      ),
    },
    { key: 'area', header: 'Area', width: '124px', render: (row) => <AreaPill area={areaLabel(row.compliance)} /> },
    {
      key: 'filing',
      header: 'Filing',
      width: '30%',
      render: (row) => (
        <span className="block min-w-0" data-ask-focus={row.id}>
          <span className="flex min-w-0 items-center gap-1">
            <GlossaryText text={row.particular} className="truncate text-[14px] font-medium text-ink" />
            <WhatsThisButton compact kind="compliance" refId={row.obligationId} label={row.particular} />
          </span>
          <span className="block truncate text-[12.5px] text-ink-muted">
            {[row.periodLabel, row.authority].filter(Boolean).join(' · ')}
          </span>
        </span>
      ),
    },
  );
  if (mode.company) {
    columns.push({ key: 'company', header: 'Client', width: '16%', render: (row) => <span className="text-ink">{row.companyName}</span> });
  }
  columns.push(
    { key: 'frequency', header: 'Frequency', width: '108px', render: (row) => <span className="capitalize">{row.frequency}</span> },
    {
      key: 'filed',
      header: 'Filed on',
      width: '104px',
      render: (row) => {
        const status = filingStatus(row, now);
        return (
          <span className={status === 'overdue' ? 'font-medium text-danger' : row.filedOn ? 'text-ink' : 'text-ink-muted'}>
            {status === 'overdue' && !row.filedOn ? 'Not filed' : plainDate(row.filedOn, now)}
          </span>
        );
      },
    },
    { key: 'window', header: 'Window', width: '176px', render: (row) => <FilingWindowCell row={row} mayWrite={mayWrite} /> },
    { key: 'status', header: 'Status', width: '128px', render: (row) => <WordChip word={filingWord(row, now)} /> },
  );
  if (mayWrite) {
    columns.push({
      key: 'proof',
      header: 'Proof',
      width: '96px',
      align: 'right',
      render: (row) => <FilingProofCell row={row} />,
    });
  }

  return (
    <EFilingGrid
      caption="Filings"
      columns={columns}
      rows={ordered}
      rowKey={(row) => row.id}
      pageSize={25}
      minWidth={mode.company ? 1120 : 980}
      empty={EMPTY_REGISTER}
    />
  );
}

// ---------------------------------------------------------------------------
// The deck matrix — rows = compliance, columns = period
// ---------------------------------------------------------------------------

function PeriodMatrix({
  rows,
  now,
  perCompany,
  columns,
  periodOf,
  showFiledRow = false,
}: {
  rows: FilingRow[];
  now: Date;
  perCompany: boolean;
  columns: { key: string; label: string; sublabel?: string; emphasis?: boolean }[];
  periodOf: (row: FilingRow) => string | null;
  /** Quarterly deck splits each row into Due date / Filing date sub-rows. */
  showFiledRow?: boolean;
}) {
  const matrix = buildMatrix(rows, columns.map((c) => c.key), periodOf, now, { perCompany });

  if (matrix.length === 0) {
    return <p className="px-4 py-6 text-center text-[13px] text-ink-muted">{EMPTY_REGISTER}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="grid-table min-w-[44rem]">
        <thead>
          <tr>
            <th scope="col">Compliance</th>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn('!text-center', column.emphasis && '!text-brand-text')}>
                {column.label}
                {column.sublabel ? (
                  <span className="block text-[10px] font-medium normal-case tracking-normal text-ink-faint">{column.sublabel}</span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="!h-auto !border-b-line-soft !py-2.5 !text-[14px] !font-medium !normal-case !tracking-normal !text-ink">
                <span className="block">{row.particular}</span>
                <span className="mt-0.5 block text-[12px] font-normal text-ink-muted">
                  {row.companyName ? `${row.companyName} · ` : ''}
                  {areaLabel(row.compliance)}
                </span>
              </th>
              {row.cells.map((cell, index) => (
                <td key={columns[index]?.key ?? index} className={cn('!h-auto py-2.5 text-center', columns[index]?.emphasis && 'bg-brand-soft/40')}>
                  {cell.status ? (
                    <span className="flex flex-col items-center gap-1">
                      <span className="text-[12px] tabular-nums text-ink">{plainDate(cell.dueDate, now)}</span>
                      {showFiledRow ? (
                        <span className={cn('text-[12px] tabular-nums', cell.filedOn ? 'text-positive' : 'text-ink-muted')}>
                          {cell.filedOn ? plainDate(cell.filedOn, now) : '—'}
                        </span>
                      ) : (
                        <CompactChip word={FILING_WORD[cell.status]} />
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
