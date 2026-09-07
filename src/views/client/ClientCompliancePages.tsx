'use client';

import { useApp } from '@/context/AppContext';
import { ComplianceCalendarView } from '@/views/compliances/ComplianceCalendarView';
import { FilingsView } from '@/views/compliances/FilingsView';
import type { PreIncorporationScope } from '@/components/compliances/PreIncorporationNotice';
import { findEngagementForClientUser } from '@/lib/checklist-state-key';
import { isIncorporated } from '@/lib/compliance/incorporation-state';

const CLIENT_COMPLIANCES_BASE = '/app/client/compliances';

/**
 * CLIENT COMPLIANCES — the client shell's call sites for the shared module.
 *
 * The route pages are server components, so this thin client wrapper is where
 * the client's own engagement is resolved and `preIncorporation` is derived —
 * from `isIncorporated`, the only source of that flag. The shared views stay
 * presentational and never look the engagement up themselves.
 *
 * A super admin inspecting the portal has no engagement pinned (see
 * `enterAs.client` in `src/lib/super-overview.ts`), so no scope is passed and
 * the views keep their firm-wide behaviour.
 */
function useClientPreIncorporation(): {
  settled: boolean;
  scope: PreIncorporationScope | undefined;
} {
  const { user, engagements, engagementsSettled, getStateForEngagement } = useApp();
  const engagement =
    user?.role === 'client' ? findEngagementForClientUser(engagements, user) : undefined;

  if (!engagement) return { settled: engagementsSettled || user?.role !== 'client', scope: undefined };
  const incorporated = isIncorporated(engagement, getStateForEngagement(engagement));
  return {
    settled: true,
    scope: incorporated
      ? undefined
      : { audience: 'client', companyName: engagement.companyName },
  };
}

/** The same skeleton the views show while the register loads. */
function Settling({ label }: { label: string }) {
  return (
    <div className="surface p-4" aria-busy="true" aria-label={label}>
      <div className="h-64 animate-pulse rounded-md bg-muted/40" />
    </div>
  );
}

export function ClientComplianceCalendarPage() {
  const { settled, scope } = useClientPreIncorporation();
  if (!settled) return <Settling label="Loading calendar" />;
  return <ComplianceCalendarView basePath={CLIENT_COMPLIANCES_BASE} preIncorporation={scope} />;
}

export function ClientFilingsPage() {
  const { settled, scope } = useClientPreIncorporation();
  if (!settled) return <Settling label="Loading filings" />;
  return <FilingsView basePath={CLIENT_COMPLIANCES_BASE} preIncorporation={scope} />;
}
