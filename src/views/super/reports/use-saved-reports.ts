'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PartnerReportParams, ReportSchedule, SavedReport } from '@/lib/reports/partner-report';

/**
 * Saved reports on the Reports page (G-21): list, save, change, delete. Every call goes
 * through `/api/super/reports`, which is super admin only and owner-scoped.
 */
const SAVED_REPORTS_KEY = ['super-saved-reports'] as const;

export interface SavedReportValues {
  name: string;
  params: PartnerReportParams;
  schedule: ReportSchedule;
  recipients: string[];
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || fallback);
  return data;
}

export function useSavedReports() {
  return useQuery({
    queryKey: SAVED_REPORTS_KEY,
    queryFn: async () =>
      (await readJson<{ reports: SavedReport[] }>(await fetch('/api/super/reports'), 'Could not load saved reports')).reports,
    staleTime: 30_000,
  });
}

export function useSavedReportMutations() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: SAVED_REPORTS_KEY });

  const save = useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: SavedReportValues }) =>
      (
        await readJson<{ report: SavedReport }>(
          await fetch(id ? `/api/super/reports/${id}` : '/api/super/reports', {
            method: id ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          }),
          'Could not save the report',
        )
      ).report,
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      readJson<{ ok: true }>(await fetch(`/api/super/reports/${id}`, { method: 'DELETE' }), 'Could not delete the report'),
    onSuccess: refresh,
  });

  return { save, remove };
}
