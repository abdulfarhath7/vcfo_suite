'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ListTodo } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Chip } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { InternWorkQueueRow } from '@/components/intern/InternWorkRow';
import { InternWorkCtaButton } from '@/components/intern/InternWorkCtaButton';
import { CompanyTile } from '@/components/staff/today/today-parts';
import { dayMonth, dueClass, todayStatusTone, type TodayStatus } from '@/components/staff/today/today-rows';
import {
  internActionQueueByCompany,
  internQueueCompanyHref,
  readInternQueueExpanded,
  writeInternQueueExpanded,
  INTERN_TASKS_PATH,
  type InternActionCompanyGroup,
  type InternWorkItem,
} from '@/lib/intern/intern-work';
import { cn } from '@/lib/utils';

/* The action queue holds what the lead must move; waiting items live in the Waiting on card. */
const COLS: TodayStatus[] = ['Overdue', 'Due soon', 'In progress', 'Not started'];

/* Soft tinted count boxes (prototype heat cells), in the status colours. */
const HEAT: Record<TodayStatus, string> = {
  Overdue: 'bg-danger-soft text-danger',
  'Due soon': 'bg-warning-soft text-warning',
  'In progress': 'bg-brand-soft text-brand-text',
  'Not started': 'bg-surface-sunken text-ink-muted',
  Waiting: 'bg-waiting-soft text-waiting',
  Done: 'bg-positive-soft text-positive',
};

function CompanyRow({
  group,
  statusOf,
  open,
  pick,
  onToggle,
  onPick,
}: {
  group: InternActionCompanyGroup;
  statusOf: (item: InternWorkItem) => TodayStatus;
  open: boolean;
  pick: TodayStatus | null;
  onToggle: () => void;
  onPick: (status: TodayStatus) => void;
}) {
  const panelId = `queue-${group.engagementId}`;
  const href = internQueueCompanyHref(group.engagementId, group.items);
  const shown = pick ? group.items.filter((i) => statusOf(i) === pick) : group.items;
  return (
    <Fragment>
      <tr className="hover:bg-surface-sunken/60">
        <td className="h-12 border-b border-line-soft px-2.5 align-middle">
          <span className="flex min-w-0 items-center gap-2.5">
            <CompanyTile name={group.companyName} />
            <span className="flex min-w-0 flex-col">
              <Link href={href} className="truncate font-medium text-ink hover:underline">
                {group.companyName}
              </Link>
              <span className="truncate text-[12px] text-ink-muted">{group.pill.label}</span>
            </span>
          </span>
        </td>
        {COLS.map((status) => {
          const n = group.items.filter((i) => statusOf(i) === status).length;
          return (
            <td key={status} className="border-b border-line-soft px-1 text-center align-middle">
              {n === 0 ? (
                <span className="text-ink-faint" aria-hidden>
                  –
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onPick(status)}
                  aria-pressed={open && pick === status}
                  aria-label={`${group.companyName} · ${status} · ${n}`}
                  className={cn(
                    'mx-auto grid h-7 w-14 place-items-center rounded-sm text-[13px] font-medium tabular-nums',
                    HEAT[status],
                    open && pick === status && 'ring-2 ring-brand ring-offset-1 ring-offset-surface-raised',
                  )}
                >
                  {n}
                </button>
              )}
            </td>
          );
        })}
        <td className="whitespace-nowrap border-b border-line-soft px-2.5 text-center align-middle text-[12px] text-ink-muted">
          <b className="text-[13.5px] font-medium text-ink">{group.items.length}</b>{' '}
          {group.items.length === 1 ? 'task' : 'tasks'}
        </td>
        <td className="border-b border-line-soft px-1 text-center align-middle">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? `Hide tasks for ${group.companyName}` : `Show tasks for ${group.companyName}`}
            className="grid h-7 w-7 place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} strokeWidth={1.6} aria-hidden />
          </button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={COLS.length + 3} className="border-b border-line-soft px-2.5 pb-2">
            <div id={panelId} role="region" aria-label={`${group.companyName} tasks`}>
              {shown.slice(0, 5).map((item) => (
                <InternWorkQueueRow key={item.id} item={item} />
              ))}
              {shown.length > 5 ? (
                <Link href={href} className="block border-t border-line py-2 pl-9 text-[12.5px] font-medium text-brand-text hover:underline">
                  {shown.length - 5} more at {group.companyName}
                </Link>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

/**
 * Action queue (prototype ActionQueue): by client, a row per company with a count per status
 * (click a count to list those tasks under the row), or the plain list. The open companies are
 * remembered for the lead.
 */
export function LeadActionQueue({
  userId,
  items,
  now,
  statusOf,
}: {
  userId: string;
  items: InternWorkItem[];
  now: Date;
  /** The status word of an item (overdue, due soon, in progress, not started). */
  statusOf: (item: InternWorkItem) => TodayStatus;
}) {
  const router = useRouter();
  const groups = internActionQueueByCompany(items, now);
  const openItems = groups.flatMap((g) => g.items);
  const [view, setView] = useState('map');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pick, setPick] = useState<{ engagementId: string; status: TodayStatus } | null>(null);

  useEffect(() => {
    if (!userId) return;
    setExpanded(new Set(readInternQueueExpanded(userId)));
  }, [userId]);

  const setOpen = (engagementId: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(engagementId);
      else next.delete(engagementId);
      if (userId) writeInternQueueExpanded(userId, next);
      return next;
    });
  };

  const listColumns: EFilingColumn<InternWorkItem>[] = [
    {
      key: 'client',
      header: 'Client',
      width: '30%',
      render: (i) => (
        <span className="flex min-w-0 items-center gap-2">
          <CompanyTile name={i.companyName} />
          <span className="truncate">{i.companyName}</span>
        </span>
      ),
    },
    {
      key: 'task',
      header: 'Task',
      render: (i) => (
        <Link href={i.href} className="font-medium text-ink hover:underline" title={i.title}>
          {i.title}
        </Link>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      width: '72px',
      render: (i) => <span className={cn('tabular-nums', dueClass(statusOf(i)))}>{dayMonth(i.dueAt) || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '124px',
      render: (i) => {
        const s = statusOf(i);
        return (
          <Chip tone={todayStatusTone(s)} fixed title={i.why}>
            {s}
          </Chip>
        );
      },
    },
    { key: 'action', header: <span className="sr-only">Action</span>, width: '128px', align: 'right', render: (i) => <InternWorkCtaButton item={i} /> },
  ];

  return (
    <DashSection
      icon={ListTodo}
      title="Action queue"
      meta={
        <span className="flex flex-wrap items-center gap-3">
          <span>{openItems.length} open</span>
          <SpectrumTabs
            label="Action queue view"
            items={[
              { key: 'map', label: 'By client' },
              { key: 'list', label: 'List' },
            ]}
            value={view}
            onChange={setView}
          />
        </span>
      }
      href={INTERN_TASKS_PATH}
      hrefLabel="Work"
      className="h-fit"
      bodyClassName="px-2 pb-3 pt-1"
    >
      {groups.length === 0 ? (
        <p className="px-2 py-4 text-center text-[13px] text-ink-muted">Nothing needs you right now.</p>
      ) : view === 'list' ? (
        <EFilingGrid
          caption="Action queue"
          columns={listColumns}
          rows={openItems}
          rowKey={(i) => i.id}
          onRowClick={(i) => router.push(i.href)}
          pageSize={8}
          minWidth={640}
        />
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[14px]" style={{ minWidth: 600 }}>
            <caption className="sr-only">Action queue by client</caption>
            <colgroup>
              <col />
              {COLS.map((c) => (
                <col key={c} style={{ width: 84 }} />
              ))}
              <col style={{ width: 88 }} />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="h-9 border-b-1.5 border-line px-2.5 text-left text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
                  Client
                </th>
                {COLS.map((c) => (
                  <th key={c} scope="col" className="h-9 whitespace-nowrap border-b-1.5 border-line px-1 text-center text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
                    {c}
                  </th>
                ))}
                <th scope="col" className="h-9 border-b-1.5 border-line px-2.5 text-center text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
                  Total
                </th>
                <th scope="col" className="h-9 border-b-1.5 border-line">
                  <span className="sr-only">Show tasks</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const open = expanded.has(group.engagementId);
                const picked = pick?.engagementId === group.engagementId ? pick.status : null;
                return (
                  <CompanyRow
                    key={group.engagementId}
                    group={group}
                    statusOf={statusOf}
                    open={open}
                    pick={open ? picked : null}
                    onToggle={() => {
                      if (open && picked) setPick(null);
                      setOpen(group.engagementId, !open);
                    }}
                    onPick={(status) => {
                      if (open && picked === status) {
                        setPick(null);
                        return;
                      }
                      setPick({ engagementId: group.engagementId, status });
                      if (!open) setOpen(group.engagementId, true);
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashSection>
  );
}
