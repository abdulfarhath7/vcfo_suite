'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Button } from '@/components/ui/button';
import { AreaPill, Chip } from '@/components/ui/spectrum-chip';
import { FilterChip } from '@/components/ui/filter-chip';
import { CompanyTile, PersonCell } from '@/components/staff/today/today-parts';
import {
  TODAY_STATUS_ORDER,
  dayMonth,
  dueClass,
  todayStatusTone,
} from '@/components/staff/today/today-rows';
import { ReassignDialog } from '@/views/admin/work/ReassignDialog';
import { useFirmWorkRows, type FirmWorkRow } from '@/views/admin/work/use-firm-work-rows';
import { cn } from '@/lib/utils';

/* The admin's Work tabs (prototype `AdminWorkItems` and the Project leads list, G-18). Both
   read `useFirmWorkRows`, so a row is the same item the lead sees on their own Work page. */

const STATUS_FILTER = [
  { value: 'open', label: 'Open' },
  ...TODAY_STATUS_ORDER.map((s) => ({ value: s.status, label: s.status })),
];

const STATUS_RANK = Object.fromEntries(TODAY_STATUS_ORDER.map((s, i) => [s.status, i])) as Record<string, number>;

function sortRows(rows: FirmWorkRow[]): FirmWorkRow[] {
  return [...rows].sort(
    (a, b) => STATUS_RANK[a.status]! - STATUS_RANK[b.status]! || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'),
  );
}

function options(rows: FirmWorkRow[], key: (r: FirmWorkRow) => string, label: (r: FirmWorkRow) => string) {
  return [...new Map(rows.map((r) => [key(r), label(r)])).entries()]
    .map(([value, text]) => ({ value, label: text }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function ItemCell({ row }: { row: FirmWorkRow }) {
  return (
    <span className="flex min-w-0 flex-col">
      <Link href={row.href} className="truncate font-medium text-ink hover:underline" title={row.title} onClick={(e) => e.stopPropagation()}>
        {row.title}
      </Link>
      <span className="truncate text-[12.5px] text-ink-muted">{row.area}</span>
    </span>
  );
}

function CompanyCell({ row }: { row: FirmWorkRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <CompanyTile name={row.companyName} />
      <span className="truncate">{row.companyName}</span>
    </span>
  );
}

const dueColumn: EFilingColumn<FirmWorkRow> = {
  key: 'due',
  header: 'Due',
  width: '76px',
  render: (r) => <span className={cn('tabular-nums', r.status !== 'Done' && dueClass(r.status))}>{dayMonth(r.dueAt) || '—'}</span>,
};

const statusColumn: EFilingColumn<FirmWorkRow> = {
  key: 'status',
  header: 'Status',
  width: '128px',
  render: (r) => (
    <Chip tone={todayStatusTone(r.status)} fixed>
      {r.status}
    </Chip>
  ),
};

function useFiltered(rows: FirmWorkRow[], person: (r: FirmWorkRow) => string) {
  const [status, setStatus] = useState('open');
  const [who, setWho] = useState('');
  const [company, setCompany] = useState('');
  const shown = sortRows(
    rows.filter(
      (r) =>
        (!status || (status === 'open' ? r.status !== 'Done' : r.status === status)) &&
        (!who || person(r) === who) &&
        (!company || r.engagementId === company),
    ),
  );
  return { shown, status, setStatus, who, setWho, company, setCompany };
}

/** Managers: a firm-wide feed of the items on each manager's engagements, with open and late counts per manager. */
export function ManagersWorkPanel() {
  const router = useRouter();
  const { rows, loading } = useFirmWorkRows();
  const f = useFiltered(rows, (r) => r.managerId);

  const byManager = useMemo(() => {
    const map = new Map<string, { id: string; name: string; open: number; overdue: number; waiting: number }>();
    for (const r of rows) {
      if (r.status === 'Done') continue;
      const entry = map.get(r.managerId) ?? { id: r.managerId, name: r.managerName, open: 0, overdue: 0, waiting: 0 };
      entry.open += 1;
      if (r.status === 'Overdue') entry.overdue += 1;
      if (r.status === 'Waiting') entry.waiting += 1;
      map.set(r.managerId, entry);
    }
    return [...map.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  }, [rows]);

  const columns: EFilingColumn<FirmWorkRow>[] = [
    { key: 'item', header: 'Item', render: (r) => <ItemCell row={r} /> },
    { key: 'company', header: 'Company', width: '200px', render: (r) => <CompanyCell row={r} /> },
    { key: 'manager', header: 'Manager', width: '132px', render: (r) => <PersonCell name={r.managerName} /> },
    { key: 'lead', header: 'Lead', width: '120px', render: (r) => <PersonCell name={r.leadName} /> },
    dueColumn,
    statusColumn,
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2.4fr)_minmax(280px,1fr)]">
      <DashSection title="Managers' items" meta={String(f.shown.length)} bodyClassName="p-0" loading={loading}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <FilterChip label="Status" value={f.status} options={STATUS_FILTER} onChange={f.setStatus} />
          <FilterChip label="Manager" value={f.who} options={options(rows, (r) => r.managerId, (r) => r.managerName)} onChange={f.setWho} />
          <FilterChip label="Company" value={f.company} options={options(rows, (r) => r.engagementId, (r) => r.companyName)} onChange={f.setCompany} />
        </div>
        <div className="border-t border-line-soft px-2 pb-3">
          <EFilingGrid
            caption="Managers' items"
            columns={columns}
            rows={f.shown}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(r.href)}
            pageSize={12}
            minWidth={820}
            empty="No items match these filters"
          />
        </div>
      </DashSection>
      <DashSection title="Open by manager" meta={String(byManager.length)} bodyClassName="p-0" loading={loading}>
        {byManager.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-ink-muted">Nothing open.</p>
        ) : (
          <ul>
            {byManager.map((m) => (
              <li key={m.id || 'none'} className="border-t border-line-soft first:border-t-0">
                <button
                  type="button"
                  onClick={() => f.setWho(f.who === m.id ? '' : m.id)}
                  className={cn(
                    'flex w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-surface-sunken',
                    f.who === m.id && 'bg-brand-soft',
                  )}
                  aria-pressed={f.who === m.id}
                >
                  <PersonCell name={m.name} full />
                  <span className="ml-auto flex items-center gap-3 tabular-nums">
                    <span title="Open">{m.open}</span>
                    <span className={cn(m.overdue > 0 ? 'font-medium text-danger' : 'text-ink-faint')} title="Overdue">
                      {m.overdue} late
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DashSection>
    </div>
  );
}

/** Project leads: every lead's items, with Reassign on each row. */
export function LeadsWorkPanel() {
  const router = useRouter();
  const { rows, teamMembers, loading } = useFirmWorkRows();
  const f = useFiltered(rows, (r) => r.leadId);
  const [reassign, setReassign] = useState<FirmWorkRow | null>(null);

  const columns: EFilingColumn<FirmWorkRow>[] = [
    { key: 'item', header: 'Item', render: (r) => <ItemCell row={r} /> },
    { key: 'company', header: 'Company', width: '200px', render: (r) => <CompanyCell row={r} /> },
    { key: 'lead', header: 'Lead', width: '128px', render: (r) => <PersonCell name={r.leadName} /> },
    { key: 'area', header: 'Area', width: '128px', render: (r) => <AreaPill area={r.area} /> },
    dueColumn,
    statusColumn,
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      width: '108px',
      align: 'right',
      render: (r) =>
        r.status === 'Done' ? null : (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setReassign(r);
            }}
          >
            Reassign
          </Button>
        ),
    },
  ];

  return (
    <>
      <DashSection title="Project leads' items" meta={String(f.shown.length)} bodyClassName="p-0" loading={loading}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <FilterChip label="Status" value={f.status} options={STATUS_FILTER} onChange={f.setStatus} />
          <FilterChip label="Lead" value={f.who} options={options(rows, (r) => r.leadId, (r) => r.leadName)} onChange={f.setWho} />
          <FilterChip label="Company" value={f.company} options={options(rows, (r) => r.engagementId, (r) => r.companyName)} onChange={f.setCompany} />
        </div>
        <div className="border-t border-line-soft px-2 pb-3">
          <EFilingGrid
            caption="Project leads' items"
            columns={columns}
            rows={f.shown}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(r.href)}
            pageSize={12}
            minWidth={940}
            empty="No items match these filters"
          />
        </div>
      </DashSection>
      <ReassignDialog row={reassign} onOpenChange={(open) => !open && setReassign(null)} leads={teamMembers} />
    </>
  );
}
