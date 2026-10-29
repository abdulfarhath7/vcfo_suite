'use client';

import { GlossaryText } from '@/components/ask/GlossaryTerm';
import { WhatsThisButton } from '@/components/ask/WhatsThisButton';
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, BellRing, CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Clock, Download } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { DashSection } from '@/components/dash/DashSection';
import { CompanyPicker } from '@/components/admin/CompanyPicker';
import { Button } from '@/components/ui/button';
import { AreaPill } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { SkeletonRows } from '@/components/ui/empty-state';
import { FilterChip, FilterChipRow, type FilterRowChip } from '@/components/ui/filter-chip';
import { Term } from '@/components/ui/term';
import { initialsOf } from '@/components/ui/avatar-stack';
import type { BulkAction } from '@/components/ui/bulk-bar';
import { OnTimeColumns } from '@/components/compliances/OnTimeColumns';
import {
  PreIncorporationNotice,
  PreIncorporationPortfolioNote,
} from '@/components/compliances/PreIncorporationNotice';
import { useApp } from '@/context/AppContext';
import { useFilings } from '@/hooks/use-filings';
import { useCompFilings } from '@/components/client-portal/pages/compliances/api';
import { toastError, toastInfo, toastSuccess } from '@/lib/toast-errors';
import type { PortalFiling } from '@/lib/client-portal/compliances';
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
  normaliseCompanyParam,
  pickedCompany,
  rowsForCompany,
  soleCompany,
  type ComplianceScope,
} from '@/views/compliances/compliance-scope';
import {
  FILING_WORD,
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
  FiledBar,
  FilingBand,
  FilterStrip,
  StatusDonutCard,
  Swatch,
  WordChip,
  type StripItem,
} from '@/views/compliances/spectrum-parts';
import { areaSwatch } from '@/views/compliances/area-swatch';
import { FilingProofCell, FilingWindowCell } from '@/views/compliances/filing-actions';
import { useMayWriteFilings, useRegister } from '@/views/compliances/use-register';
import { GroupedGrid, HeadCard, type GridColumn, type GridGroup } from '@/views/compliances/grouped-grid';
import {
  BOARD_STATUS_OPTIONS,
  REGULATORS,
  groupByClient,
  groupByFiling,
  isBoardTile,
  matchesStatus,
  matchesTile,
  noteFor,
  onTimeByMonth,
  parseBoardStatus,
  parseRegulator,
  regulatorCounts,
  regulatorOf,
  tileCounts,
  type BoardGroup,
  type BoardTile,
} from '@/views/compliances/filings-board';

/** The register shows a Client column only while more than one company is on the sheet. */
type RegisterColumnsMode = { company: boolean };
const ONE_COMPANY: RegisterColumnsMode = { company: false };

/** The three views of the list (C-05): grouped by filing (default), grouped by client, or the flat register. */
type BoardTab = 'filing' | 'client' | 'all';

const TILE_LABEL: Record<Exclude<BoardTile, ''>, string> = {
  month: 'Due this month',
  filed: 'Filed this month',
  week: 'Due in 7 days',
  late: 'Overdue',
};

/** Staff roles that may send a client reminder (`POST /api/engagements/:id/remind`). */
const REMIND_ROLES = new Set(['super_admin', 'admin', 'manager', 'intern']);

/** Months in the "On time vs late" columns. */
const ON_TIME_MONTHS = 6;

/**
 * FILINGS — the compliance register, one view for every role (VCFO Spectrum
 * C-05 to C-07, C-0118, C-0121).
 *
 * The caller passes its shell's base path (so links stay inside that role's
 * routes) and the `scope` it already holds. WHAT it shows is decided by
 * `getFilings`, which scopes by `AuthContext` — the client's register and the
 * super admin's are this component reading the same rows.
 *
 * Layout (prototype FilingsScreen): underline tabs By filing (default), By
 * client and All filings; four KPI tiles that each toggle their filter; filter
 * chips for regulator, status and lead; then the list, whose head bar keeps the
 * company, period, year, cadence, full year, export and calendar controls. "By
 * filing" bands each filing (one obligation and due date) with its client rows,
 * "By client" bands each company, and "All filings" is the flat register (with
 * row selection and the bulk bar) or the year and quarter matrices. The rail
 * has "On time vs late" (C4), "By regulator" for all six regulators, and the
 * status donut.
 *
 * URL state: `?tab=`, `?kpi=`, `?area=` (a regulator), `?status=`, `?lead=`,
 * plus the old `?cadence=`, `?company=`, `?period=`, `?fy=`, `?view=year`.
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
  const { user, internOptions, teamMembers } = useApp();
  const { engagements } = scope;
  const sole = soleCompany(engagements);

  const cadenceParam = params.get('cadence');
  const cadence: FilingsCadence = isFilingsCadence(cadenceParam) ? cadenceParam : 'monthly';
  const fyFromUrl = parseFyParam(params.get('fy'));
  const periodParam = parseMonthParam(params.get('period'));
  const fullYear = params.get('view') === 'year';
  const companyId = sole ? sole.id : normaliseCompanyParam(params.get('company'), engagements);
  const tabParam = params.get('tab');
  const tab: BoardTab = tabParam === 'client' || tabParam === 'all' ? tabParam : 'filing';
  const tileParam = params.get('kpi');
  const tile: BoardTile = isBoardTile(tileParam) ? tileParam : '';
  const regulator = parseRegulator(params.get('area'));
  const status = parseBoardStatus(params.get('status'));
  const leadParam = params.get('lead')?.trim() ?? '';

  const currentFy = financialYearForDate(now);
  // A `?period=` month decides the FY it belongs to, so a calendar cross-link
  // lands on the right sheet without needing both params.
  const fyStartYear =
    fyFromUrl ?? (periodParam ? financialYearForDate(new Date(`${periodParam}-01T00:00:00Z`)).startYear : currentFy.startYear);
  const monthKey = periodParam ?? monthKeyOf(now.toISOString())!;
  const nowMonthKey = monthKeyOf(now.toISOString())!;

  const query = useFilings({ fyStartYear });
  const allRows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  // The side-table facts (ARN, data received, preparing) for the Note column.
  const facts = useCompFilings(fyStartYear);
  const details = useMemo(() => {
    const map = new Map<string, PortalFiling>();
    for (const f of facts.data?.rows ?? []) map.set(f.id, f);
    return map;
  }, [facts.data?.rows]);
  // This FY and the last, for the "On time vs late" months (the cache Obligations shares).
  const history = useRegister(now);

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
  // A KPI tile counts the company's whole sheet, so a picked tile replaces the period window.
  const baseRows = useMemo(
    () => (tile ? companyRows.filter((row) => matchesTile(row, tile, now)) : windowRows),
    [tile, companyRows, windowRows, now],
  );

  // Lead of each row: the engagement's lead, named from the team list.
  const leadIdOf = useMemo(() => new Map(engagements.map((e) => [e.id, e.internId ?? ''])), [engagements]);
  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of [...internOptions, ...teamMembers]) if (p?.id && !map.has(p.id)) map.set(p.id, p.name);
    return map;
  }, [internOptions, teamMembers]);
  const leadName = (row: FilingRow) => people.get(leadIdOf.get(row.engagementId) ?? '') ?? '';
  const showLead = user?.role !== 'intern' && scope.audience === 'staff';
  const leadOptions = useMemo(() => {
    const ids = new Set(baseRows.map((row) => leadIdOf.get(row.engagementId) ?? '').filter(Boolean));
    return [...ids]
      .map((id) => ({ value: id, label: people.get(id) ?? '' }))
      .filter((o) => o.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [baseRows, leadIdOf, people]);
  const lead = showLead && leadOptions.some((o) => o.value === leadParam) ? leadParam : '';

  const chipMatch = (row: FilingRow, withRegulator = true) =>
    (!withRegulator || !regulator || regulatorOf(row) === regulator) &&
    matchesStatus(row, status, now) &&
    (!lead || leadIdOf.get(row.engagementId) === lead);
  const shownRows = baseRows.filter((row) => chipMatch(row));
  // The matrices plot every period, so they take the year's rows through the same filters.
  const matrixRows = cadenceRows.filter((row) => chipMatch(row));
  const useMatrix = tab === 'all' && !tile && (cadence === 'quarterly' || (cadence === 'monthly' && fullYear));

  const picked = pickedCompany(engagements, companyId);
  const pickedPreIncorporation = picked && scope.preIncorporationIds.has(picked.id) ? picked : null;
  const columnsMode: RegisterColumnsMode = { company: companyId === ALL_COMPANIES };

  const setParams = (next: Record<string, string | null>) => {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') search.delete(key);
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
  const title = tile
    ? `${TILE_LABEL[tile]} · ${tile === 'month' || tile === 'filed' ? monthLabelOf(nowMonthKey) : fyLabel}`
    : cadence === 'monthly'
      ? fullYear
        ? `Monthly · ${fyLabel}`
        : `Filings · ${monthLabelOf(monthKey)}`
      : cadence === 'quarterly'
        ? `Quarterly · ${fyLabel}`
        : `Annual · ${fyLabel}`;
  const periodShort = tile ? TILE_LABEL[tile] : singleMonth ? monthLabelOf(monthKey) : fyLabel;
  const calendarQuery = picked && !sole ? `?company=${picked.id}` : '';
  const exportRows = useMatrix ? matrixRows : shownRows;

  const counts = useMemo(() => {
    const c = emptyCounts();
    for (const row of baseRows) c[filingStatus(row, now)] += 1;
    return c;
  }, [baseRows, now]);

  // C-06: the four tiles count the company's sheet for this financial year.
  const kpi = useMemo(() => tileCounts(companyRows, now), [companyRows, now]);
  const strip: StripItem[] = [
    { key: 'month', label: 'Due this month', value: kpi.month, Icon: CalendarDays, valueClass: 'text-brand-text' },
    { key: 'filed', label: 'Filed', value: kpi.filed, Icon: CircleCheck, valueClass: 'text-positive' },
    { key: 'week', label: 'Due in 7 days', value: kpi.week, Icon: Clock, valueClass: 'text-warning' },
    { key: 'late', label: 'Overdue', value: kpi.late, Icon: AlertTriangle, valueClass: 'text-danger' },
  ];

  const byFiling = groupByFiling(baseRows, shownRows, now);
  const byClient = groupByClient(baseRows, shownRows, now);
  // The regulator bars ignore the regulator chip, so every bar stays a way to switch to it.
  const regulators = regulatorCounts(baseRows.filter((row) => chipMatch(row, false)), now);
  const historyRows = useMemo(() => rowsForCompany(history.rows, companyId), [history.rows, companyId]);
  const onTime = useMemo(() => onTimeByMonth(historyRows, now, ON_TIME_MONTHS), [historyRows, now]);
  const onTimeFiled = onTime.reduce((n, m) => n + m.onTime + m.late, 0);
  const onTimePct = onTimeFiled ? Math.round((onTime.reduce((n, m) => n + m.onTime, 0) / onTimeFiled) * 100) : null;

  const anyFilter = !!(regulator || status || lead || tile);
  const clearAll = () => setParams({ area: null, status: null, lead: null, kpi: null });

  const recordHref = (row: FilingRow) =>
    `${basePath}/obligations/${encodeURIComponent(row.obligationId)}${sole ? '' : `?company=${encodeURIComponent(row.engagementId)}`}`;

  // E-01: Remind through the one-click reminder route, one filing at a time, then one toast.
  const mayRemind = scope.audience === 'staff' && REMIND_ROLES.has(user?.role ?? '');
  const [reminding, setReminding] = useState(false);
  const remindRows = async (rows: FilingRow[]) => {
    const open = rows.filter((row) => !row.filedOn);
    if (open.length === 0) {
      toastInfo(rows.length === 1 ? 'Already filed' : 'These filings are already filed');
      return;
    }
    setReminding(true);
    let sent = 0;
    let limited = 0;
    let failed = 0;
    for (const row of open) {
      try {
        const res = await fetch(`/api/engagements/${encodeURIComponent(row.engagementId)}/remind`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemKey: `filing:${row.id}` }),
        });
        if (res.ok) sent += 1;
        else if (res.status === 429) limited += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    setReminding(false);
    const many = (n: number) => `${n} ${n === 1 ? 'filing' : 'filings'}`;
    const rest = [limited ? `${many(limited)} already reminded today` : '', failed ? `${many(failed)} could not be sent` : '']
      .filter(Boolean)
      .join(' · ');
    if (sent) toastSuccess(sent === 1 && open.length === 1 ? `Reminder sent · ${open[0]!.particular}` : `Reminders sent · ${many(sent)}`, rest || undefined);
    else if (failed) toastError('Could not send the reminders', rest);
    else toastInfo('Already reminded today', rest);
  };
  const bulkActions = (rows: FilingRow[]): BulkAction[] => [
    ...(mayRemind ? [{ key: 'remind', label: 'Remind', icon: BellRing, disabled: reminding, onClick: () => void remindRows(rows) }] : []),
    {
      key: 'export',
      label: 'Export',
      icon: Download,
      onClick: () => downloadCsv(`filings-selected-${rows.length}.csv`, filingsCsv(rows, now)),
    },
  ];

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
      {singleMonth && !tile ? (
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
        onChange={(next) => setParams({ cadence: next, kpi: null })}
      />
      {cadence === 'monthly' ? (
        <Button size="sm" variant="secondary" onClick={() => setParams({ view: fullYear ? null : 'year', kpi: null })}>
          {fullYear ? 'This month' : 'Full year'}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        disabled={exportRows.length === 0}
        onClick={() => downloadCsv(`filings-${tile || (singleMonth ? monthKey : fyStartYear)}.csv`, filingsCsv(exportRows, now))}
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

  /* ---------- Client rows under a band ---------- */

  const actionCol: GridColumn<FilingRow> = {
    key: 'action',
    label: '',
    width: 104,
    align: 'right',
    className: 'hidden md:table-cell',
    render: (row) => <FilingAction row={row} now={now} href={recordHref(row)} />,
  };
  const statusCol: GridColumn<FilingRow> = { key: 'status', label: 'Status', width: 128, render: (row) => <WordChip word={filingWord(row, now)} /> };
  const noteCol: GridColumn<FilingRow> = {
    key: 'note',
    label: 'Note',
    width: 160,
    className: 'hidden md:table-cell',
    render: (row) => {
      const note = noteFor(row, details.get(row.id), now);
      const st = filingStatus(row, now);
      return note ? (
        <span className={cn('block max-w-[150px] truncate', st === 'overdue' ? 'font-medium text-danger' : st === 'due-soon' ? 'text-warning' : 'text-ink-2')} title={note}>
          {note}
        </span>
      ) : (
        <span className="text-ink-faint">—</span>
      );
    },
  };
  const leadCol: GridColumn<FilingRow> = {
    key: 'lead',
    label: 'Lead',
    width: 160,
    className: 'hidden md:table-cell',
    render: (row) => {
      const name = leadName(row);
      return name ? (
        <span className="inline-flex min-w-0 max-w-[150px] items-center gap-2">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-soft text-[11px] font-medium text-brand-text" aria-hidden>
            {initialsOf(name)}
          </span>
          <span className="min-w-0 truncate">{name}</span>
        </span>
      ) : (
        <span className="text-ink-faint">—</span>
      );
    },
  };
  const filingCols: GridColumn<FilingRow>[] = [
    {
      key: 'client',
      label: 'Filing · client',
      render: (row) => <span className="block min-w-0 truncate font-medium text-ink md:pl-[56px]">{row.companyName}</span>,
    },
    ...(showLead ? [leadCol] : []),
    noteCol,
    statusCol,
    actionCol,
  ];
  const clientCols: GridColumn<FilingRow>[] = [
    {
      key: 'filing',
      label: 'Client · filing',
      render: (row) => (
        <span className="block min-w-0 md:pl-[42px]">
          <b className="block truncate text-[14px] font-medium text-ink">{row.particular}</b>
          <span className="block truncate text-[12.5px] text-ink-muted">
            {[row.periodLabel, `due ${plainDate(row.dueDate, now)}`].filter(Boolean).join(' · ')}
          </span>
        </span>
      ),
    },
    { key: 'area', label: 'Area', width: 124, className: 'hidden md:table-cell', render: (row) => <AreaPill area={areaLabel(row.compliance)} /> },
    noteCol,
    statusCol,
    actionCol,
  ];

  const filingGroups: GridGroup<FilingRow>[] = byFiling.map((g: BoardGroup) => ({
    id: g.key,
    label: g.label,
    rows: g.rows,
    head: (
      <FilingBand
        iso={g.first.dueDate}
        status={g.status}
        name={<Term>{g.first.particular}</Term>}
        sub={[g.first.periodLabel, `due ${plainDate(g.first.dueDate, now)}`].filter(Boolean).join(' · ')}
        area={areaLabel(g.first.compliance)}
        filed={g.filed}
        total={g.total}
      />
    ),
  }));
  const clientGroups: GridGroup<FilingRow>[] = byClient.map((g: BoardGroup) => {
    const name = leadName(g.first);
    return {
      id: g.key,
      label: g.label,
      rows: g.rows,
      head: (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3.5 gap-y-2">
          <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-md bg-brand-soft text-[12px] font-medium text-brand-text" aria-hidden>
            {initialsOf(g.label)}
          </span>
          <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
            <span className="truncate text-[14.5px] font-medium text-ink">{g.label}</span>
            {name ? <span className="text-[12.5px] text-ink-muted">Lead {name}</span> : null}
          </span>
          <FiledBar filed={g.filed} total={g.total} />
        </span>
      ),
    };
  });
  const groupCount = (groups: BoardGroup[]) => groups.filter((g) => g.rows.length > 0).length;

  const chips: FilterRowChip[] = [
    {
      key: 'area',
      set: !!regulator,
      node: (
        <FilterChip
          label="Regulator"
          value={regulator}
          options={REGULATORS.map((r) => ({ value: r.key, label: r.label }))}
          onChange={(v) => setParams({ area: v || null })}
        />
      ),
    },
    {
      key: 'status',
      set: !!status,
      node: <FilterChip label="Status" value={status} options={BOARD_STATUS_OPTIONS} onChange={(v) => setParams({ status: v || null })} />,
    },
    ...(showLead && leadOptions.length > 0
      ? [
          {
            key: 'lead',
            set: !!lead,
            node: <FilterChip label="Lead" value={lead} options={leadOptions} onChange={(v) => setParams({ lead: v || null })} />,
          },
        ]
      : []),
  ];

  const loadingCard = (
    <HeadCard title={title} right={filters}>
      <div className="p-4" aria-busy="true" aria-label="Loading filings">
        <SkeletonRows rows={6} />
      </div>
    </HeadCard>
  );
  const errorCard = (
    <HeadCard title={title} right={filters}>
      <p className="px-4 py-6 text-center text-[13px] text-ink-muted">Could not load the register. Try again in a moment.</p>
    </HeadCard>
  );

  let list: ReactNode;
  if (query.isPending) list = loadingCard;
  else if (query.isError) list = errorCard;
  else if (tab === 'filing' || tab === 'client')
    list = (
      <GroupedGrid
        title={title}
        right={filters}
        columns={tab === 'filing' ? filingCols : clientCols}
        groups={tab === 'filing' ? filingGroups : clientGroups}
        rowKey={(row) => row.id}
        rowHref={recordHref}
        pageSize={60}
        empty={anyFilter ? 'No filings match' : EMPTY_REGISTER}
      />
    );
  else
    list = (
      <HeadCard title={title} count={exportRows.length} right={filters}>
        {cadence === 'monthly' && fullYear && useMatrix ? (
          <PeriodMatrix
            rows={matrixRows}
            now={now}
            perCompany={columnsMode.company}
            columns={months.map((month) => ({
              key: month.key,
              label: month.shortLabel,
              emphasis: month.key === nowMonthKey,
            }))}
            periodOf={(row) => monthKeyOf(row.dueDate)}
          />
        ) : cadence === 'quarterly' && useMatrix ? (
          <PeriodMatrix
            rows={matrixRows}
            now={now}
            perCompany={columnsMode.company}
            showFiledRow
            columns={quarters.map((quarter) => ({
              key: quarter.key,
              label: quarter.label,
              sublabel: quarter.rangeLabel,
              emphasis: quarter.key === quarterForMonthKey(nowMonthKey, fyStartYear)?.key,
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
            numbered={cadence === 'annual' && !tile}
            mode={columnsMode}
            bulkActions={bulkActions}
            onClearFilters={anyFilter ? clearAll : undefined}
          />
        )}
      </HeadCard>
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

        <SpectrumTabs
          variant="underline"
          label="Filings view"
          items={[
            { key: 'filing', label: 'By filing', count: query.isPending ? undefined : groupCount(byFiling) },
            { key: 'client', label: 'By client', count: query.isPending ? undefined : groupCount(byClient) },
            { key: 'all', label: 'All filings', count: query.isPending ? undefined : exportRows.length },
          ]}
          value={tab}
          onChange={(next) => setParams({ tab: next === 'filing' ? null : next })}
        />

        <FilterStrip items={strip} value={tile} onChange={(k) => setParams({ kpi: k || null })} />

        {pickedPreIncorporation ? (
          <PreIncorporationNotice
            scope={{ audience: scope.audience, companyName: pickedPreIncorporation.companyName }}
          />
        ) : !picked ? (
          <PreIncorporationPortfolioNote count={scope.preIncorporationIds.size} />
        ) : null}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid min-w-0 gap-3">
            <FilterChipRow chips={chips} onClear={anyFilter ? clearAll : undefined} />
            {list}
          </div>

          <div className="grid min-w-0 gap-3">
            <DashSection
              title="On time vs late"
              meta={onTimePct === null ? undefined : `${onTimePct}% on time`}
              loading={history.isPending}
              loadingVariant="block"
            >
              {onTimeFiled ? (
                <OnTimeColumns data={onTime} />
              ) : (
                <p className="text-[13px] text-ink-faint">No filing recorded in the last {ON_TIME_MONTHS} months</p>
              )}
            </DashSection>
            <DashSection title="By regulator" meta={periodShort} loading={query.isPending}>
              <div className="grid gap-1">
                {regulators.map((r) => {
                  const pct = r.total ? Math.round((r.filed / r.total) * 100) : 0;
                  const on = regulator === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setParams({ area: on ? null : r.key })}
                      aria-pressed={on}
                      aria-label={`${r.label}: ${r.filed} of ${r.total} filed. Filter by ${r.label}`}
                      className={cn(
                        '-mx-1.5 flex items-center gap-2.5 rounded-sm px-1.5 py-1 text-left hover:bg-surface-sunken',
                        on && 'bg-brand-soft',
                      )}
                    >
                      <Swatch className={areaSwatch(r.label)} />
                      <span className="flex-1 text-[13.5px] text-ink">{r.label}</span>
                      <span className={cn('text-[13px] tabular-nums', r.total ? 'text-ink-muted' : 'text-ink-faint')}>
                        {r.filed} / {r.total}
                      </span>
                      <span className="relative h-1.5 w-[90px] flex-none overflow-hidden rounded-bar bg-surface-sunken" aria-hidden>
                        <i className={cn('absolute inset-y-0 left-0 rounded-bar', areaSwatch(r.label))} style={{ width: `${pct}%` }} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </DashSection>
            {query.isPending ? null : <StatusDonutCard counts={counts} caption="filings" label="Filings by status" />}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

/**
 * The row action of a client row (prototype `FilingAction`): "File now" on a
 * filing that is late, due soon or in progress, "Open" otherwise. Both open the
 * filing's record (the obligation page for that client), where the window,
 * proofs and ARN are set; there is no new write path here. A late row gets the
 * blurple main button, every other row the white one.
 */
function FilingAction({ row, now, href }: { row: FilingRow; now: Date; href: string }) {
  const st = filingStatus(row, now);
  const fileNow = st !== 'filed' && st !== 'upcoming';
  const label = fileNow ? 'File now' : 'Open';
  return (
    <Button size="sm" variant={st === 'overdue' ? 'default' : 'outline'} className="h-[30px]" asChild>
      <Link href={href} aria-label={`${label}: ${row.particular}${row.periodLabel ? ` ${row.periodLabel}` : ''}, ${row.companyName}`}>
        {label}
      </Link>
    </Button>
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
  bulkActions,
  onClearFilters,
}: {
  rows: FilingRow[];
  now: Date;
  basePath: string;
  numbered?: boolean;
  mode?: RegisterColumnsMode;
  /** E-01: row selection and the bulk bar. */
  bulkActions?: (picked: FilingRow[]) => BulkAction[];
  onClearFilters?: () => void;
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
      minWidth={mode.company ? 1160 : 1020}
      empty={EMPTY_REGISTER}
      selectable={!!bulkActions}
      bulkActions={bulkActions}
      bulkNoun={['filing', 'filings']}
      onClearFilters={onClearFilters}
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
