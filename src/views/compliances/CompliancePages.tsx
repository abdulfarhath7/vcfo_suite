'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { ComplianceCalendarView } from '@/views/compliances/ComplianceCalendarView';
import { FilingsView } from '@/views/compliances/FilingsView';
import { RedirectTo } from '@/components/routing/RedirectTo';
import { complianceEngagementsForRole } from '@/lib/compliance/incorporation-state';
import {
  preIncorporationIdsOf,
  type ComplianceScope,
} from '@/views/compliances/compliance-scope';

/**
 * COMPLIANCES — the one call site of the shared module, for every shell.
 *
 * The route pages are server components, so this thin client wrapper is where
 * the scoped engagement roster is read off `useApp()` (already filtered by the
 * caller's `AuthContext`: a client's own company, a lead's assignments, a
 * manager's projects, the firm) and the pre-COI ids are derived once from
 * `isIncorporated`, the only source of that flag. The views stay
 * presentational and identical across shells; no view here or below touches
 * `db`.
 *
 * `basePath` is the shell's `…/compliances` root, passed by the route page so
 * client, intern, manager and admin each stay inside their own segment. The
 * audience only picks the wording of the pre-incorporation notice.
 */
function useComplianceScope(): {
  settled: boolean;
  scope: ComplianceScope;
  /** A lead with no incorporated engagement has nothing here — send them to Today. */
  leadHasNothing: boolean;
} {
  const { user, engagements: roster, engagementsSettled, getStateForEngagement } = useApp();
  // Lead-only: compliances exist for incorporated engagements. Other roles
  // keep the whole roster and see the pre-COI notice instead.
  const engagements = useMemo(
    () => complianceEngagementsForRole(user?.role, roster, getStateForEngagement),
    [user?.role, roster, getStateForEngagement],
  );
  const preIncorporationIds = useMemo(
    () => preIncorporationIdsOf(engagements, getStateForEngagement),
    [engagements, getStateForEngagement],
  );
  const audience = user?.role === 'client' ? 'client' : 'staff';
  const scope = useMemo<ComplianceScope>(
    () => ({ audience, engagements, preIncorporationIds }),
    [audience, engagements, preIncorporationIds],
  );
  const leadHasNothing = engagementsSettled && user?.role === 'intern' && engagements.length === 0;
  return { settled: engagementsSettled, scope, leadHasNothing };
}

const LEAD_HOME = '/app/intern/today';

/** The same skeleton the views show while the register loads. */
function Settling({ label }: { label: string }) {
  return (
    <div className="surface p-4" aria-busy="true" aria-label={label}>
      <div className="h-64 animate-pulse rounded-md bg-muted/40" />
    </div>
  );
}

export function ComplianceCalendarPage({ basePath }: { basePath: string }) {
  const { settled, scope, leadHasNothing } = useComplianceScope();
  if (!settled) return <Settling label="Loading calendar" />;
  if (leadHasNothing) return <RedirectTo href={LEAD_HOME} />;
  return <ComplianceCalendarView basePath={basePath} scope={scope} />;
}

export function FilingsPage({ basePath }: { basePath: string }) {
  const { settled, scope, leadHasNothing } = useComplianceScope();
  if (!settled) return <Settling label="Loading filings" />;
  if (leadHasNothing) return <RedirectTo href={LEAD_HOME} />;
  return <FilingsView basePath={basePath} scope={scope} />;
}
