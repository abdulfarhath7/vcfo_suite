"use client";

import { useCallback, useEffect, useMemo } from 'react';
import { useParams, redirect } from 'next/navigation';
import { RedirectTo } from '@/components/routing/RedirectTo';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { InternPhaseEntryCards } from '@/components/incorporation/InternOverviewProgress';
import { TimelineRequestsPanel } from '@/components/incorporation/TimelineRequestsPanel';
import { WorkItemsPanel } from '@/components/incorporation/WorkItemsPanel';
import { PhaseBar } from '@/components/ui/step-track';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { RecordStat, RecordStats, RecordTile } from '@/components/incorporation/RecordHead';
import { STAGE_LABEL, type Stage } from '@/components/admin/create-project-form-utils';
import { DocPackPhasePill } from '@/components/doc-pack/DocPackPhasePill';
import { useDocPack } from '@/hooks/use-doc-pack';
import { docPackPagePath } from '@/lib/doc-pack/paths';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { getActiveCatalogItems } from '@/data/checklist';
import { adminProjectPath, adminProjectStepPath } from '@/lib/projects/project-step-path';
import {
  gateActiveCatalog,
  isChecklistStepSequentiallyComplete,
} from '@/lib/checklist/checklist-step-gate';
import {
  internOverviewCurrentItemInPhase,
  internOverviewPhases,
  internPhaseStepCounts,
} from '@/lib/intern/intern-overview-progress';
import { formatDate } from '@/lib/projects/deadlines';
import { resolveEngagementFromRouteParam } from '@/lib/slug';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { useQueryClient } from '@tanstack/react-query';
import { ScheduleWindowControl } from '@/components/schedule/ScheduleWindowControl';
import { phaseWindowMeta } from '@/components/schedule/phase-window-meta';
import { setEngagementWindowInDb } from '@/lib/projects/engagements-db';
import { canSetScheduleWindows } from '@/lib/projects/schedule-windows';

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
const STAGE_TONE: Record<string, ChipTone> = {
  'Pre-Incorporation': 'violet',
  'Post-Incorporation': 'prog',
  'Operational Readiness': 'teal',
};

export default function ProjectDetail() {
  const params = useParams();
  const slugParam = params.slug as string;
  const {
    engagements,
    engagementsLoading,
    getStateForEngagement,
    refreshEngagementChecklist,
    user,
  } = useApp();
  const staffBase = useStaffBasePath();
  const queryClient = useQueryClient();

  const eng = useMemo(
    () => resolveEngagementFromRouteParam(engagements, slugParam),
    [engagements, slugParam],
  );
  const phases = useMemo(() => internOverviewPhases(), []);
  const docPack = useDocPack(eng?.id);
  const docPackPill = useCallback(
    (phaseId: string) => {
      const part = phaseId === 'pre-inc-phase-1' ? 'part-a' : phaseId === 'pre-inc-phase-2' ? 'part-b' : null;
      if (!part || !eng) return null;
      return <DocPackPhasePill summary={docPack.data} href={docPackPagePath(eng, staffBase, part)} />;
    },
    [docPack.data, eng, staffBase],
  );

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
    isChecklistStepSequentiallyComplete(state[item.id]?.status ?? 'not-started', state[item.id], item.id),
  ).length;
  const incorporationDate = eng.incorporationDate;
  const phaseCounts = phases.map((phase) => internPhaseStepCounts(phase.items, gates));

  return (
    <PageTransition>
      <SEO
        title={`${eng.companyName} — VCFO Suite`}
        description="Pre- and post-incorporation milestones for this India entity setup."
        path={adminProjectPath(eng, staffBase)}
      />

      {/* Plain record head (VCFO Spectrum C-0108): no band, no back link (R-09), the ST5 bars. */}
      <header className="mb-5 grid gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <RecordTile name={eng.companyName} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="min-w-0 text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">{eng.companyName}</h1>
              {eng.stage ? (
                <Chip tone={STAGE_TONE[eng.stage] ?? 'idle'} dot={false} fixed>
                  {STAGE_LABEL[eng.stage as Stage] ?? eng.stage}
                </Chip>
              ) : null}
            </div>
            {eng.clientEmail?.trim() ? (
              <p className="text-[13.5px] text-ink-muted">
                <a href={`mailto:${eng.clientEmail.trim()}`} className="hover:text-ink hover:underline">
                  {eng.clientEmail.trim()}
                </a>
              </p>
            ) : null}
          </div>
        </div>
        <RecordStats>
          <RecordStat value={`${totalDone}/${totalSteps}`} label="steps done" />
          {incorporationDate ? <RecordStat value={formatDate(new Date(incorporationDate))} label="incorporated" /> : null}
          <PhaseBar
            tall
            className="w-[min(320px,100%)]"
            done={phaseCounts.map((p) => p.done)}
            totals={phaseCounts.map((p) => p.total)}
            names={phases.map((p) => p.title)}
          />
        </RecordStats>
        {/* One window for SPICe+ Part A + Part B together. Managers and
            admins set it here; leads and clients read it on the phase rows. */}
        {canSetScheduleWindows(user?.role) ? (
          <ScheduleWindowControl
            value={eng.schedule?.incorporation}
            label="Incorporation"
            onSave={async (window) => {
              await setEngagementWindowInDb(eng.id, { kind: 'incorporation' }, window);
              await queryClient.invalidateQueries({ queryKey: ['engagements'] });
            }}
          />
        ) : null}
      </header>

      <TimelineRequestsPanel engagementId={eng.id} canDecide={canSetScheduleWindows(user?.role)} />
      <div className="flex flex-col gap-3">
        <InternPhaseEntryCards
          phases={phases}
          gates={gates}
          hrefForPhase={phaseHref}
          metaForPhase={phaseWindowMeta(eng.schedule)}
          trailingForPhase={docPackPill}
        />
      </div>
      <WorkItemsPanel engagementId={eng.id} />
    </PageTransition>
  );
}
