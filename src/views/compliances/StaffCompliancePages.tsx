'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { ComplianceCalendarView } from '@/views/compliances/ComplianceCalendarView';
import { FilingsView } from '@/views/compliances/FilingsView';
import {
  preIncorporationIdsOf,
  type ComplianceStaffScope,
} from '@/views/compliances/staff-scope';

/**
 * STAFF COMPLIANCES — the firm shells' call sites for the shared module.
 *
 * Mirrors `ClientCompliancePages`: the route pages are server components, so
 * this thin client wrapper is where the scoped engagement roster is read off
 * `useApp()` (already filtered by the caller's `AuthContext` — admin firm-wide,
 * manager owned, lead assigned) and the pre-COI ids are derived once from
 * `isIncorporated`. The shared views stay presentational; no view here or
 * below touches `db`.
 *
 * `basePath` is the shell's `…/compliances` root, passed by the route page so
 * admin, manager and intern each stay inside their own segment.
 */
function useStaffScope(): { settled: boolean; scope: ComplianceStaffScope } {
  const { engagements, engagementsSettled, getStateForEngagement } = useApp();
  const preIncorporationIds = useMemo(
    () => preIncorporationIdsOf(engagements, getStateForEngagement),
    [engagements, getStateForEngagement],
  );
  const scope = useMemo(
    () => ({ engagements, preIncorporationIds }),
    [engagements, preIncorporationIds],
  );
  return { settled: engagementsSettled, scope };
}

/** The same skeleton the views show while the register loads. */
function Settling({ label }: { label: string }) {
  return (
    <div className="surface p-4" aria-busy="true" aria-label={label}>
      <div className="h-64 animate-pulse rounded-md bg-muted/40" />
    </div>
  );
}

export function StaffComplianceCalendarPage({ basePath }: { basePath: string }) {
  const { settled, scope } = useStaffScope();
  if (!settled) return <Settling label="Loading calendar" />;
  return <ComplianceCalendarView basePath={basePath} audience="staff" staff={scope} />;
}

export function StaffFilingsPage({ basePath }: { basePath: string }) {
  const { settled, scope } = useStaffScope();
  if (!settled) return <Settling label="Loading filings" />;
  return <FilingsView basePath={basePath} audience="staff" staff={scope} />;
}
