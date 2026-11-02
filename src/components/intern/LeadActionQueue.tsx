'use client';

import { EmptyState } from '@/components/ui/empty-state';
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
import { internKindOwner } from '@/components/intern/intern-tones';

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
  companyHref,
}: {
  companyHref?: (engagementId: string) => string;
  group: InternActionCompanyGroup;
  statusOf: (item: InternWorkItem) => TodayStatus;
  open: boolean;
  pick: TodayStatus | null;
  onToggle: () => void;
  onPick: (status: TodayStatus) => void;
}) {
  const panelId = `queue-${group.engagementId}`;
  const href = companyHref ? companyHref(group.engagementId) : internQueueCompanyHref(group.engagementId, group.items);
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
                    'mx-auto grid h-7 w-16 place-items-center rounded-sm text-[13px] font-medium tabular-nums',
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

const PAGE = 8;

/** A stuck client for the head chip: it opens the client. */
export interface StuckClient {
  engagementId: string;
  companyName: string;
  href: string;
}

/**
 * Action queue (prototype ActionQueue): by client, a row per company with a count per status
 * (click a count to list those tasks under the row), eight companies a page, or the plain list
 * with Step and Owner columns. A red chip in the head names the stuck clients. The open
 * companies are remembered for the lead.
 */
export function LeadActionQueue({
  userId,
  items,
  now,
  statusOf,
  stuck = [],
  loading,
  workHref = INTERN_TASKS_PATH,
  companyHref,
}: {
  /** The Work page the head link opens (the manager's Work on their Today). */
  workHref?: string;
  /** Where a company name goes (staff project pages for the manager). */
  companyHref?: (engagementId: string) => string;
  userId: string;
  items: InternWorkItem[];
  now: Date;
  /** The status word of an item (overdue, due soon, in progress, not started). */
  statusOf: (item: InternWorkItem) => TodayStatus;
  stuck?: StuckClient[];
  loading?: boolean;
}) {
  const router = useRouter();
  const [page, setPage] = useState(0);
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
      key: 'step',
      header: 'Step',
      width: '90px',
      render: (i) => (i.catalogLabel ? <span className="font-mono text-[12.5px] text-ink-2">{i.catalogLabel}</span> : <span className="text-ink-muted">{i.source === 'filing' ? 'Filing' : i.source === 'task' ? 'Task' : 'Request'}</span>),
    },
    {
      key: 'owner',
      header: 'Owner',
      width: '120px',
      render: (i) => {
        const o = internKindOwner(i.kind);
        return <span className="text-ink-2">{o === 'client' ? 'Client' : o === 'manager' ? 'Manager' : 'You'}</span>;
      },
    },
    {
      key: 'due',
      header: 'Due',
      width: '80px',
      render: (i) => <span className={cn('tabular-nums', dueClass(statusOf(i)))}>{dayMonth(i.dueAt) || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
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
      meta={`${openItems.length} open`}
      right={
        <span className="flex flex-wrap items-center gap-3">
          {stuck.length > 0 ? (
            <Link
              href={stuck[0]!.href}
              className="hidden h-6 items-center gap-1.5 rounded-md bg-danger-soft px-2 text-[12px] font-medium text-danger hover:underline md:inline-flex"
            >
              <i className="h-2 w-2 rounded-[2px] bg-danger-mid" aria-hidden />
              {stuck.length} stuck · {stuck.map((c) => c.companyName).join(', ')}
            </Link>
          ) : null}
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
      href={workHref}
      hrefLabel="Work"
      className="h-fit"
      bodyClassName="px-2 pb-3 pt-1"
      loading={loading}
    >
      {groups.length === 0 ? (
        <EmptyState title="Nothing needs you right now" className="m-2" />
      ) : view === 'list' ? (
        <EFilingGrid
          caption="Action queue"
          columns={listColumns}
          rows={openItems}
          rowKey={(i) => i.id}
          onRowClick={(i) => router.push(i.href)}
          pageSize={8}
          minWidth={760}
        />
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-[14px]" style={{ minWidth: 600 }}>
            <caption className="sr-only">Action queue by client</caption>
            <colgroup>
              <col />
              {COLS.map((c) => (
                <col key={c} style={{ width: 96 }} />
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
              {groups.slice(page * PAGE, page * PAGE + PAGE).map((group) => {
                const open = expanded.has(group.engagementId);
                const picked = pick?.engagementId === group.engagementId ? pick.status : null;
                return (
                  <CompanyRow
                    key={group.engagementId}
                    group={group}
                    companyHref={companyHref}
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
          {groups.length > PAGE ? (
            <div className="mt-2 flex items-center gap-2 border-t border-line-soft px-2 pt-2 text-[12.5px] text-ink-muted tabular-nums">
              <span className="flex-1">
                {page * PAGE + 1}–{Math.min(groups.length, page * PAGE + PAGE)} of {groups.length}
              </span>
              {Array.from({ length: Math.ceil(groups.length / PAGE) }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={cn('grid h-7 min-w-7 place-items-center rounded-md px-1.5 hover:bg-hover', n === page && 'bg-brand-soft font-medium text-brand-text')}
                >
                  {n + 1}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </DashSection>
  );
}
