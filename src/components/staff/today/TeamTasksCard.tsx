'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { AreaPill, Chip } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { WorkFilterChip } from '@/components/intern/WorkFilterChip';
import { CompanyTile, PersonCell } from '@/components/staff/today/today-parts';
import {
  TODAY_STATUS_ORDER,
  dayMonth,
  dueClass,
  todayStatusTone,
  type TeamTaskRow,
} from '@/components/staff/today/today-rows';
import { cn } from '@/lib/utils';

/** Status filter words: "Open" for everything not done, then the six (R-13). */
const STATUS_FILTER = [
  { value: 'open', label: 'Open' },
  ...TODAY_STATUS_ORDER.map((s) => ({ value: s.status, label: s.status })),
];

function TaskCell({ row, link }: { row: TeamTaskRow; link?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <CompanyTile name={row.companyName} />
      <span className="flex min-w-0 flex-col">
        {link ? (
          <Link href={row.href} className="truncate font-medium text-ink hover:underline" title={row.title}>
            {row.title}
          </Link>
        ) : (
          <span className="truncate font-medium text-ink" title={row.title}>
            {row.title}
          </span>
        )}
        <span className="truncate text-[12.5px] text-ink-muted">{row.companyName}</span>
      </span>
    </span>
  );
}

/**
 * Team tasks (prototype ManagerToday "Team tasks"): R-10 filter chips, a List or Board switch,
 * and a T1 table. Each row opens the step, the filing calendar or the project.
 */
export function TeamTasksCard({ rows }: { rows: TeamTaskRow[] }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [lead, setLead] = useState('');
  const [company, setCompany] = useState('');
  const [area, setArea] = useState('');
  const [view, setView] = useState('list');

  const leads = useMemo(
    () => [...new Map(rows.map((r) => [r.leadId, r.leadName])).entries()].map(([value, label]) => ({ value, label })),
    [rows],
  );
  const companies = useMemo(
    () =>
      [...new Map(rows.map((r) => [r.engagementId, r.companyName])).entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [rows],
  );
  const areas = useMemo(() => [...new Set(rows.map((r) => r.area))].map((a) => ({ value: a, label: a })), [rows]);

  const shown = rows.filter(
    (r) =>
      (!status || (status === 'open' ? r.status !== 'Done' : r.status === status)) &&
      (!lead || r.leadId === lead) &&
      (!company || r.engagementId === company) &&
      (!area || r.area === area),
  );

  const columns: EFilingColumn<TeamTaskRow>[] = [
    { key: 'task', header: 'Task', render: (r) => <TaskCell row={r} link /> },
    { key: 'lead', header: 'Lead', width: '128px', render: (r) => <PersonCell name={r.leadName} /> },
    { key: 'area', header: 'Area', width: '128px', render: (r) => <AreaPill area={r.area} /> },
    {
      key: 'due',
      header: 'Due',
      width: '76px',
      render: (r) => <span className={cn('tabular-nums', r.status !== 'Done' && dueClass(r.status))}>{dayMonth(r.dueAt) || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '128px',
      render: (r) => (
        <Chip tone={todayStatusTone(r.status)} fixed>
          {r.status}
        </Chip>
      ),
    },
  ];

  return (
    <DashSection title="Team tasks" meta={String(shown.length)} bodyClassName="p-0">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <WorkFilterChip label="Status" value={status} options={STATUS_FILTER} onChange={setStatus} />
        <WorkFilterChip label="Lead" value={lead} options={leads} onChange={setLead} />
        <WorkFilterChip label="Company" value={company} options={companies} onChange={setCompany} />
        <WorkFilterChip label="Area" value={area} options={areas} onChange={setArea} />
        <SpectrumTabs
          className="ml-auto"
          label="Team tasks view"
          items={[
            { key: 'list', label: 'List' },
            { key: 'board', label: 'Board' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      {view === 'list' ? (
        <div className="border-t border-line-soft px-2 pb-3">
          <EFilingGrid
            caption="Team tasks"
            columns={columns}
            rows={shown}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(r.href)}
            pageSize={10}
            minWidth={680}
            empty="No tasks match these filters"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 border-t border-line-soft p-4 sm:grid-cols-2 xl:grid-cols-3">
          {TODAY_STATUS_ORDER.map((s) => {
            const list = shown.filter((r) => r.status === s.status);
            return (
              <section
                key={s.status}
                className="min-w-0 rounded-md border-1.5 border-line bg-surface-sunken p-2.5"
                aria-label={s.status}
              >
                <h3 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-medium text-ink-2">
                  <i className={cn('h-2 w-2 rounded-[2px]', s.bar)} aria-hidden />
                  {s.status}
                  <span className="ml-auto text-[12px] text-ink-muted">{list.length}</span>
                </h3>
                <ul className="grid gap-2">
                  {list.slice(0, 12).map((r) => (
                    <li key={r.id} className="grid gap-2 rounded-md border-1.5 border-line bg-surface-raised p-2.5">
                      <TaskCell row={r} link />
                      <span className="flex items-center gap-2 text-[12.5px] text-ink-muted">
                        <PersonCell name={r.leadName} />
                        <span className={cn('ml-auto tabular-nums', r.status !== 'Done' && dueClass(r.status))}>
                          {dayMonth(r.dueAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                  {list.length > 12 ? (
                    <li className="px-1 text-[12.5px] text-ink-muted">{list.length - 12} more in the list</li>
                  ) : null}
                  {list.length === 0 ? (
                    <li className="rounded-md border-1.5 border-dashed border-line-strong px-2 py-3 text-center text-[12.5px] text-ink-muted">
                      None
                    </li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </DashSection>
  );
}
