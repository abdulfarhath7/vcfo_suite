"use client";

import { ClientFileRequestsPanel } from "@/components/incorporation/ClientFileRequestsPanel";
import { WhatsThisButton } from '@/components/ask/WhatsThisButton';
import { useEffect, useMemo, useState } from 'react';
import { redirect, useParams, usePathname, useRouter } from 'next/navigation';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { ClientChangeRequestButton } from '@/components/client/ClientChangeRequestButton';
import { ClientStepApproveButton } from '@/components/client/ClientStepApproveButton';
import { stepApprovalLabel } from '@/lib/checklist/checklist-step-approval';
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
import { DashSection } from '@/components/dash/DashSection';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { StepAboutPanel } from '@/views/client-record/StepAboutPanel';
import { recordStepPlace } from '@/views/client-record/RecordHeadParts';
import { StepWindowBar } from '@/views/engagement/step/StepWindowBar';
import { setEngagementWindowInDb } from '@/lib/projects/engagements-db';
import {
  canSetScheduleWindows,
  formatWindow,
  isIncorporationWindowStep,
  type ScheduleTarget,
  windowForStep,
  type EngagementSchedule,
} from '@/lib/projects/schedule-windows';
import { extractItemResponses, getClientResponseFields } from '@/lib/checklist/checklist-responses';
import { filterFieldsByViewer, hasResponseFormFields } from '@/lib/checklist/checklist-field-access';
import { isStepReleasedToClient, isStepReleasedToFirm } from '@/lib/checklist/checklist-visibility';
import { getStepAttachmentRequirements } from '@/lib/checklist/checklist-step-attachments';
import {
  internOverviewPhaseForItem,
  internRegistrationHeadingGroups,
} from '@/lib/intern/intern-overview-progress';
import {
  adminProjectPath,
  adminProjectStepPath,
  clientIncorporationPath,
  clientIncorporationStepPath,
  internEngagementPath,
  internEngagementStepPath,
  isClientIncorporationStepPathname,
  isInternEngagementPathname,
} from '@/lib/projects/project-step-path';
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
import { StepMark } from '@/components/ui/step-track';
import { stepMarkForStatus } from '@/components/incorporation/step-mark-for-gate';
import { ChecklistStatusPill } from '@/components/incorporation/ChecklistStatusBadge';
import { DocPackHeaderButton } from '@/components/doc-pack/DocPackHeaderButton';
import { DocPackRailCard } from '@/components/doc-pack/DocPackRailCard';
import { CopyForAssist } from '@/components/assist-profile/CopyForAssist';
import { ReopenStepButton } from '@/components/incorporation/ReopenStepButton';
import { ASSIST_PROFILE_STEP_IDS } from '@/lib/assist-profile/paths';
import { useDocPack } from '@/hooks/use-doc-pack';
import { docPackPagePath, docPackStepPath, type DocPackShell } from '@/lib/doc-pack/paths';
import { shortDate } from '@/components/timeline/timeline-model';
import { deriveChecklistDisplayStatus } from '@/lib/checklist/checklist-display-status';
import { useBoardResolutionProgress } from '@/hooks/use-board-resolution-progress';
import {
  checklistGateViewerFrom,
  gateActiveCatalog,
  gateDisplayStatus,
  getStepGate,
  type ChecklistStepGate,
} from '@/lib/checklist/checklist-step-gate';
import type { BoardResolutionProgressSnapshot } from '@/lib/client/client-progress-board';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { findEngagementForClientUser } from '@/lib/checklist/checklist-state-key';
import {
  directFlowRoleLabel,
  isDirectFlowStep,
  isDirectFlowStepComplete,
  isWaitingOnLead,
} from '@/lib/incorporation/pre-inc-direct-flow';

/** The record's names for the phases (prototype `PHASES`), for the staff step head and rail. */
const PHASE_SHORT: Record<string, string> = {
  'pre-inc-phase-1': 'Name application',
  'pre-inc-phase-2': 'Incorporation',
  'post-inc-phase-3': 'Post-incorporation',
  'registration-phase-4': 'Registrations',
};
const PHASE_RAIL: Record<string, string> = {
  'pre-inc-phase-1': 'Phase 1 · Name application',
  'pre-inc-phase-2': 'SPICe+ Part B',
  'post-inc-phase-3': 'Phase 3 · Post-incorporation',
  'registration-phase-4': 'Registrations',
};

/** "Last edited by Kiran Rao (Client), 12 Oct 2026, 4:05 pm" — IST, like every other time in the app. */
function lastEditedLine(slice: ChecklistItemStateSlice | undefined): string | null {
  const at = slice?.lastEditedAt?.trim();
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  const when = date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });
  const who = slice?.lastEditedByName?.trim() || 'Someone';
  return `Last edited by ${who} (${directFlowRoleLabel(slice?.lastEditedByRole)}), ${when}`;
}

function journeyRailItems(
  steps: readonly ChecklistItem[],
  gates: Record<string, ChecklistStepGate>,
  checklistState: Record<string, ChecklistItemStateSlice | undefined>,
  brSnapshot: BoardResolutionProgressSnapshot | null | undefined,
  ownershipType: OwnershipType | undefined,
  schedule: EngagementSchedule | undefined,
  viewerIsClient: boolean,
): JourneyRailItem[] {
  return steps.map((step, index) => {
    const gate = getStepGate(gates, step.id);
    const slice = checklistState[step.id];
    const window = windowForStep(schedule, step.id);
    return {
      ...(window && viewerIsClient ? { windowLabel: formatWindow(window) } : {}),
      ...(!viewerIsClient ? { stepCode: recordStepPlace(step.id)?.code } : {}),
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
  /* "What's this?" (S-487): the staff panel about this step. */
  const [aboutOpen, setAboutOpen] = useState(false);
  const [stepTab, setStepTab] = useState('forms');
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
    if (!engagementsSettled || !user) return <StepLoadingShapes />;
    return <RedirectTo href={listRedirect} />;
  }
  /* S-519: an unknown step shows a "Step" card with a dashed "No step" area, not a bounce. */
  if (!item) {
    return (
      <DashSection title="Step" bodyClassName="p-4">
        <EmptyState
          title="No step"
          action={
            <Button variant="secondary" size="sm" onClick={() => router.push(projectPath(eng))}>
              Open {eng.companyName}
            </Button>
          }
        />
      </DashSection>
    );
  }

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
    ? filterFieldsByViewer(getClientResponseFields(item), 'client', item.id)
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
    isClientRoute && !isStepReleasedToClient(stepSlice, item.id) && !clientHasContent;
  const staffAwaitingLead =
    readOnlyView &&
    !isClientRoute &&
    hasResponseFormFields(item, 'admin') &&
    !isStepReleasedToFirm(stepSlice, item.id);
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
    isClientRoute,
  );
  const internPhaseRailItems = internPhase
    ? journeyRailItems(
        internPhase.items,
        gates,
        checklistState,
        brSnapshot,
        eng.ownershipType,
        eng.schedule,
        isClientRoute,
      )
    : [];
  /**
   * The window bar (S-489) for every staff reader. A manager, admin or super admin edits it
   * (`canSetScheduleWindows`, enforced again in the repository); leads read it. A SPICe+ Part A
   * or Part B step without a window of its own shares the one incorporation window, so its
   * "Edit" moves that window, the same one the project page sets.
   */
  const stepWindowTarget: ScheduleTarget =
    isIncorporationWindowStep(item.id) && !eng.schedule?.steps?.[item.id]
      ? { kind: 'incorporation' }
      : { kind: 'step', itemId: item.id };
  const stepWindowValue = windowForStep(eng.schedule, item.id);
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
  /* S-486: every staff reader sees the step's status chip in the head. The client route keeps
     its approval line instead, as before. */
  const showHeadStatus = !isClientRoute;

  // Direct-flow steps have no approval: no status pill, no Approve button.
  const directFlow = isDirectFlowStep(item.id);
  const approvalLabel =
    isClientRoute && !directFlow ? stepApprovalLabel(checklistState[item.id]) : null;
  const directFlowComplete = directFlow && isDirectFlowStepComplete(item.id, stepSlice);
  const editedLine = directFlow ? lastEditedLine(stepSlice) : null;
  /** Gate copy the light layout would otherwise never show (waiting / opens after …). */
  const gateNotice =
    directFlow && stepGate?.message && (stepGate.kind === 'waiting' || stepGate.kind === 'locked')
      ? stepGate.message
      : null;
  const leadWaitingNotice =
    directFlow && isIntern && isWaitingOnLead(item.id, stepSlice)
      ? `${stepSlice?.waitingOnLeadByName?.trim() || 'The client'} submitted their part. Fill the NIC codes, then submit to complete this step.`
      : null;

  const docPackHref = docPackVisible
    ? docPackPagePath(eng, docPackShell, internPhase?.id === 'pre-inc-phase-1' ? 'part-a' : 'part-b')
    : null;

  /* Plain step head (VCFO Spectrum, prototype `StepView`): the ST5 mark, the 28px title, a muted
     line with the step code, company and phase, then the status chip. No back link on staff
     screens (R-09): the rail and the record already lead back. */
  const selfRow =
    internPhaseRailItems.find((row) => row.item.id === item.id) ?? railItems.find((row) => row.item.id === item.id);
  const selfStatus = selfRow ? gateDisplayStatus(selfRow.status, selfRow.gate) : null;
  const selfMark = selfStatus ? stepMarkForStatus(selfStatus) : null;
  const staffCode = isClientRoute ? null : recordStepPlace(item.id)?.code ?? null;
  const headCode = staffCode ?? (selfRow ? `Step ${selfRow.stepNumber}` : null);
  /* Activity on this step, as `StepDetailContent` filters it: the tab beside Forms (prototype `StepView`). */
  const activityNeedle = item.title.toLowerCase().split(' ').slice(0, 2).join(' ');
  const stepActivity = eActivity.filter(
    (a) => a.target?.toLowerCase().includes(activityNeedle) || item.forms.some((f) => a.target?.toLowerCase().includes(f.toLowerCase())),
  );
  const stepTitleRow = (
    <header className="mb-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      {isClientRoute ? <PageBackButton className="-ml-1.5" /> : null}
      {selfMark ? <StepMark state={selfMark.state} tone={selfMark.tone} label={selfMark.label} /> : null}
      <div className="min-w-0 flex-[1_1_280px]">
        <h1 className="min-w-0 text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">
          {item.title}
        </h1>
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-[13.5px] text-ink-muted">
          {headCode ? <span className="font-mono text-[13px]">{headCode}</span> : null}
          {headCode ? <span aria-hidden>·</span> : null}
          <span className="min-w-0 truncate">{eng.companyName}</span>
          {internPhase ? (
            <>
              <span aria-hidden>·</span>
              <span>{isClientRoute ? internPhase.title : PHASE_SHORT[internPhase.id] ?? internPhase.title}</span>
            </>
          ) : null}
        </p>
      </div>
      {selfStatus && showHeadStatus ? <ChecklistStatusPill status={selfStatus} /> : null}
      {isClientRoute ? (
        <WhatsThisButton kind="step" refId={item.id} label={item.title} />
      ) : (
        <WhatsThisButton kind="step" refId={item.id} label={item.title} variant="outline" className="h-control-md px-3.5 text-[14px]" onOpen={() => setAboutOpen(true)} />
      )}
      {/* Narrow screens lose the rail (and its card); this stands in, never both. */}
      {docPackHref ? (
        <DocPackHeaderButton summary={docPack.data} packHref={docPackHref} className="lg:hidden" />
      ) : null}
    </header>
  );
  const stepMetaRow =
    editedLine || gateNotice || leadWaitingNotice ? (
      <div className="-mt-2 mb-4 space-y-2">
        {editedLine ? <p className="text-[12.5px] text-ink-muted">{editedLine}</p> : null}
        {gateNotice ? (
          <p role="status" className="rounded-md border-1.5 border-line bg-surface-sunken px-3 py-2 text-[13.5px] text-ink">
            {gateNotice}
          </p>
        ) : null}
        {leadWaitingNotice ? (
          <p role="status" className="rounded-md border-1.5 border-brand-line bg-brand-soft px-3 py-2 text-[13.5px] text-ink">
            {leadWaitingNotice}
          </p>
        ) : null}
      </div>
    ) : null;

  /* Below lg the head's document pack button stands in for this card, so it shows on lg only. */
  const docPackRailCard = docPackHref ? (
    <DocPackRailCard
      className="mt-3.5 hidden lg:block"
      summary={docPack.data}
      loading={docPack.isPending}
      error={docPack.isError}
      packHref={docPackHref}
    />
  ) : null;

  const stepWindowBar = !isClientRoute ? (
    <StepWindowBar
      className="mb-3.5"
      value={stepWindowValue}
      canEdit={canSetScheduleWindows(user?.role)}
      editSub={`${headCode ? `${headCode} · ` : ''}${eng.companyName}`}
      scopeLabel={stepWindowTarget.kind === 'incorporation' ? 'SPICe+ Part A and Part B' : undefined}
      docPackHref={docPackHref}
      trailing={
        ASSIST_PROFILE_STEP_IDS.has(item.id) ? (
          <CopyForAssist
            engagementId={eng.id}
            className="mb-0 border-0 bg-transparent p-0"
            hrefForMissing={(input) => docPackStepPath(eng, docPackShell, input.stepId, input.tabId)}
          />
        ) : undefined
      }
      onSave={async (window) => {
        await setEngagementWindowInDb(eng.id, stepWindowTarget, window);
        await queryClient.invalidateQueries({ queryKey: ['engagements'] });
      }}
    />
  ) : null;

  const stepFormBody = (
    <>
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
      {/* Lead, manager or admin: open a submitted direct-flow step again. */}
      {!isClientRoute && directFlowComplete ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <ReopenStepButton scopeId={eng.id} itemId={item.id} stepTitle={item.title} />
        </div>
      ) : null}

      {/* Direct flow: the client's only step-level action is asking for a
          change once the step is submitted — it reopens the step. */}
      {isClientRoute && directFlow && directFlowComplete ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <ClientChangeRequestButton
            engagementId={eng.id}
            stepId={item.id}
            stepTitle={item.title}
            onSent={() => void refreshEngagementChecklist(eng.id)}
          />
        </div>
      ) : null}

      {isClientRoute && !directFlow && (approvalLabel || !clientNothingYet) ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          {approvalLabel ? (
            <span className="mr-auto text-[12px] text-ink-muted">{approvalLabel}</span>
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

  /* R-11: Forms and Activity are views of one step, so underline tabs. The client keeps the form alone. */
  const stepForm = isClientRoute ? (
    stepFormBody
  ) : (
    <div className="grid gap-3.5">
      <SpectrumTabs
        variant="underline"
        label="Step views"
        items={[
          { key: 'forms', label: 'Forms' },
          { key: 'activity', label: 'Activity', count: stepActivity.length },
        ]}
        value={stepTab}
        onChange={setStepTab}
      />
      {stepTab === 'forms' ? (
        <div className="min-w-0">{stepFormBody}</div>
      ) : (
        <DashSection title="Activity" meta={String(stepActivity.length)} flush>
          {stepActivity.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No activity yet" />
            </div>
          ) : (
            <ul>
              {stepActivity.map((a) => (
                <li key={a.id} className="flex min-h-row items-center gap-3 border-b border-line-soft px-4 py-2 text-[13.5px] last:border-0 md:px-5">
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {a.actor} {a.verb}
                  </span>
                  <span className="flex-none text-[12.5px] tabular-nums text-ink-muted">{shortDate(a.at.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          )}
        </DashSection>
      )}
    </div>
  );

  /**
   * Every rail row opens, for the lead and for the client alike. Nothing is
   * locked for VIEWING: the sequential gate now governs actions only, and the
   * rail's node icons carry progress (tick done / blue current / dim upcoming).
   */
  const railDone = internPhaseRailItems.filter((row) => row.gate.kind === 'done').length;
  /* S-506, S-512: the phase rail is a section card (icon tile, phase name, "x of y"); below lg it
     stacks under the main card instead of hiding. */
  const internPhaseRail = internWorkspace && internPhase ? (
    <aside className="min-w-0 lg:sticky lg:top-[var(--shell-sticky-top)] lg:self-start">
      <DashSection
        title={isClientRoute ? internPhase.title : PHASE_RAIL[internPhase.id] ?? internPhase.title}
        meta={`${railDone} of ${internPhaseRailItems.length}`}
        bodyClassName={isClientRoute ? 'px-2 py-2' : 'px-4 py-3 md:px-4'}
      >
        {internPhase.id === 'registration-phase-4' ? (
          <div className="space-y-4">
            {internPhaseRailGroups.map((group) => (
              <div key={group.heading}>
                <p className="mb-1.5 px-2 text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">
                  {group.heading}
                </p>
                <ChecklistJourneyRail
                  items={group.items}
                  selectedId={item.id}
                  allowLockedOpen
                  hideStatus
                  showAttachmentMenu={isClientRoute}
                  showStepCode={!isClientRoute}
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
            showAttachmentMenu={isClientRoute}
            showStepCode={!isClientRoute}
            onSelect={openStep}
          />
        )}
      </DashSection>
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
            <div className="mb-3 flex items-center gap-2 text-xs text-ink-muted">
              <HexgridLoader size="sm" />
              Syncing client answers…
            </div>
          )}
          {stepTitleRow}
          {stepMetaRow}
          {stepWindowBar}
          {internPhase ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
              <div className="min-w-0">
                {stepForm}
                {!isClientRoute ? <ClientFileRequestsPanel engagementId={eng.id} item={item} /> : null}
              </div>
              {internPhaseRail}
            </div>
          ) : (
            <>
              {stepForm}
              {!isClientRoute ? <ClientFileRequestsPanel engagementId={eng.id} item={item} /> : null}
            </>
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
              <div className="mb-3 flex items-center gap-2 text-xs text-ink-muted">
                <HexgridLoader size="sm" />
                Syncing client answers…
              </div>
            )}
            {stepTitleRow}
            {stepMetaRow}
            {stepWindowBar}
            {stepForm}
            {!isClientRoute ? <ClientFileRequestsPanel engagementId={eng.id} item={item} /> : null}
          </div>
        </div>
      )}
      {!isClientRoute ? (
        <StepAboutPanel
          stepId={aboutOpen ? item.id : null}
          stepLabel={headCode ?? undefined}
          engagementId={eng.id}
          onClose={() => setAboutOpen(false)}
        />
      ) : null}
    </PageTransition>
  );
}

/** R-48 (S-518): grey shapes for the head, the window bar, the main card and the rail while the engagement loads. */
function StepLoadingShapes() {
  return (
    <div className="min-w-0" aria-busy="true" aria-label="Loading the step">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-[22px] w-[22px] animate-pulse rounded-mark bg-surface-sunken" />
        <span className="h-8 w-[min(420px,70%)] animate-pulse rounded-md bg-surface-sunken" />
      </div>
      <span className="mb-3.5 block h-11 animate-pulse rounded-md bg-surface-sunken" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="surface p-4">
          <SkeletonRows rows={5} />
        </div>
        <div className="surface p-4">
          <SkeletonRows rows={6} className="gap-1.5" />
        </div>
      </div>
    </div>
  );
}
