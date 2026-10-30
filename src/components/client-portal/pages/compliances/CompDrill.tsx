'use client';

/**
 * Rule 14 drill-down for the compliances pages (prototype comp-parts.tsx ComplianceDrill): a 760px
 * dialog with "As of <date>" above the title, segmented status tabs with counts, the T1 grid of the
 * filings (7 rows a page, page numbers under it) and one primary button in the footer that opens
 * the Filings list. Esc, ✕ and the scrim close it; phones get a bottom sheet (CpModal).
 */
import { useState } from 'react';
import { usePortal } from '../../PortalProvider';
import { AREAS, fmtDM, fmtDMY, sortByDue, statusOf, type AreaFilter, type CompStatus, type PortalFiling } from '@/lib/client-portal/compliances';
import { Button } from '@/components/ui/button';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { ProofChip } from './bits';
import { CpModal } from './overlay';
import { StatusChip, WORD } from './spectrum';
import { RowArea, RowPortalLink } from './task-marks';

export interface DrillState {
  /** `status` opens on the status tabs (the prototype's only kind); `area` keeps area tabs for callers that want them. */
  kind: 'status' | 'area';
  /** Pre-selected tab key: all | ok | due | over | up | MCA | … */
  k: string;
  title: string;
  rows: PortalFiling[];
  n: number;
}

const TABS: Record<'status' | 'area', [string, string][]> = {
  status: [
    ['all', 'All'],
    ['ok', WORD.ok],
    ['due', WORD.due],
    ['over', WORD.over],
    ['up', WORD.up],
  ],
  area: AREAS.map((a) => [a.id, a.label]),
};

export function CompDrill({
  state,
  today,
  link,
  onClose,
  onRow,
  onProof,
}: {
  state: DrillState;
  today: string;
  /** The footer button: "Open filings" on the calendar, "Show in the list" on the Filings page. */
  link: { text: string; onClick: () => void };
  onClose: () => void;
  onRow: (f: PortalFiling) => void;
  onProof: (f: PortalFiling) => void;
}) {
  const tabs = TABS[state.kind];
  const match = (r: PortalFiling, k: string) =>
    k === 'all' || (state.kind === 'status' ? statusOf(r, today) === (k as CompStatus) : r.area === (k as AreaFilter));
  const [k, setK] = useState(tabs.some((t) => t[0] === state.k) ? state.k : 'all');
  const { openChat } = usePortal();
  const list = sortByDue(state.rows.filter((r) => match(r, k)));
  const label = tabs.find((t) => t[0] === k)?.[1] ?? 'All';

  const columns: EFilingColumn<PortalFiling>[] = [
    {
      key: 'name',
      header: 'Filing',
      render: (r) => (
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-ink">{r.name}</span>
          <RowPortalLink r={r} />
          <ProofChip f={r} onOpen={onProof} />
        </span>
      ),
    },
    { key: 'period', header: 'Period', width: '120px', render: (r) => <span className="text-ink-muted">{r.period}</span> },
    { key: 'area', header: 'Area', width: '124px', render: (r) => <RowArea r={r} /> },
    {
      key: 'due',
      header: 'Due / filed',
      width: '112px',
      render: (r) => <span className="whitespace-nowrap tabular-nums">{r.filedOn ? `Filed ${fmtDM(r.filedOn)}` : fmtDM(r.dueDate)}</span>,
    },
    { key: 'status', header: 'Status', width: '124px', render: (r) => <StatusChip s={statusOf(r, today)} /> },
  ];

  return (
    <CpModal
      size="lg"
      flush
      titleId="comp-dd-t"
      onClose={onClose}
      eyebrow={`As of ${fmtDMY(today)}`}
      title={state.title}
      footer={
        <Button
          onClick={() => {
            onClose();
            link.onClick();
          }}
        >
          {link.text}
        </Button>
      }
    >
      <div className="border-b border-line-soft px-4 py-3 md:px-5">
        <SpectrumTabs
          label={state.kind === 'status' ? 'Status' : 'Area'}
          value={k}
          onChange={setK}
          className="max-w-full overflow-x-auto"
          items={tabs.map(([key, text]) => ({ key, label: text, count: state.rows.filter((r) => match(r, key)).length }))}
        />
      </div>
      <div className="px-2 pb-3 pt-1 md:px-3">
        <EFilingGrid
          caption={`${state.title} · ${label}`}
          columns={columns}
          rows={list}
          rowKey={(r) => r.id}
          onRowClick={onRow}
          pageSize={7}
          minWidth={600}
          empty={k === 'over' ? 'Nothing overdue' : 'None'}
          emptyAction={
            k === 'over' ? undefined : (
              <button
                type="button"
                className="text-[13px] font-medium text-brand-text hover:underline"
                onClick={() => {
                  onClose();
                  openChat(`Why are there no ${label.toLowerCase()} filings in ${state.title}?`);
                }}
              >
                Ask VCFO why
              </button>
            )
          }
        />
      </div>
    </CpModal>
  );
}
