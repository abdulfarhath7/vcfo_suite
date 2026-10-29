'use client';

import { CalendarClock, Download, Trash2 } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, GRID_SUB, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Button } from '@/components/ui/button';
import { SkeletonRows } from '@/components/ui/empty-state';
import { plainDay } from '@/components/super/parts/super-text';
import { monthKeyLabel, REPORT_SCHEDULE_LABEL, type SavedReport } from '@/lib/reports/partner-report';
import { cn } from '@/lib/utils';

/**
 * The caller's saved reports (G-21): which month, the schedule, who gets it, when it last
 * went out, and Open, Download PDF, Schedule and Delete on each row.
 */
export function SavedReportsCard({
  reports,
  loading,
  error,
  onOpen,
  onSchedule,
  onDelete,
}: {
  reports: SavedReport[];
  loading: boolean;
  error: string | null;
  onOpen: (r: SavedReport) => void;
  onSchedule: (r: SavedReport) => void;
  onDelete: (r: SavedReport) => void;
}) {
  const columns: EFilingColumn<SavedReport>[] = [
    {
      key: 'name',
      header: 'Report',
      render: (r) => (
        <button type="button" onClick={() => onOpen(r)} className="truncate text-left font-medium text-brand-text hover:underline">
          {r.name}
        </button>
      ),
    },
    { key: 'month', header: 'Month', width: '140px', render: (r) => monthKeyLabel(r.params.month) },
    { key: 'schedule', header: 'Schedule', width: '120px', render: (r) => REPORT_SCHEDULE_LABEL[r.schedule] },
    {
      key: 'to',
      header: 'Send to',
      render: (r) =>
        r.recipients.length === 0 ? (
          '–'
        ) : (
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{r.recipients[0]}</span>
            {r.recipients.length > 1 ? (
              <span className={cn(GRID_SUB, 'text-[12px] text-ink-muted')}>and {r.recipients.length - 1} more</span>
            ) : null}
          </span>
        ),
    },
    { key: 'sent', header: 'Last sent', width: '96px', render: (r) => (r.lastSentAt ? plainDay(r.lastSentAt) : 'Never') },
    {
      key: 'act',
      header: '',
      width: '128px',
      align: 'right',
      render: (r) => (
        <span className="flex items-center justify-end gap-1">
          <Button size="icon" variant="quiet" aria-label={`Schedule ${r.name}`} title="Schedule" onClick={() => onSchedule(r)}>
            <CalendarClock aria-hidden />
          </Button>
          <Button size="icon" variant="quiet" asChild>
            <a href={`/api/super/reports/${r.id}/pdf`} aria-label={`Download ${r.name}`} title="Download PDF">
              <Download aria-hidden />
            </a>
          </Button>
          <Button size="icon" variant="quiet" aria-label={`Delete ${r.name}`} title="Delete" onClick={() => onDelete(r)}>
            <Trash2 aria-hidden />
          </Button>
        </span>
      ),
    },
  ];
  return (
    <DashSection title="Saved reports" meta={loading ? undefined : String(reports.length)}>
      {loading ? (
        <SkeletonRows rows={3} />
      ) : error ? (
        <p className="text-[13.5px] text-danger">{error}</p>
      ) : (
        <EFilingGrid caption="Saved reports" columns={columns} rows={reports} rowKey={(r) => r.id} empty="No saved report yet" minWidth={720} />
      )}
    </DashSection>
  );
}
