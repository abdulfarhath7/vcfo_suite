'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Chip } from '@/components/ui/spectrum-chip';
import { PhaseBar } from '@/components/ui/step-track';
import { CompanyTile } from '@/components/staff/today/today-parts';
import type { PhaseProgressRow } from '@/components/staff/today/today-rows';
import { cn } from '@/lib/utils';

function rowStatus(r: PhaseProgressRow): { word: string; tone: 'bad' | 'ok' | 'prog' | 'idle' } {
  if (r.stuck) return { word: 'Stuck', tone: 'bad' };
  if (r.stepsTotal > 0 && r.stepsDone >= r.stepsTotal) return { word: 'Done', tone: 'ok' };
  if (r.stepsDone === 0) return { word: 'Not started', tone: 'idle' };
  return { word: 'In progress', tone: 'prog' };
}

/**
 * Phase progress (prototype PhaseProgress, ST5 compact form, R-22): one row per project with the
 * four phase bars sized by step count, the current step, steps done and days to the
 * incorporation date the manager set. Extra columns (manager, lead) come from the caller.
 */
export function PhaseProgressGrid({
  rows,
  title = 'Phase progress',
  meta,
  href,
  hrefLabel,
  extraColumns = [],
  before,
  empty = 'No projects yet',
  pageSize = 8,
}: {
  rows: PhaseProgressRow[];
  title?: string;
  meta?: ReactNode;
  href?: string;
  hrefLabel?: string;
  extraColumns?: EFilingColumn<PhaseProgressRow>[];
  /** Content above the grid inside the card (for example the portfolio phase line). */
  before?: ReactNode;
  empty?: string;
  pageSize?: number;
}) {
  const router = useRouter();
  const columns: EFilingColumn<PhaseProgressRow>[] = [
    {
      key: 'client',
      header: 'Client',
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <CompanyTile name={r.companyName} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-ink">{r.companyName}</span>
            <span className="truncate text-[12px] text-ink-muted" title={r.currentLabel}>
              {r.currentLabel}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'phases',
      header: 'Phases',
      width: '200px',
      render: (r) => <PhaseBar done={r.done} totals={r.totals} names={r.names} />,
    },
    {
      key: 'steps',
      header: 'Steps',
      width: '72px',
      align: 'right',
      render: (r) => (
        <span className="tabular-nums text-ink-muted">
          {r.stepsDone}/{r.stepsTotal}
        </span>
      ),
    },
    {
      key: 'coi',
      header: 'Days to COI',
      width: '104px',
      align: 'right',
      render: (r) =>
        r.daysToCoi === null ? (
          <span className="text-ink-faint">—</span>
        ) : (
          <span className={cn('tabular-nums font-medium', r.daysToCoi < 10 && 'text-danger')}>
            {r.daysToCoi < 0 ? `${-r.daysToCoi} days late` : `${r.daysToCoi} days`}
          </span>
        ),
    },
    ...extraColumns,
    {
      key: 'status',
      header: 'Status',
      width: '124px',
      render: (r) => {
        const s = rowStatus(r);
        return (
          <Chip tone={s.tone} fixed>
            {s.word}
          </Chip>
        );
      },
    },
  ];

  return (
    <DashSection
      title={title}
      meta={meta ?? String(rows.length)}
      href={href}
      hrefLabel={hrefLabel}
      bodyClassName="px-2 pb-3 pt-1"
    >
      {before ? <div className="px-2 pb-3 pt-2">{before}</div> : null}
      <EFilingGrid
        caption={title}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.engagementId}
        onRowClick={(r) => router.push(r.href)}
        pageSize={pageSize}
        minWidth={720}
        empty={empty}
      />
      <span className="mt-2 hidden flex-wrap items-center gap-x-4 gap-y-1 px-2 text-[12.5px] text-ink-muted md:flex">
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-[2px] bg-positive-mid" aria-hidden />
          Done
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-[2px] bg-brand" aria-hidden />
          Current phase
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-[2px] bg-surface-sunken shadow-[inset_0_0_0_1px_oklch(var(--line-strong))]" aria-hidden />
          Not started
        </span>
      </span>
    </DashSection>
  );
}
