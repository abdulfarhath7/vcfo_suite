'use client';

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashSection } from '@/components/dash/DashSection';
import { DashDataTable, type DashColumn } from '@/components/dash/DashDataTable';
import { SegmentedPicker } from '@/components/admin/SegmentedPicker';
import { CompanyPicker } from '@/components/admin/CompanyPicker';
import { TONE_BADGE, toneForKey } from '@/components/common/IconChip';
import { FilingStatusPill } from '@/components/compliances/FilingStatusPill';
import {
  PreIncorporationNotice,
  PreIncorporationPortfolioNote,
} from '@/components/compliances/PreIncorporationNotice';
import { useFilings } from '@/lib/use-filings';
import {
  FILING_STATUS_LABEL,
  buildMatrix,
  filingStatus,
  financialYearForDate,
  financialYearLabel,
  financialYearMonths,
  financialYearQuarters,
  formatFilingDate,
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
} from '@/lib/filings';
import { cn } from '@/lib/utils';
import {
  ALL_COMPANIES,
  FILING_STATUS_FILTERS,
  isFilingStatusFilter,
  normaliseCompanyParam,
  pickedCompany,
  rowsForCompany,
  rowsForStatus,
  soleCompany,
  type ComplianceScope,
  type FilingStatusFilter,
} from '@/views/compliances/compliance-scope';

/** The register shows a Company column only while more than one company is on the sheet. */
type RegisterColumnsMode = { company: boolean };
const ONE_COMPANY: RegisterColumnsMode = { company: false };

/**
 * FILINGS — the compliance register, one view for every role.
 *
 * The caller passes its shell's base path (so links stay inside that role's
 * routes) and the `scope` it already holds. WHAT it shows is decided by
 * `getFilings`, which scopes by `AuthContext` — the client's register and the
 * super admin's are this component reading the same rows. Every shell gets
 * the same chrome: FY stepper, cadence and status filters (`?cadence=`,
 * `?status=`), the monthly / quarterly / annual sheets, the authority chip.
 * The company picker (`?company=`) and the Company column appear whenever
 * there is more than one company in scope; a sole company is implicit.
 *
 * Canonical pieces only: `DashSection` headers, `DashDataTable` rows,
 * `FilingStatusPill` (which is `TONE_BADGE`). No table, pill or panel variant
 * is invented here.
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

  const currentFy = financialYearForDate(now);
  // A `?period=` month decides the FY it belongs to, so a calendar cross-link
  // lands on the right sheet without needing both params.
  const fyStartYear =
    fyFromUrl ?? (periodParam ? financialYearForDate(new Date(`${periodParam}-01T00:00:00Z`)).startYear : currentFy.startYear);
  const monthKey = periodParam ?? monthKeyOf(now.toISOString())!;

  const query = useFilings({ fyStartYear });
  const allRows = query.data?.rows ?? [];

  const months = useMemo(() => financialYearMonths(fyStartYear), [fyStartYear]);
  const quarters = useMemo(() => financialYearQuarters(fyStartYear), [fyStartYear]);
  const fyRows = useMemo(() => rowsInFinancialYear(allRows, fyStartYear), [allRows, fyStartYear]);
  const companyRows = useMemo(() => rowsForCompany(fyRows, companyId), [fyRows, companyId]);
  const cadenceRows = useMemo(
    () => rowsForStatus(rowsForCadence(companyRows, cadence), statusFilter, now),
    [companyRows, cadence, statusFilter, now],
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

  return (
    <PageTransition>
      <SEO
        title="Filings — VCFO Suite"
        description="The statutory filing register: monthly, quarterly and annual compliance sheets."
        path={`${basePath}/filings`}
      />

      <div className="flex flex-col gap-3">
        <FilingsHeader
          basePath={basePath}
          fyLabel={financialYearLabel(fyStartYear)}
          onFyChange={(startYear) =>
            setParams({ fy: String(startYear), period: null })
          }
          fyStartYear={fyStartYear}
          currentFyStartYear={currentFy.startYear}
          calendarQuery={picked && !sole ? `?company=${picked.id}` : ''}
          picker={
            sole ? null : (
              <CompanyPicker
                engagements={engagements}
                value={companyId}
                allHint="Whole portfolio"
                onChange={(id) =>
                  setParams({ company: id === ALL_COMPANIES ? null : id })
                }
              />
            )
          }
        />

        {pickedPreIncorporation ? (
          <PreIncorporationNotice
            scope={{ audience: scope.audience, companyName: pickedPreIncorporation.companyName }}
          />
        ) : !picked ? (
          <PreIncorporationPortfolioNote count={scope.preIncorporationIds.size} />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedPicker
            value={cadence}
            options={[
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'annual', label: 'Annual' },
            ]}
            onChange={(next) => setParams({ cadence: next })}
            ariaLabel="Filing cadence"
            size="sm"
            className="max-w-sm"
          />
          <SegmentedPicker
            value={statusFilter}
            options={FILING_STATUS_FILTERS.map((status) => ({
              value: status,
              label: status === 'all' ? 'All' : FILING_STATUS_LABEL[status],
            }))}
            onChange={(next) => setParams({ status: next === 'all' ? null : next })}
            ariaLabel="Filter by status"
            size="sm"
            className="ml-auto inline-grid"
          />
        </div>

        {query.isPending ? (
          <FilingsSkeleton />
        ) : query.isError ? (
          <DashSection icon={FileSpreadsheet} title="Filings" tone="primary">
            <p className="text-[12.5px] text-muted-foreground">
              Could not load the register. Please try again in a moment.
            </p>
          </DashSection>
        ) : cadence === 'monthly' ? (
          <MonthlyTab
            rows={cadenceRows}
            months={months}
            monthKey={monthKey}
            fullYear={fullYear}
            now={now}
            basePath={basePath}
            columnsMode={columnsMode}
            onToggleFullYear={() => setParams({ view: fullYear ? null : 'year' })}
            onStepMonth={stepMonth}
            canStepBack={monthIndex > 0}
            canStepForward={monthIndex >= 0 && monthIndex < months.length - 1}
          />
        ) : cadence === 'quarterly' ? (
          <QuarterlyTab rows={cadenceRows} quarters={quarters} now={now} columnsMode={columnsMode} />
        ) : (
          <AnnualTab rows={cadenceRows} now={now} basePath={basePath} columnsMode={columnsMode} />
        )}
      </div>
    </PageTransition>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function FilingsHeader({
  basePath,
  fyLabel,
  fyStartYear,
  currentFyStartYear,
  onFyChange,
  calendarQuery = '',
  picker = null,
}: {
  basePath: string;
  fyLabel: string;
  fyStartYear: number;
  currentFyStartYear: number;
  onFyChange: (startYear: number) => void;
  /** Carries the narrowed company across to the calendar. */
  calendarQuery?: string;
  /** The `CompanyPicker`, when there is more than one company to pick. */
  picker?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <h1 className="serif min-w-0 flex-1 text-[22px] leading-tight tracking-tight text-foreground">
        Filings
      </h1>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1 py-0.5">
        <button
          type="button"
          aria-label="Previous financial year"
          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-raised hover:text-foreground"
          onClick={() => onFyChange(fyStartYear - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span className="mono px-1 text-[11.5px] font-bold tabular-nums text-ink">{fyLabel}</span>
        <button
          type="button"
          aria-label="Next financial year"
          disabled={fyStartYear >= currentFyStartYear + 2}
          className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-raised hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          onClick={() => onFyChange(fyStartYear + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {picker}
      <Link
        href={`${basePath}/calendar${calendarQuery}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-bold text-primary hover:bg-primary-light"
      >
        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
        Open calendar
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const EMPTY_REGISTER =
  'No filings recorded for this period. Your calendar fills in as each registration goes live.';

function registerColumns(
  now: Date,
  basePath: string,
  options?: { numbered?: boolean; mode?: RegisterColumnsMode },
): DashColumn<FilingRow>[] {
  const columns: DashColumn<FilingRow>[] = [];
  const mode = options?.mode ?? ONE_COMPANY;
  if (options?.numbered) {
    columns.push({
      key: 'sl',
      header: 'Sl No',
      width: 'minmax(0,0.35fr)',
      mono: true,
      render: () => null,
    });
  }
  if (mode.company) {
    columns.push({
      key: 'company',
      header: 'Company',
      width: 'minmax(0,1.2fr)',
      render: (row) => <span className="truncate text-ink">{row.companyName}</span>,
    });
  }
  columns.push(
    {
      key: 'compliance',
      header: 'Compliance',
      width: 'minmax(0,0.9fr)',
      render: (row) => (
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="text-ink">{row.compliance}</span>
          <AuthorityChip authority={row.authority} />
        </span>
      ),
    },
    {
      key: 'particular',
      header: 'Particular',
      width: 'minmax(0,1.5fr)',
      render: (row) => <span className="text-ink">{row.particular}</span>,
    },
    {
      key: 'due',
      header: 'Due Date',
      width: 'minmax(0,0.8fr)',
      mono: true,
      render: (row) => (
        <Link
          href={`${basePath}/calendar?date=${row.dueDate}`}
          className="text-primary hover:underline"
        >
          {formatFilingDate(row.dueDate)}
        </Link>
      ),
    },
    {
      key: 'filed',
      header: 'Filed Date',
      width: 'minmax(0,0.8fr)',
      mono: true,
      render: (row) => (
        <span className={row.filedOn ? 'text-ink' : 'text-muted-foreground'}>
          {formatFilingDate(row.filedOn)}
        </span>
      ),
    },
    {
      key: 'frequency',
      header: 'Frequency',
      width: 'minmax(0,0.7fr)',
      render: (row) => (
        <span className="capitalize text-muted-foreground">{row.frequency}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'auto',
      align: 'right',
      render: (row) => <FilingStatusPill status={filingStatus(row, now)} />,
    },
  );
  return columns;
}

/** The tracker's authority chip — `TONE_BADGE` keyed by authority, nothing new. */
function AuthorityChip({ authority }: { authority: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        TONE_BADGE[toneForKey(authority)],
      )}
    >
      {authority}
    </span>
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
  const ordered = sortByDueDate(rows);
  const slNo = new Map(ordered.map((row, index) => [row.id, index + 1]));
  const columns = registerColumns(now, basePath, { numbered, mode }).map((column) =>
    column.key === 'sl'
      ? { ...column, render: (row: FilingRow) => <span>{slNo.get(row.id)}</span> }
      : column,
  );

  return (
    <DashDataTable
      bare
      columns={columns}
      rows={ordered}
      rowKey={(row) => row.id}
      empty={EMPTY_REGISTER}
      mobile={(row) => (
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{row.particular}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {mode.company ? `${row.companyName} · ` : ''}
              {row.compliance} · due {formatFilingDate(row.dueDate)}
              {row.filedOn ? ` · filed ${formatFilingDate(row.filedOn)}` : ''}
            </p>
          </div>
          <FilingStatusPill status={filingStatus(row, now)} />
        </div>
      )}
    />
  );
}

function MonthlyTab({
  rows,
  months,
  monthKey,
  fullYear,
  now,
  basePath,
  columnsMode,
  onToggleFullYear,
  onStepMonth,
  canStepBack,
  canStepForward,
}: {
  rows: FilingRow[];
  months: ReturnType<typeof financialYearMonths>;
  monthKey: string;
  fullYear: boolean;
  now: Date;
  basePath: string;
  columnsMode: RegisterColumnsMode;
  onToggleFullYear: () => void;
  onStepMonth: (delta: number) => void;
  canStepBack: boolean;
  canStepForward: boolean;
}) {
  const monthRows = useMemo(() => rowsInMonth(rows, monthKey), [rows, monthKey]);
  const matrix = useMemo(
    () =>
      buildMatrix(rows, months.map((m) => m.key), (row) => monthKeyOf(row.dueDate), now, {
        perCompany: columnsMode.company,
      }),
    [rows, months, now, columnsMode.company],
  );
  const currentMonthKey = monthKeyOf(now.toISOString());

  return (
    <DashSection
      icon={FileSpreadsheet}
      title={fullYear ? 'Monthly · full year' : `Monthly · ${monthLabelOf(monthKey)}`}
      tone="primary"
      meta={
        <button
          type="button"
          onClick={onToggleFullYear}
          className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold text-primary hover:bg-primary-light"
        >
          {fullYear ? 'This month' : 'Full year'}
        </button>
      }
      bodyClassName="px-0 pb-0 pt-0"
    >
      {fullYear ? (
        <PeriodMatrix
          matrix={matrix}
          columns={months.map((month) => ({
            key: month.key,
            label: month.shortLabel,
            emphasis: month.key === currentMonthKey,
          }))}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2">
            <button
              type="button"
              disabled={!canStepBack}
              onClick={() => onStepMonth(-1)}
              className="inline-flex items-center gap-1 text-[11.5px] font-bold text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Previous
            </button>
            <span className="mono text-[11.5px] font-bold tabular-nums text-ink">
              {monthLabelOf(monthKey)}
            </span>
            <button
              type="button"
              disabled={!canStepForward}
              onClick={() => onStepMonth(1)}
              className="inline-flex items-center gap-1 text-[11.5px] font-bold text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <RegisterTable rows={monthRows} now={now} basePath={basePath} mode={columnsMode} />
        </>
      )}
    </DashSection>
  );
}

function QuarterlyTab({
  rows,
  quarters,
  now,
  columnsMode,
}: {
  rows: FilingRow[];
  quarters: ReturnType<typeof financialYearQuarters>;
  now: Date;
  columnsMode: RegisterColumnsMode;
}) {
  const startYear = Number.parseInt(quarters[0]?.key.slice(0, 4) ?? '0', 10);
  const matrix = useMemo(
    () =>
      buildMatrix(
        rows,
        quarters.map((quarter) => quarter.key),
        (row) => {
          const key = monthKeyOf(row.dueDate);
          return key ? (quarterForMonthKey(key, startYear)?.key ?? null) : null;
        },
        now,
        { perCompany: columnsMode.company },
      ),
    [rows, quarters, startYear, now, columnsMode.company],
  );
  const currentQuarter = quarterForMonthKey(monthKeyOf(now.toISOString()) ?? '', startYear);

  return (
    <DashSection
      icon={FileSpreadsheet}
      title="Quarterly"
      tone="sky"
      bodyClassName="px-0 pb-0 pt-0"
    >
      <PeriodMatrix
        matrix={matrix}
        showFiledRow
        columns={quarters.map((quarter) => ({
          key: quarter.key,
          label: quarter.label,
          sublabel: quarter.rangeLabel,
          emphasis: quarter.key === currentQuarter?.key,
        }))}
      />
    </DashSection>
  );
}

function AnnualTab({
  rows,
  now,
  basePath,
  columnsMode,
}: {
  rows: FilingRow[];
  now: Date;
  basePath: string;
  columnsMode: RegisterColumnsMode;
}) {
  return (
    <DashSection
      icon={FileSpreadsheet}
      title="Annual"
      tone="violet"
      bodyClassName="px-0 pb-0 pt-0"
    >
      <RegisterTable rows={rows} now={now} basePath={basePath} numbered mode={columnsMode} />
    </DashSection>
  );
}

// ---------------------------------------------------------------------------
// The deck matrix — rows = compliance, columns = period
// ---------------------------------------------------------------------------

function PeriodMatrix({
  matrix,
  columns,
  showFiledRow = false,
}: {
  matrix: ReturnType<typeof buildMatrix>;
  columns: { key: string; label: string; sublabel?: string; emphasis?: boolean }[];
  /** Quarterly deck splits each row into Due date / Filing date sub-rows. */
  showFiledRow?: boolean;
}) {
  if (matrix.length === 0) {
    return (
      <p className="px-3.5 py-6 text-center text-[12.5px] text-muted-foreground">
        {EMPTY_REGISTER}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-text-tertiary">
            <th scope="col" className="px-3.5 py-2.5 text-left font-extrabold">
              Compliance
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-2 py-2.5 text-center font-extrabold',
                  column.emphasis && 'text-primary',
                )}
              >
                {column.label}
                {column.sublabel ? (
                  <span className="mt-0.5 block text-[9px] font-bold normal-case tracking-normal text-muted-foreground">
                    {column.sublabel}
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.key} className="border-t border-border align-top">
              <th scope="row" className="px-3.5 py-3 text-left font-semibold text-ink">
                <span className="block">{row.particular}</span>
                <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                  {row.companyName ? `${row.companyName} · ` : ''}
                  {row.compliance}
                </span>
              </th>
              {row.cells.map((cell, index) => (
                <td
                  key={columns[index]?.key ?? index}
                  className={cn(
                    'px-2 py-3 text-center',
                    columns[index]?.emphasis && 'bg-primary-light/40',
                  )}
                >
                  {cell.status ? (
                    <span className="flex flex-col items-center gap-1">
                      <span className="mono text-[11px] tabular-nums text-ink">
                        {formatFilingDate(cell.dueDate)}
                      </span>
                      {showFiledRow ? (
                        <span
                          className={cn(
                            'mono text-[11px] tabular-nums',
                            cell.filedOn ? 'text-success-text' : 'text-muted-foreground',
                          )}
                        >
                          {formatFilingDate(cell.filedOn)}
                        </span>
                      ) : (
                        <FilingStatusPill status={cell.status} />
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
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

function FilingsSkeleton() {
  return (
    <div className="surface overflow-hidden" aria-busy="true" aria-label="Loading filings">
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-9 animate-pulse rounded-md bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
