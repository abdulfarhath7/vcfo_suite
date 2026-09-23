"use client";

import { useEffect, useMemo, useState } from 'react';
import { redirect, useParams, usePathname, useRouter } from 'next/navigation';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { ClientChangeRequestButton } from '@/components/client/ClientChangeRequestButton';
import { ClientStepApproveButton } from '@/components/client/ClientStepApproveButton';
import { stepApprovalLabel } from '@/lib/checklist-step-approval';
import { SEO } from '@/components/SEO';
import { StepDetailContent } from '@/components/admin/StepDetailContent';
import { RedirectTo } from '@/components/routing/RedirectTo';
import {
  checklist,
  getActiveCatalogItems,
  type ChecklistItem,
} from '@/data/checklist';
import type { OwnershipType } from '@/data/engagements';
import { useQueryClient } from '@tanstack/react-query';
import { ScheduleWindowControl } from '@/components/schedule/ScheduleWindowControl';
import { setEngagementWindowInDb } from '@/lib/engagements-db';
import {
  canSetScheduleWindows,
  formatWindow,
  isIncorporationWindowStep,
  windowForStep,
  type EngagementSchedule,
} from '@/lib/schedule-windows';
import { extractItemResponses, getClientResponseFields } from '@/lib/checklist-responses';
import { filterFieldsByViewer, hasResponseFormFields } from '@/lib/checklist-field-access';
import { isStepReleasedToClient, isStepReleasedToFirm } from '@/lib/checklist-visibility';
import { getStepAttachmentRequirements } from '@/lib/checklist-step-attachments';
import {
  internOverviewPhaseForItem,
  internRegistrationHeadingGroups,
} from '@/lib/intern-overview-progress';
import {
  adminProjectPath,
  adminProjectStepPath,
  clientIncorporationPath,
  clientIncorporationStepPath,
  internEngagementPath,
  internEngagementStepPath,
  isClientIncorporationStepPathname,
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
import { DocPackHeaderButton } from '@/components/doc-pack/DocPackHeaderButton';
import { DocPackRailCard } from '@/components/doc-pack/DocPackRailCard';
import { DocSourceStrip } from '@/components/doc-pack/DocSourceStrip';
import { CopyForAssist } from '@/components/assist-profile/CopyForAssist';
import { ASSIST_PROFILE_STEP_IDS } from '@/lib/assist-profile/paths';
import { useDocPack } from '@/hooks/use-doc-pack';
import { docPackPagePath, docPackStepPath, type DocPackShell } from '@/lib/doc-pack/paths';
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
import { findEngagementForClientUser } from '@/lib/checklist-state-key';

function journeyRailItems(
  steps: readonly ChecklistItem[],
  gates: Record<string, ChecklistStepGate>,
  checklistState: Record<string, ChecklistItemStateSlice | undefined>,
  brSnapshot: BoardResolutionProgressSnapshot | null | undefined,
  ownershipType: OwnershipType | undefined,
  schedule: EngagementSchedule | undefined,
): JourneyRailItem[] {
  return steps.map((step, index) => {
    const gate = getStepGate(gates, step.id);
    const slice = checklistState[step.id];
    const window = windowForStep(schedule, step.id);
    return {
      ...(window ? { windowLabel: formatWindow(window) } : {}),
      item: step,
      gate,
      status: gateDisplayStatus(
        deriveChecklistDisplayStatus(step.id, step, slice, brSnapshot ?? undefined),
        gate,
      ),
      stepNumber: index + 1,
      attachments: getStepAttachmentRequirements(
        step,
        extractItemResponses(step, slice),
        ownershipType,
      ),
    };
  });
}

/**
 * Shared checklist step detail for admin projects, intern engagements, and the
 * client portal. One component, three routes — the client opens exactly the
 * screen the project lead opens, minus the firm-side controls, which
 * `viewer="client"` removes inside `StepDetailContent`.
 */
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
    engagementsSettled,
    user,
  } = useApp();
  const [checklistRefreshing, setChecklistRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const isClientRoute = isClientIncorporationStepPathname(pathname);
  const isInternRoute = isInternEngagementPathname(pathname);
  const isIntern = user?.role === 'intern' || isInternRoute;
  /**
   * Everyone but the lead reads. The client always did; admin and manager open
   * the same layout with the lead's filled fields locked, plus the Accept /
   * Reject pair when the step is waiting on their decision.
   */
  const readOnlyView = isClientRoute || !isIntern;
  const engagementParam = engagementRouteParamFromParams(params);
  const stepParam = params.stepId as string;
  const staffRole = user?.role === 'admin' || user?.role === 'manager' ? user.role : 'manager';

  const projectPath = isClientRoute
    ? () => clientIncorporationPath()
    : isInternRoute
      ? internEngagementPath
      : (p: Parameters<typeof adminProjectPath>[0]) => adminProjectPath(p, staffRole);
  const stepPath = isClientRoute
    ? (_p: unknown, step: string | ChecklistItem) => clientIncorporationStepPath(step)
    : isInternRoute
      ? internEngagementStepPath
      : (
          p: Parameters<typeof adminProjectStepPath>[0],
          step: Parameters<typeof adminProjectStepPath>[1],
        ) => adminProjectStepPath(p, step, staffRole);
  const listRedirect = isClientRoute
    ? clientIncorporationPath()
    : isInternRoute
      ? '/app/intern/clients'
      : staffRole === 'admin'
        ? '/app/admin/projects'
        : '/app/manager/projects';

  // The client route carries no `{id}`: a client has exactly one engagement, and
  // resolving it from the session is also what keeps the surface scoped.
  const eng = useMemo(
    () =>
      isClientRoute
        ? (user ? findEngagementForClientUser(engagements, user) : undefined)
        : resolveEngagementFromRouteParam(engagements, engagementParam),
    [engagements, engagementParam, isClientRoute, user],
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
  // The document pack is a staff surface for the two SPICe+ phases only.
  const docPackVisible =
    !isClientRoute &&
    (internPhase?.id === 'pre-inc-phase-1' || internPhase?.id === 'pre-inc-phase-2');
  const docPack = useDocPack(docPackVisible ? eng?.id : null);
  const docPackShell: DocPackShell = isInternRoute ? 'intern' : staffRole;
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
  const viewer = checklistGateViewerFrom(
    isClientRoute ? 'client' : 'admin',
    isIntern ? 'intern' : user?.role,
  );
  const gates = useMemo(
    () => gateActiveCatalog(checklistState, viewer),
    [checklistState, viewer],
  );
  const stepGate = item ? getStepGate(gates, item.id) : undefined;

  if (eng && !isInternRoute && !isClientRoute && eng.slug && engagementParam !== eng.slug) {
    redirect(stepPath(eng, stepParam));
  }

  if (eng && item?.slug && stepParam !== item.slug) {
    redirect(stepPath(eng, item));
  }

  // Wait for the engagement list before deciding there is no engagement: on a
  // cold load this guard fired first and bounced a hard refresh back to the
  // checklist, which looked exactly like a step being locked.
  //
  // `engagementsLoading` alone is not enough. The engagements query is
  // `enabled: Boolean(user)`, so while the session is still hydrating the query
  // is idle and `isLoading` is FALSE with an empty list — which is how the
  // redirect kept firing intermittently. `engagementsSettled` is true only once
  // the query has actually resolved, so a genuinely engagement-less caller
  // still redirects rather than spinning.
  if (!eng) {
    // `user` can be momentarily null across a soft navigation between step
    // routes; on the client route `eng` is derived from it, so redirecting on
    // that tick bounced the reader out of a step they were allowed to read.
    if (!engagementsSettled || !user) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <HexgridLoader />
        </div>
      );
    }
    return <RedirectTo href={listRedirect} />;
  }
  if (!item) return <RedirectTo href={projectPath(eng)} />;

  const checklistLoading = engagementsLoading || checklistRefreshing;
  // Nobody is bounced off a locked step: readers may open any step in any
  // order — the gate governs actions, not access.

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

  const clientVisibleFields = isClientRoute
    ? filterFieldsByViewer(getClientResponseFields(item), 'client')
    : [];
  const clientHasContent = clientVisibleFields.some((field) =>
    String(responses?.[field.id] ?? '').trim().length > 0,
  );
  /**
   * The step is not this reader's yet → the calm "what this step captures"
   * card, not a form of dashes. For the client that is until the manager
   * accepts it (the API already strips the answers); for a manager or admin,
   * until the lead asks for their approval. A released step with nothing to
   * show still renders as the record so the client's Approve stays reachable.
   */
  const stepSlice = checklistState[item.id];
  const clientNothingYet =
    isClientRoute && !isStepReleasedToClient(stepSlice) && !clientHasContent;
  const staffAwaitingLead =
    readOnlyView &&
    !isClientRoute &&
    hasResponseFormFields(item, 'admin') &&
    !isStepReleasedToFirm(stepSlice);
  const nothingYetIntro = staffAwaitingLead
    ? 'Your project lead is still preparing this step. Their answers appear here once they ask for your approval.'
    : undefined;

  const railItems = journeyRailItems(
    bucketSteps,
    gates,
    checklistState,
    brSnapshot,
    eng.ownershipType,
    eng.schedule,
  );
  const internPhaseRailItems = internPhase
    ? journeyRailItems(
        internPhase.items,
        gates,
        checklistState,
        brSnapshot,
        eng.ownershipType,
        eng.schedule,
      )
    : [];
  /**
   * A manager or admin sets this step's window here (registrations and any
   * step outside SPICe+ Part A / B — those share the one incorporation window
   * set on the project page). Leads and clients see the dates on the rail.
   */
  const stepWindowControl =
    !isClientRoute && !isIntern && canSetScheduleWindows(user?.role) && !isIncorporationWindowStep(item.id) ? (
      <div className="mb-3">
        <ScheduleWindowControl
          value={eng.schedule?.steps?.[item.id]}
          label={item.title}
          onSave={async (window) => {
            await setEngagementWindowInDb(eng.id, { kind: 'step', itemId: item.id }, window);
            await queryClient.invalidateQueries({ queryKey: ['engagements'] });
          }}
        />
      </div>
    ) : null;
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

  // Readers get the lead's workspace layout, not the old staff rail layout.
  const internWorkspace = isIntern || readOnlyView;

  const approvalLabel = isClientRoute ? stepApprovalLabel(checklistState[item.id]) : null;

  const docPackHref = docPackVisible
    ? docPackPagePath(eng, docPackShell, internPhase?.id === 'pre-inc-phase-1' ? 'part-a' : 'part-b')
    : null;

  const stepTitleRow = (
    <div className="mb-4 flex min-w-0 items-center gap-1.5">
      <PageBackButton className="-ml-1.5" />
      <h1 className="serif min-w-0 text-[22px] leading-tight tracking-tight text-foreground">
        {item.title}
      </h1>
      {/* Narrow screens lose the rail (and its card); this stands in, never both. */}
      {docPackHref ? (
        <DocPackHeaderButton summary={docPack.data} packHref={docPackHref} className="ml-auto lg:hidden" />
      ) : null}
    </div>
  );

  const docPackRailCard = docPackHref ? (
    <DocPackRailCard
      className="mt-4"
      summary={docPack.data}
      loading={docPack.isPending}
      error={docPack.isError}
      packHref={docPackHref}
      currentStepId={item.id}
      hrefForMissing={(input) => docPackStepPath(eng, docPackShell, input.stepId, input.tabId)}
    />
  ) : null;

  const stepForm = (
    <>
      {stepWindowControl}
      {docPackHref && docPack.data ? (
        <DocSourceStrip summary={docPack.data} stepId={item.id} packHref={docPackHref} />
      ) : null}
      {/* Staff shell only: the client never sees the Assist profile. */}
      {!isClientRoute && ASSIST_PROFILE_STEP_IDS.has(item.id) ? (
        <CopyForAssist
          engagementId={eng.id}
          hrefForMissing={(input) => docPackStepPath(eng, docPackShell, input.stepId, input.tabId)}
        />
      ) : null}
      <StepDetailContent
        item={item}
        task={task}
        engagementId={eng.id}
        responses={responses}
        activity={eActivity}
        onCompleted={task ? handleCompleted : undefined}
        theme="light"
        contentReady={!checklistLoading}
        hideDocumentsTab={internWorkspace}
        hideStatus={internWorkspace}
        hideWorkspaceRail={internWorkspace}
        viewer={isClientRoute ? 'client' : 'staff'}
        readOnly={readOnlyView && !isClientRoute}
        clientNothingYet={clientNothingYet || staffAwaitingLead}
        nothingYetIntro={nothingYetIntro}
      />

      {/* The client's two actions on a step, at STEP level — never per tab.
          They never edit the step itself, so this is the whole of what they
          can do: sign it off, or say what should change. */}
      {isClientRoute && (approvalLabel || !clientNothingYet) ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          {approvalLabel ? (
            <span className="mr-auto text-[12px] text-muted-foreground">{approvalLabel}</span>
          ) : null}
          {/* While the firm holds the step (a change the client asked for is
              being made) only the status line remains — nothing to act on. */}
          {!clientNothingYet ? (
            <>
              <ClientChangeRequestButton
                engagementId={eng.id}
                stepId={item.id}
                stepTitle={item.title}
              />
              <ClientStepApproveButton
                engagementId={eng.id}
                stepId={item.id}
                itemState={checklistState[item.id]}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );

  /**
   * Every rail row opens, for the lead and for the client alike. Nothing is
   * locked for VIEWING: the sequential gate now governs actions only, and the
   * rail's node icons carry progress (tick done / blue current / dim upcoming).
   */
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
            hideStatus
            showAttachmentMenu
            onSelect={openStep}
          />
        )}
      </Surface>
      {docPackRailCard}
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
