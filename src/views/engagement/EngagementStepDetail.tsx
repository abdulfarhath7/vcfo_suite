"use client";

import { useEffect, useMemo, useState } from 'react';
import { redirect, useParams, usePathname, useRouter } from 'next/navigation';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { StepDetailContent } from '@/components/admin/StepDetailContent';
import { RedirectTo } from '@/components/routing/RedirectTo';
import {
  checklist,
  getActiveCatalogItems,
  type ChecklistItem,
} from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist-responses';
import { getStepAttachmentRequirements } from '@/lib/checklist-step-attachments';
import {
  internOverviewPhaseForItem,
  internRegistrationHeadingGroups,
} from '@/lib/intern-overview-progress';
import {
  adminProjectPath,
  adminProjectStepPath,
  internEngagementPath,
  internEngagementStepPath,
  isInternEngagementPathname,
} from '@/lib/project-step-path';
import {
  engagementRouteParamFromParams,
  resolveChecklistItemFromStepParam,
  resolveEngagementFromRouteParam,
} from '@/lib/slug';
import {
  ChecklistJourneyRail,
  type JourneyRailItem,
} from '@/components/incorporation/ChecklistJourneyRail';
import { Surface } from '@/components/noir';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import { useBoardResolutionProgress } from '@/lib/use-board-resolution-progress';
import {
  checklistGateViewerFrom,
  gateActiveCatalog,
  gateDisplayStatus,
  getStepGate,
  type ChecklistStepGate,
} from '@/lib/checklist-step-gate';
import type { BoardResolutionProgressSnapshot } from '@/lib/client-progress-board';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';

function journeyRailItems(
  steps: readonly ChecklistItem[],
  gates: Record<string, ChecklistStepGate>,
  checklistState: Record<string, ChecklistItemStateSlice | undefined>,
  brSnapshot: BoardResolutionProgressSnapshot | null | undefined,
): JourneyRailItem[] {
  return steps.map((step, index) => {
    const gate = getStepGate(gates, step.id);
    const slice = checklistState[step.id];
    return {
      item: step,
      gate,
      status: gateDisplayStatus(
        deriveChecklistDisplayStatus(step.id, step, slice, brSnapshot ?? undefined),
        gate,
      ),
      stepNumber: index + 1,
      attachments: getStepAttachmentRequirements(step, extractItemResponses(step, slice)),
    };
  });
}

/** Shared checklist step detail for admin projects and intern engagements. */
export default function EngagementStepDetail() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const {
    engagements,
    tasks,
    activity,
    updateTask,
    getStateForEngagement,
    refreshEngagementChecklist,
    engagementsLoading,
    user,
  } = useApp();
  const [checklistRefreshing, setChecklistRefreshing] = useState(false);

  const isInternRoute = isInternEngagementPathname(pathname);
  const isIntern = user?.role === 'intern' || isInternRoute;
  const engagementParam = engagementRouteParamFromParams(params);
  const stepParam = params.stepId as string;
  const staffRole = user?.role === 'admin' || user?.role === 'manager' ? user.role : 'manager';

  const projectPath = isInternRoute
    ? internEngagementPath
    : (p: Parameters<typeof adminProjectPath>[0]) => adminProjectPath(p, staffRole);
  const stepPath = isInternRoute
    ? internEngagementStepPath
    : (
        p: Parameters<typeof adminProjectStepPath>[0],
        step: Parameters<typeof adminProjectStepPath>[1],
      ) => adminProjectStepPath(p, step, staffRole);
  const listRedirect = isInternRoute
    ? '/app/intern/clients'
    : staffRole === 'admin'
      ? '/app/admin/projects'
      : '/app/manager/projects';

  const eng = useMemo(
    () => resolveEngagementFromRouteParam(engagements, engagementParam),
    [engagements, engagementParam],
  );
  const item = useMemo(
    () => resolveChecklistItemFromStepParam(stepParam),
    [stepParam],
  );
  const stepId = item?.id ?? stepParam;

  const eTasks = useMemo(
    () => tasks.filter((t) => t.engagementId === eng?.id),
    [tasks, eng?.id],
  );
  const task = eTasks.find((t) => t.checklistKey === stepId);
  const eActivity = useMemo(
    () => activity.filter((a) => a.engagementId === eng?.id).slice(0, 20),
    [activity, eng?.id],
  );

  const catalog = useMemo(() => getActiveCatalogItems(), []);
  const internPhase = useMemo(
    () => (item ? internOverviewPhaseForItem(item.id) : null),
    [item],
  );
  const bucketSteps = useMemo(() => {
    if (!item) return [];
    const fromCatalog = catalog.filter((c) => c.bucket === item.bucket);
    if (fromCatalog.length > 0) return fromCatalog;
    return checklist.filter((c) => c.bucket === item.bucket).sort((a, b) => a.order - b.order);
  }, [item, catalog]);

  useEffect(() => {
    if (!eng?.id) return;
    let cancelled = false;
    setChecklistRefreshing(true);
    void refreshEngagementChecklist(eng.id).finally(() => {
      if (!cancelled) setChecklistRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eng?.id, refreshEngagementChecklist]);

  const checklistState = useMemo(
    () => (eng ? getStateForEngagement(eng) : {}),
    [getStateForEngagement, eng],
  );

  const responses = useMemo(() => {
    if (!item) return undefined;
    return extractItemResponses(item, checklistState[item.id]);
  }, [item, checklistState]);

  const { snapshot: brSnapshot } = useBoardResolutionProgress(eng?.id);
  const viewer = checklistGateViewerFrom('admin', isInternRoute ? 'intern' : user?.role);
  const gates = useMemo(
    () => gateActiveCatalog(checklistState, viewer),
    [checklistState, viewer],
  );
  const stepGate = item ? getStepGate(gates, item.id) : undefined;

  if (eng && !isInternRoute && eng.slug && engagementParam !== eng.slug) {
    redirect(stepPath(eng, stepParam));
  }

  if (eng && item?.slug && stepParam !== item.slug) {
    redirect(stepPath(eng, item));
  }

  if (!eng) return <RedirectTo href={listRedirect} />;
  if (!item) return <RedirectTo href={projectPath(eng)} />;

  const checklistLoading = engagementsLoading || checklistRefreshing;
  if (!isInternRoute && !checklistLoading && stepGate?.kind === 'locked') {
    const current = catalog.find((row) => {
      const kind = gates[row.id]?.kind;
      return kind === 'active' || kind === 'waiting';
    });
    redirect(current ? stepPath(eng, current) : projectPath(eng));
  }

  const handleCompleted = (completedId: string) => {
    const completed = eTasks.find((t) => t.id === completedId);
    if (!completed) return;
    const meta = catalog.find((c) => c.id === completed.checklistKey);
    if (!meta) return;
    const idx = catalog.findIndex((c) => c.id === meta.id);
    const taskByChecklistKey = new Map(eTasks.map((t) => [t.checklistKey, t]));
    for (let i = idx + 1; i < catalog.length; i++) {
      const next = taskByChecklistKey.get(catalog[i].id);
      if (next && next.status === 'not-started') {
        updateTask(next.id, { status: 'in-progress' });
        break;
      }
    }
  };

  const railItems = journeyRailItems(bucketSteps, gates, checklistState, brSnapshot);
  const internPhaseRailItems = internPhase
    ? journeyRailItems(internPhase.items, gates, checklistState, brSnapshot)
    : [];
  const internPhaseRailGroups = (() => {
    if (!internPhase || internPhase.id !== 'registration-phase-4') return [];
    const byId = new Map(internPhaseRailItems.map((row) => [row.item.id, row]));
    return internRegistrationHeadingGroups(internPhase.items).map((group) => ({
      heading: group.heading,
      items: group.items
        .map((step) => byId.get(step.id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row)),
    }));
  })();

  const openStep = (id: string) => {
    const next = catalog.find((s) => s.id === id) ?? bucketSteps.find((s) => s.id === id);
    if (next) router.push(stepPath(eng, next));
  };

  const internWorkspace = isIntern;

  const stepTitleRow = (
    <div className="mb-4 flex min-w-0 items-center gap-1.5">
      <PageBackButton className="-ml-1.5" />
      <h1 className="serif min-w-0 text-[22px] leading-tight tracking-tight text-foreground">
        {item.title}
      </h1>
    </div>
  );

  const stepForm = (
    <>
      {stepGate?.kind === 'locked' && !isInternRoute ? (
        <Surface className="p-6 text-sm text-muted-foreground">{stepGate.message}</Surface>
      ) : (
        <StepDetailContent
          item={item}
          task={task}
          engagementId={eng.id}
          responses={responses}
          activity={eActivity}
          onCompleted={task ? handleCompleted : undefined}
          theme="light"
          contentReady={!checklistLoading}
          hideDocumentsTab={isIntern}
          hideTimeline={isIntern}
          hideStatus={isIntern}
          hideWorkspaceRail={isIntern}
        />
      )}
    </>
  );

  const internPhaseRail = internWorkspace && internPhase ? (
    <aside className="hidden lg:block lg:sticky lg:top-[var(--shell-sticky-top)] lg:self-start">
      <Surface className="p-3">
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {internPhase.title}
        </p>
        {internPhase.id === 'registration-phase-4' ? (
          <div className="space-y-4">
            {internPhaseRailGroups.map((group) => (
              <div key={group.heading}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.heading}
                </p>
                <ChecklistJourneyRail
                  items={group.items}
                  selectedId={item.id}
                  allowLockedOpen
                  hideTimeline
                  hideStatus
                  showAttachmentMenu
                  onSelect={openStep}
                />
              </div>
            ))}
          </div>
        ) : (
          <ChecklistJourneyRail
            items={internPhaseRailItems}
            selectedId={item.id}
            allowLockedOpen
            hideTimeline
            hideStatus
            showAttachmentMenu
            onSelect={openStep}
          />
        )}
      </Surface>
    </aside>
  ) : null;

  return (
    <PageTransition>
      <SEO
        title={`${item.title} — ${eng.companyName}`}
        description={`Checklist step for ${eng.companyName}: forms, activity, and client responses.`}
        path={stepPath(eng, item)}
      />

      {internWorkspace ? (
        <div className="min-w-0">
          {checklistLoading && (
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <HexgridLoader size="sm" />
              Syncing client answers…
            </div>
          )}
          {stepTitleRow}
          {internPhase ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18.5rem)] lg:items-start">
              <div className="min-w-0">{stepForm}</div>
              {internPhaseRail}
            </div>
          ) : (
            stepForm
          )}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(14rem,16rem)_minmax(0,1fr)]">
          <aside className="hidden lg:block lg:sticky lg:top-[var(--shell-sticky-top)] lg:self-start">
            <Surface className="max-h-[calc(100vh-var(--shell-sticky-top)-1.5rem)] overflow-y-auto p-3 sidebar-scroll">
              <ChecklistJourneyRail items={railItems} selectedId={item.id} onSelect={openStep} />
            </Surface>
          </aside>

          <div className="min-w-0">
            {checklistLoading && (
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <HexgridLoader size="sm" />
                Syncing client answers…
              </div>
            )}
            {stepTitleRow}
            {stepForm}
          </div>
        </div>
      )}
    </PageTransition>
  );
}
