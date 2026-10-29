'use client';

import { useMemo } from 'react';
import { AlertTriangle, Calendar, CalendarClock, CircleCheck, User } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { CompanyPicker } from '@/components/admin/CompanyPicker';
import { Button } from '@/components/ui/button';
import { AreaPill } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Term } from '@/components/ui/term';
import { SkeletonRows } from '@/components/ui/empty-state';
import {
  PreIncorporationNotice,
  PreIncorporationPortfolioNote,
} from '@/components/compliances/PreIncorporationNotice';
import { monthKeyOf, rowsInMonth } from '@/lib/compliance/filings';
import { cn } from '@/lib/utils';
import {
  ALL_COMPANIES,
  normaliseCompanyParam,
  pickedCompany,
  rowsForCompany,
  soleCompany,
  type ComplianceScope,
} from '@/views/compliances/compliance-scope';
import { areaLabel, daysUntil, plainDate } from '@/views/compliances/spectrum-status';
import {
  FilingBand,
  FilterStrip,
  FlowCard,
  RailCard,
  WordChip,
  type RailItem,
  type StripItem,
} from '@/views/compliances/spectrum-parts';
import { GroupedGrid, type GridColumn, type GridGroup } from '@/views/compliances/grouped-grid';
import { areaSwatch } from '@/views/compliances/area-swatch';
import { useRegister } from '@/views/compliances/use-register';
import { useViewParams } from '@/views/compliances/view-params';
import {
  dueWithinSoon,
  flowCounts,
  groupObligations,
  matchesFilter,
  waitingOnClient,
  type ObligationClientRow,
  type ObligationFilter,
  type ObligationGroup,
} from '@/views/compliances/obligation-groups';

type GroupBy = 'filing' | 'frequency' | 'law';
const FREQUENCIES: Array<[string, string]> = [
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['half-yearly', 'Half-yearly'],
  ['annual', 'Annual'],
  ['one-time', 'One-time'],
];
const FREQ_DOT: Record<string, string> = {
  monthly: 'bg-brand',
  quarterly: 'bg-identity',
  'half-yearly': 'bg-waiting-mid',
  annual: 'bg-warning-mid',
  'one-time': 'bg-upcoming-mid',
};

/** One client row with its obligation, for the flat "by frequency" and "by law" lists. */
interface FlatRow extends ObligationClientRow {
  group: ObligationGroup;
}

/** "3 days late", "Today", "In 4 days". */
function dueWords(iso: string, now: Date): string {
  const d = daysUntil(iso, now);
  if (d === null) return '—';
  if (d < 0) return `${-d} day${d === -1 ? '' : 's'} late`;
  if (d === 0) return 'Today';
  return `In ${d} day${d === 1 ? '' : 's'}`;
}

/**
 * OBLIGATIONS — the staff register grouped by filing (prototype C-0108).
 *
 * For each obligation a band with the date tile, the name, the area pill and
 * an "n of m filed" bar for the period that needs attention, then the client
 * rows under it. "By frequency" and "By law" regroup the same client rows. A
 * number strip filters the list; the rail carries the progress flow of this
 * month, "Due in the next 15 days", "Waiting on client" and "Filed recently"
 * (owner decision for the Obligations rail).
 *
 * Rows come from the scoped register (`useRegister`); `scope` is the caller's
 * roster for the company picker and the pre-COI notice. `?company=`, `?by=`
 * and `?state=` carry the state on refresh. `embedded` renders the list as a
 * tab of the client record (G-19): `scope` is that one client, the state stays
 * in memory and the page head is left to the record.
 */
export function ObligationsView({ basePath, scope, embedded = false }: { basePath: string; scope: ComplianceScope; embedded?: boolean }) {
  const params = useViewParams(`${basePath}/obligations`, embedded);
  const now = useMemo(() => new Date(), []);
  const { engagements } = scope;
  const sole = soleCompany(engagements);
  const companyId = sole ? sole.id : normaliseCompanyParam(params.get('company'), engagements);
  const byParam = params.get('by');
  const groupBy: GroupBy = byParam === 'frequency' || byParam === 'law' ? byParam : 'filing';
  const stateParam = params.get('state') ?? '';
  const filter: ObligationFilter = (['overdue', 'soon', 'waiting', 'done', 'none'] as const).includes(stateParam as never)
    ? (stateParam as ObligationFilter)
    : '';

  const picked = pickedCompany(engagements, companyId);
  const pickedPreIncorporation = picked && scope.preIncorporationIds.has(picked.id) ? picked : null;

  const register = useRegister(now);
  const rows = rowsForCompany(register.rows, companyId);
  const groups = groupObligations(rows, register.details, now);
  const allClientRows = groups.flatMap((g) => g.rows.map((r) => ({ ...r, group: g })));

  const setParams = params.set;

  const hrefOf = (r: FlatRow): string =>
    `${basePath}/obligations/${encodeURIComponent(r.group.obligationId)}${sole ? '' : `?company=${encodeURIComponent(r.row.engagementId)}`}`;

  const count = (f: ObligationFilter) => allClientRows.filter((r) => matchesFilter(r, f, now)).length;
  const strip: StripItem[] = [
    { key: 'overdue', label: 'Overdue', value: count('overdue'), Icon: AlertTriangle, valueClass: 'text-danger' },
    { key: 'soon', label: 'Due in 15 days', value: count('soon'), Icon: Calendar, valueClass: 'text-warning' },
    { key: 'waiting', label: 'Waiting on client', value: count('waiting'), Icon: User, valueClass: 'text-waiting' },
    { key: 'done', label: 'Done', value: count('done'), Icon: CircleCheck, valueClass: 'text-positive' },
    { key: 'none', label: 'Not started', value: count('none'), Icon: CalendarClock },
  ];

  const shownFlat: FlatRow[] = allClientRows.filter((r) => matchesFilter(r, filter, now));
  const gridGroups: GridGroup<FlatRow>[] =
    groupBy === 'filing'
      ? groups.map((g) => {
          const list = shownFlat.filter((r) => r.group.obligationId === g.obligationId);
          return { id: g.obligationId, label: g.name, rows: list, head: <FilingHead group={g} /> };
        })
      : groupBy === 'law'
        ? [...new Set(groups.map((g) => g.area))]
            .sort((a, b) => a.localeCompare(b))
            .map((a) => ({ id: a, label: areaLabel(a), dot: areaSwatch(a), rows: shownFlat.filter((r) => r.group.area === a) }))
        : FREQUENCIES.map(([key, label]) => ({
            id: key,
            label,
            dot: FREQ_DOT[key],
            rows: shownFlat.filter((r) => r.group.frequency.trim().toLowerCase() === key),
          }));

  const statusCol: GridColumn<FlatRow> = { key: 'status', label: 'Status', width: 128, render: (r) => <WordChip word={r.word} /> };
  const dueCol: GridColumn<FlatRow> = {
    key: 'due',
    label: 'Next due',
    width: 108,
    render: (r) => (
      <span className={r.status === 'overdue' ? 'font-medium text-danger' : 'text-ink-muted'}>{plainDate(r.nextDue ?? r.row.dueDate, now)}</span>
    ),
  };
  const lastCol: GridColumn<FlatRow> = {
    key: 'last',
    label: 'Last filed',
    width: 120,
    className: 'hidden md:table-cell',
    render: (r) => <span className="text-ink-muted">{plainDate(r.lastFiled, now)}</span>,
  };
  const filingCols: GridColumn<FlatRow>[] = [
    {
      key: 'client',
      label: 'Filing · client',
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2.5 md:pl-[56px]">
          <span className="min-w-0 truncate font-medium text-ink">{r.row.companyName}</span>
        </span>
      ),
    },
    {
      key: 'owner',
      label: 'Owner',
      width: 160,
      className: 'hidden md:table-cell',
      render: (r) => <span className="truncate">{r.detail?.ownerName ?? '—'}</span>,
    },
    lastCol,
    statusCol,
    { ...dueCol, className: 'hidden md:table-cell' },
  ];
  const flatCols: GridColumn<FlatRow>[] = [
    {
      key: 'name',
      label: 'Obligation',
      render: (r) => (
        <span className="block min-w-0">
          <b className="block truncate text-[14px] font-medium text-ink">{r.group.name}</b>
          <span className="block truncate text-[12.5px] text-ink-muted">{r.row.companyName}</span>
        </span>
      ),
    },
    {
      key: 'law',
      label: 'Law',
      width: 140,
      className: 'hidden md:table-cell',
      render: (r) => <AreaPill area={areaLabel(r.group.area)} />,
    },
    lastCol,
    statusCol,
    dueCol,
  ];

  // Rail: this month's flow and the three lists (owner decision).
  const monthKey = monthKeyOf(now.toISOString())!;
  const flow = flowCounts(rowsInMonth(rows, monthKey), register.details);
  const soon = allClientRows
    .filter((r) => dueWithinSoon(r.row, now))
    .sort((a, b) => a.row.dueDate.localeCompare(b.row.dueDate))
    .slice(0, 5);
  const waiting = allClientRows
    .filter((r) => waitingOnClient(r.row, r.detail, now))
    .sort((a, b) => a.row.dueDate.localeCompare(b.row.dueDate))
    .slice(0, 5);
  const filedRecently = rows
    .filter((r) => r.filedOn)
    .sort((a, b) => (b.filedOn ?? '').localeCompare(a.filedOn ?? ''))
    .slice(0, 4);
  const rail = (list: FlatRow[], right: (r: FlatRow) => string, rightClass?: (r: FlatRow) => string | undefined): RailItem[] =>
    list.map((r) => ({
      key: r.key,
      title: r.group.name,
      sub: r.row.companyName,
      right: right(r),
      rightClass: rightClass?.(r),
      href: hrefOf(r),
    }));

  const head = (
    <>
      {sole ? null : (
        <CompanyPicker
          engagements={engagements}
          value={companyId}
          allLabel="All my clients"
          allHint="Every client in view"
          onChange={(id) => setParams({ company: id === ALL_COMPANIES ? null : id })}
        />
      )}
      <SpectrumTabs
        label="Group by"
        items={[
          { key: 'filing', label: 'By filing' },
          { key: 'frequency', label: 'By frequency' },
          { key: 'law', label: 'By law' },
        ]}
        value={groupBy}
        onChange={(v) => setParams({ by: v === 'filing' ? null : v })}
      />
      {filter || (!sole && companyId !== ALL_COMPANIES) ? (
        <Button size="sm" variant="ghost" onClick={() => setParams({ state: null, company: null })}>
          Clear
        </Button>
      ) : null}
    </>
  );

  return (
    <PageTransition>
      {embedded ? null : (
        <SEO title="Obligations — VCFO Suite" description="Statutory obligations grouped by filing, with each client's status." path={`${basePath}/obligations`} />
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        {embedded ? null : <h1 className="sr-only">Obligations</h1>}
        <FilterStrip items={strip} value={filter} onChange={(k) => setParams({ state: k || null })} />

        {pickedPreIncorporation ? (
          <PreIncorporationNotice scope={{ audience: scope.audience, companyName: pickedPreIncorporation.companyName }} />
        ) : !picked ? (
          <PreIncorporationPortfolioNote count={scope.preIncorporationIds.size} />
        ) : null}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {register.isPending ? (
              <div className="surface p-4" aria-busy="true" aria-label="Loading obligations">
                <SkeletonRows rows={6} />
              </div>
            ) : register.isError ? (
              <p className="surface px-4 py-6 text-center text-[13px] text-ink-muted">Could not load the register. Try again in a moment.</p>
            ) : (
              <GroupedGrid
                title="Obligations"
                right={head}
                columns={groupBy === 'filing' ? filingCols : flatCols}
                groups={gridGroups}
                rowKey={(r) => r.key}
                rowHref={hrefOf}
                empty="No obligations in view"
              />
            )}
          </div>
          <div className="grid min-w-0 gap-3">
            <FlowCard
              title="This month"
              steps={[
                { label: 'Data from client', value: flow.data },
                { label: 'Prepared', value: flow.prepared },
                { label: 'Filed', value: flow.filed },
                { label: 'Acknowledged', value: flow.acknowledged },
              ]}
            />
            <RailCard
              title="Due in the next 15 days"
              items={rail(soon, (r) => plainDate(r.row.dueDate, now))}
            />
            <RailCard
              title="Waiting on client"
              items={rail(
                waiting,
                (r) => dueWords(r.row.dueDate, now),
                (r) => cn('font-medium', r.status === 'overdue' ? 'text-danger' : 'text-waiting'),
              )}
            />
            <RailCard
              title="Filed recently"
              items={filedRecently.map((r) => ({
                key: r.id,
                title: r.particular,
                sub: r.companyName,
                right: plainDate(r.filedOn, now),
                href: `${basePath}/obligations/${encodeURIComponent(r.obligationId)}?company=${encodeURIComponent(r.engagementId)}`,
              }))}
            />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

/** Band of one filing (the shared `FilingBand`): date tile, name and due date, area pill, filed count with a green bar. */
function FilingHead({ group }: { group: ObligationGroup }) {
  return (
    <FilingBand
      iso={group.dueDate}
      status={group.status}
      name={<Term>{group.name}</Term>}
      sub={`Due ${plainDate(group.dueDate)} · ${group.authority}`}
      area={areaLabel(group.area)}
      filed={group.filed}
      total={group.total}
    />
  );
}
