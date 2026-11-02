'use client';

import { useMemo } from 'react';
import { useFilings } from '@/hooks/use-filings';
import { useApp } from '@/context/AppContext';
import { canSetScheduleWindows } from '@/lib/projects/schedule-windows';
import { useCompFilings } from '@/components/client-portal/pages/compliances/api';
import { financialYearForDate, type FilingRow } from '@/lib/compliance/filings';
import type { PortalFiling } from '@/lib/client-portal/compliances';

/**
 * The register for the staff Obligations pages: this financial year and the
 * last one (so a late filing from March still shows), plus the per-instance
 * facts (data received, ARN, owner, reminder) by instance id.
 *
 * Both reads already exist and both scope by `AuthContext` in their
 * repositories: `/api/filings` (`getFilings`) and `/api/client/compliances`
 * (`getPortalFilings`, every role inside `listScopedEngagementIds`). The
 * query keys are the ones Filings and the client portal use, so the cache is
 * shared and a window or proof save refreshes these pages too.
 */
export function useRegister(now: Date) {
  const fy = financialYearForDate(now).startYear;
  const current = useFilings({ fyStartYear: fy });
  const last = useFilings({ fyStartYear: fy - 1 });
  const currentFacts = useCompFilings(fy);
  const lastFacts = useCompFilings(fy - 1);

  const rows = useMemo<FilingRow[]>(() => {
    const seen = new Set<string>();
    const out: FilingRow[] = [];
    for (const row of [...(last.data?.rows ?? []), ...(current.data?.rows ?? [])]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    return out;
  }, [current.data?.rows, last.data?.rows]);

  const details = useMemo(() => {
    const map = new Map<string, PortalFiling>();
    for (const f of [...(lastFacts.data?.rows ?? []), ...(currentFacts.data?.rows ?? [])]) map.set(f.id, f);
    return map;
  }, [currentFacts.data?.rows, lastFacts.data?.rows]);

  return {
    rows,
    details,
    fyStartYear: fy,
    isPending: current.isPending || last.isPending,
    isError: current.isError && last.isError,
  };
}

/** Managers, admins and super admins set filing windows and edit proofs; leads and clients read. */
export function useMayWriteFilings(): boolean {
  const { user } = useApp();
  return canSetScheduleWindows(user?.role);
}
