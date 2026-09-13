"use client";

import { useCallback, useEffect, useMemo } from 'react';
import { useParams, redirect } from 'next/navigation';
import { RedirectTo } from '@/components/routing/RedirectTo';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { InternPhaseEntryCards } from '@/components/incorporation/InternOverviewProgress';
import { ProgressRing } from '@/components/noir';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { getActiveCatalogItems } from '@/data/checklist';
import { adminProjectPath, adminProjectStepPath } from '@/lib/project-step-path';
import {
  gateActiveCatalog,
  isChecklistStepSequentiallyComplete,
} from '@/lib/checklist-step-gate';
import {
  internOverviewCurrentItemInPhase,
  internOverviewPhases,
} from '@/lib/intern-overview-progress';
import { formatDate } from '@/lib/deadlines';
import { resolveEngagementFromRouteParam } from '@/lib/slug';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';

/**
 * STAFF PROJECT DETAIL (admin + manager) — the client's incorporation page,
 * not a lookalike.
 *
 * Opening a project from the Projects list lands here: the same header and the
 * same four phase rows (SPICe+ Part A / Part B / Post-incorporation /
 * Registration) the client sees on `/app/client/incorporation`, built from the
 * same `InternPhaseEntryCards`. Gates run with the `client` viewer, so nothing
 * on this surface (or the step workspace it opens) is editable — staff read
 * the project exactly as the client does. Firm-side actions live elsewhere
 * (Approvals, Email, People).
 */
export default function ProjectDetail() {
  const params = useParams();
  const slugParam = params.slug as string;
  const {
    engagements,
    engagementsLoading,
    getStateForEngagement,
    refreshEngagementChecklist,
  } = useApp();
  const staffBase = useStaffBasePath();

  const eng = useMemo(
    () => resolveEngagementFromRouteParam(engagements, slugParam),
    [engagements, slugParam],
  );
  const phases = useMemo(() => internOverviewPhases(), []);

  useEffect(() => {
    if (!eng?.id) return;
    void refreshEngagementChecklist(eng.id);
  }, [eng?.id, refreshEngagementChecklist]);

  const state = useMemo(
    () => (eng ? getStateForEngagement(eng) : {}),
    [eng, getStateForEngagement],
  );
  // Client viewer on purpose: read-only gating, identical to the client portal.
  const gates = useMemo(() => gateActiveCatalog(state, 'client'), [state]);

  /** A phase row opens that phase's live step — the same jump the client makes. */
  const phaseHref = useCallback(
    (phaseId: string): string | null => {
      if (!eng) return null;
      const phase = phases.find((entry) => entry.id === phaseId);
      if (!phase) return null;
      const item = internOverviewCurrentItemInPhase(phase.items, gates);
      return item ? adminProjectStepPath(eng, item, staffBase) : null;
    },
    [eng, phases, gates, staffBase],
  );

  if (!eng && engagementsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <HexgridLoader />
      </div>
    );
  }

  if (eng?.slug && slugParam !== eng.slug) {
    redirect(adminProjectPath(eng, staffBase));
  }

  if (!eng) return <RedirectTo href={`${staffBase}/projects`} />;

  const catalog = getActiveCatalogItems();
  const totalSteps = catalog.length;
  const totalDone = catalog.filter((item) =>
    isChecklistStepSequentiallyComplete(state[item.id]?.status ?? 'not-started', state[item.id]),
  ).length;
  const incorporationDate = eng.incorporationDate;

  return (
    <PageTransition>
      <SEO
        title={`${eng.companyName} — VCFO Suite`}
        description="Pre- and post-incorporation milestones for this India entity setup."
        path={adminProjectPath(eng, staffBase)}
      />

      <header className="mb-4 sm:mb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex min-w-0 items-center gap-1.5">
              <PageBackButton className="-ml-1.5" />
              <h1 className="serif min-w-0 text-2xl tracking-tight text-foreground sm:text-3xl">
                {eng.companyName}
              </h1>
            </div>
            <p className="font-mono text-[11px] tabular-nums text-text-tertiary">
              {totalDone}/{totalSteps}
              {incorporationDate ? ` · ${formatDate(new Date(incorporationDate))}` : ''}
            </p>
          </div>
          <ProgressRing value={Math.round((totalDone / totalSteps) * 100) || 0} size={52} />
        </div>
      </header>

      <div className="flex flex-col gap-3">
        <InternPhaseEntryCards phases={phases} gates={gates} hrefForPhase={phaseHref} />
      </div>
    </PageTransition>
  );
}
