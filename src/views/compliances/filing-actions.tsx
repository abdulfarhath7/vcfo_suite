'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ScheduleWindowControl, ScheduleWindowMeta } from '@/components/schedule/ScheduleWindowControl';
import { FilingProofEditor } from '@/components/compliances/FilingProofEditor';
import { setFilingWindowInDb } from '@/lib/projects/engagements-db';
import type { FilingRow } from '@/lib/compliance/filings';

/**
 * The register's two row actions, shared by Filings and the obligation
 * record: the manager's working window (a control for writers, quiet dates
 * for readers) and the proof and details editor (writers only). Writes go
 * through the existing routes; the repository re-checks the role.
 */

export function FilingWindowCell({ row, mayWrite }: { row: FilingRow; mayWrite: boolean }) {
  const queryClient = useQueryClient();
  const value = row.windowFrom && row.windowTo ? { from: row.windowFrom, to: row.windowTo } : null;
  if (!mayWrite) return <ScheduleWindowMeta value={value} />;
  return (
    <ScheduleWindowControl
      value={value}
      label={row.particular}
      onSave={async (window) => {
        await setFilingWindowInDb(row.id, window);
        await queryClient.invalidateQueries({ queryKey: ['filings'] });
      }}
    />
  );
}

export function FilingProofCell({ row }: { row: FilingRow }) {
  return <FilingProofEditor instanceId={row.id} label={row.particular} />;
}
