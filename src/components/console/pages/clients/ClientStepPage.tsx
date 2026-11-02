'use client';

/**
 * STEP PAGE — /app/manager/projects/[slug]/step/[stepId] (prototype mxStepPage,
 * a59q_mgr_pages.js). The link in every staff email and notification lands
 * here, so the slug / step normalisation of the live page is kept.
 *
 * The prototype's header (code, who holds it, What's this?, window + Edit,
 * Open in document pack) and right rail (the phase's steps, the document pack)
 * around the LIVE step workspace, mounted exactly as the live manager step page
 * mounts it (src/views/engagement/EngagementStepDetail.tsx, staff branch):
 * `StepDetailContent` read-only with the decision pair (Accept / Reject,
 * Approve-and-send / Decline client fill), the lead's filled fields locked,
 * the board resolution on Pre-2, the Assist profile, reopen of a submitted
 * direct-flow step, file requests to the client and the step window.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { checklist, getActiveCatalogItems, type ChecklistItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import { StepDetailContent } from '@/components/admin/StepDetailContent';
import { CopyForAssist } from '@/components/assist-profile/CopyForAssist';
import { useDocPack } from '@/hooks/use-doc-pack';
import { ASSIST_PROFILE_STEP_IDS } from '@/lib/assist-profile/paths';
import { extractItemResponses } from '@/lib/checklist/checklist-responses';
import { hasResponseFormFields } from '@/lib/checklist/checklist-field-access';
import { isStepReleasedToFirm } from '@/lib/checklist/checklist-visibility';
import { getStepAttachmentRequirements } from '@/lib/checklist/checklist-step-attachments';
import { checklistGateViewerFrom, gateActiveCatalog, getStepGate } from '@/lib/checklist/checklist-step-gate';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { docPackPagePath, docPackStepPath } from '@/lib/doc-pack/paths';
import { docsFedByStep } from '@/lib/doc-pack/step-strip';
import { fastestUnblock, missingInputLabel } from '@/lib/doc-pack/unblock';
import { internOverviewPhaseForItem, internRegistrationHeadingGroups } from '@/lib/intern/intern-overview-progress';
import { directFlowRoleLabel, hasClientSubmittedIntake, isClientIntakeStep, isDirectFlowStep, isDirectFlowStepComplete, isWaitingOnLead } from '@/lib/incorporation/pre-inc-direct-flow';
import { canSetScheduleWindows, formatWindow, isIncorporationWindowStep, windowForStep } from '@/lib/projects/schedule-windows';
import { resolveChecklistItemFromStepParam, stepRouteParams } from '@/lib/slug';
import type { ClientFileRequestDto } from '@/lib/client-portal/incorporation-types';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn, Icon, Panel } from '../../ui';
import {
  buildClientView,
  holderOf,
  PHASE_SHORT,
  plural,
  stepCode,
  STEP_STATE_LABEL,
  stepStateOf,
  type ClientView,
  type StepState,
} from './model';
import { dShort, HolderPill, Island, NotFound, stamp, StepWhatDrawer, useFullChecklist, usePeople, useRouteEngagement, useToday, WindowEditor, useClientPaths } from './shared';

/** "Last edited by Kiran Rao (Client) · 12 Oct, 4:05 pm" (live lastEditedLine, console date words). */
function lastEditedLine(slice: ChecklistItemStateSlice | undefined): string | null {
  const at = slice?.lastEditedAt?.trim();
  if (!at || Number.isNaN(new Date(at).getTime())) return null;
  const who = slice?.lastEditedByName?.trim() || 'Someone';
  return `Last edited by ${who} (${directFlowRoleLabel(slice?.lastEditedByRole)}) · ${stamp(at)}`;
}

export function ClientStepPage() {
  const paths = useClientPaths();
  const params = useParams() as Record<string, string | string[] | undefined>;
  const { stepParam } = stepRouteParams(params);
  const { eng, param, settled } = useRouteEngagement();
  const item = useMemo(() => resolveChecklistItemFromStepParam(stepParam), [stepParam]);
  const router = useRouter();
  useCrumbs(['Clients', eng?.companyName ?? '…', item?.title ?? 'Step']);

  // Old links carry an id or another step slug: land on the canonical URL (live behaviour).
  useEffect(() => {
    if (!eng) return;
    if (!item) {
      router.replace(paths.project(eng));
      return;
    }
    if ((eng.slug && param !== eng.slug) || (item.slug && stepParam !== item.slug)) {
      router.replace(paths.step(eng, item) + (typeof window !== 'undefined' ? window.location.search : ''));
    }
  }, [eng, item, param, stepParam, router]);

  if (!eng) return <NotFound settled={settled} />;
  if (!item) return <NotFound settled={false} />;
  return <StepBody key={`${eng.id}:${item.id}`} eng={eng} item={item} />;
}

function StepBody({ eng, item }: { eng: Engagement; item: ChecklistItem }) {
  const paths = useClientPaths();
  const { user, tasks, activity, updateTask, setUnlockedFields, engagementsLoading } = useApp();
  const { go, openDrawer, openPop, toast, seat } = useConsole();
  // Live EngagementStepDetail: the lead (intern) edits the step; manager and admin read it.
  const isLead = seat === 'lead' || user?.role === 'intern';
  const today = useToday();
  const people = usePeople();
  const { state, refreshing } = useFullChecklist(eng);
  const view = useMemo(() => buildClientView(eng, state, people, today, isLead ? 'lead' : 'mgr'), [eng, state, people, today, isLead]);
  const step = view.model.byId[item.id];
  const slice = state[item.id];
  const catalog = useMemo(() => getActiveCatalogItems(), []);

  /* ---------- the live page's derivations (EngagementStepDetail, staff branch) */
  const eTasks = useMemo(() => tasks.filter((t) => t.engagementId === eng.id), [tasks, eng.id]);
  const task = eTasks.find((t) => t.checklistKey === item.id);
  const eActivity = useMemo(() => activity.filter((a) => a.engagementId === eng.id).slice(0, 20), [activity, eng.id]);
  const responses = useMemo(() => extractItemResponses(item, slice), [item, slice]);
  const phase = useMemo(() => internOverviewPhaseForItem(item.id), [item.id]);
  const docPackVisible = phase?.id === 'pre-inc-phase-1' || phase?.id === 'pre-inc-phase-2';
  const docPack = useDocPack(docPackVisible ? eng.id : null);
  const docPackHref = docPackVisible ? paths.docs(eng, phase?.id === 'pre-inc-phase-1' ? 'part-a' : 'part-b') : null;
  const viewer = checklistGateViewerFrom('admin', isLead ? 'intern' : user?.role);
  const stepGate = useMemo(() => getStepGate(gateActiveCatalog(state, viewer), item.id), [state, viewer, item.id]);
  const checklistLoading = engagementsLoading || refreshing;
  const staffAwaitingLead = !isLead && hasResponseFormFields(item, 'admin') && !isStepReleasedToFirm(slice, item.id);
  const nothingYetIntro = staffAwaitingLead
    ? 'Your project lead is still preparing this step. Their answers appear here once they ask for your approval.'
    : undefined;
  const directFlow = isDirectFlowStep(item.id);
  const directFlowComplete = directFlow && isDirectFlowStepComplete(item.id, slice);
  const editedLine = directFlow ? lastEditedLine(slice) : null;
  /** Live leadWaitingNotice (lead only): who the step waits on. */
  const leadWaitingNotice =
    directFlow && isLead && isWaitingOnLead(item.id, slice)
      ? `${slice?.waitingOnLeadByName?.trim() || 'The client'} submitted their part. Fill the NIC codes, then submit to complete this step.`
      : directFlow && isLead && isClientIntakeStep(item.id) && !directFlowComplete && !hasClientSubmittedIntake(item.id, slice)
        ? item.id === 'pre-1'
          ? 'Waiting for the client to fill and submit this step. Their answers appear here once they submit; you can add the NIC codes meanwhile.'
          : 'Waiting for the client to fill and submit this step. Their answers appear here once they submit.'
        : null;
  // The lead notice already says who is being waited on; the live page does not stack the gate line above it.
  const gateNotice =
    !leadWaitingNotice && directFlow && stepGate?.message && (stepGate.kind === 'waiting' || stepGate.kind === 'locked') ? stepGate.message : null;
  const canWindow = !isLead && canSetScheduleWindows(user?.role);
  const ownWindowStep = !isIncorporationWindowStep(item.id);
  const win = windowForStep(eng.schedule, item.id);

  /** Live handleCompleted: completing a task moves the next not-started task to in progress. */
  const handleCompleted = useCallback(
    (completedId: string) => {
      const completed = eTasks.find((t) => t.id === completedId);
      if (!completed) return;
      const idx = catalog.findIndex((c) => c.id === completed.checklistKey);
      if (idx < 0) return;
      const byKey = new Map(eTasks.map((t) => [t.checklistKey, t]));
      for (let i = idx + 1; i < catalog.length; i++) {
        const next = byKey.get(catalog[i]!.id);
        if (next && next.status === 'not-started') {
          updateTask(next.id, { status: 'in-progress' });
          break;
        }
      }
    },
    [eTasks, catalog, updateTask],
  );

  const [reopening, setReopening] = useState(false);
  const reopen = async () => {
    setReopening(true);
    try {
      await setUnlockedFields(eng.id, item.id, []);
      toast(`${item.title} is open for edits again`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not reopen the step');
    } finally {
      setReopening(false);
    }
  };

  /* ---------- header */
  const phaseNo = step?.phaseNo;
  const phaseName = phase?.title ?? (phaseNo ? PHASE_SHORT[phaseNo - 1] : '');
  const holderChip = (() => {
    if (!step) return null;
    if (step.kind === 'done') {
      const na = step.slice?.status === 'not-applicable';
      return (
        <span className={'pill ' + (na ? 'na' : 'done')} title={na ? 'Marked not applicable' : step.doneOn ? `Done on ${dShort(step.doneOn)}` : 'Done'}>
          <Icon name="check" />
          {na ? 'Not needed' : step.doneOn ? `Done · ${dShort(step.doneOn)}` : 'Done'}
        </span>
      );
    }
    if (step.kind === 'up' || step.kind === 'next') {
      return (
        <span className="pill mut" title="Opens once the steps before it are done">
          <Icon name="clock" />
          Not started
        </span>
      );
    }
    const h = holderOf(view.model, step, {
      awaitingYou: view.approvals.some((a) => a.itemId === item.id),
      leadName: view.leads[0]?.name,
      projectStart: eng.createdAt?.slice(0, 10),
      today,
    });
    return <HolderPill h={h} />;
  })();

  return (
    <>
      <section className="glass mx-ch">
        <div className="mx-chl">
          <button type="button" className="ib" aria-label={`Back to ${eng.companyName}`} title={`Back to ${eng.companyName}`} onClick={() => go(paths.project(eng))}>
            <Icon name="back" />
          </button>
          <span className="mx-code big" title={step ? `Step ${step.n} of ${view.model.all.total}` : undefined}>
            {stepCode(item.id)}
          </span>
          <div className="cx-chm">
            <span className="eyebrow cx-ell" title={`${eng.companyName} · ${phaseName}`}>
              {eng.companyName} · {phaseName}
            </span>
            <h2>{item.title}</h2>
            <div className="mx-chips">
              {holderChip}
              {step?.late ? (
                <span className="pill over" title={`Window ended ${dShort(step.due)}`}>
                  <Icon name="alert" />
                  {step.lateDays} day{step.lateDays === 1 ? '' : 's'} late
                </span>
              ) : null}
              <button type="button" className="pill mut cx-pbtn" onClick={() => openDrawer(<StepWhatDrawer item={item} eng={eng} />)}>
                <Icon name="help" />
                What&apos;s this?
              </button>
              <span className="pill mut" title={ownWindowStep ? 'The dates the lead works this step in' : 'One window covers SPICe+ Part A and Part B; set it on the client page'}>
                <Icon name="cal" />
                {win ? `Window ${formatWindow(win)}` : 'No window set'}
                {canWindow ? (
                  ownWindowStep ? (
                    <button
                      type="button"
                      className="link cx-inl"
                      onClick={(e) => openPop(e.currentTarget, <WindowEditor eng={eng} target={{ kind: 'step', itemId: item.id }} label={item.title} value={eng.schedule?.steps?.[item.id]} />)}
                    >
                      {eng.schedule?.steps?.[item.id] ? 'Edit' : 'Set'}
                    </button>
                  ) : (
                    <button type="button" className="link cx-inl" onClick={() => go(paths.project(eng) + '#cx-timeline')}>
                      On the client page
                    </button>
                  )
                ) : null}
              </span>
            </div>
          </div>
        </div>
        <div className="mx-chr">
          {item.id === 'pre-2' || item.id === 'pre-3' ? (
            <Btn cls="sm" ico="doc" onClick={() => go(paths.boardResolution(eng))}>
              Open the board resolution
            </Btn>
          ) : null}
          {docPackHref ? (
            <Btn cls="sm" ico="folder" onClick={() => go(docPackHref)}>
              Open in document pack
            </Btn>
          ) : null}
        </div>
      </section>

      {editedLine || gateNotice || leadWaitingNotice ? (
        <div className="cx-meta">
          {gateNotice ? (
            <div className="banner info" role="status">
              <Icon name="clock" />
              <div>
                <b>{gateNotice}</b>
              </div>
            </div>
          ) : null}
          {leadWaitingNotice ? (
            <div className="banner info" role="status">
              <Icon name="clock" />
              <div>
                <b>{leadWaitingNotice}</b>
              </div>
            </div>
          ) : null}
          {editedLine ? <p className="small">{editedLine}</p> : null}
        </div>
      ) : null}

      <div className="mx-row21">
        <div className="mx-col">
          <section className="glass panel mx-p cx-work">
            <div className="ph">
              <div className="mx-pt">
                <h3>{directFlow ? 'The step' : isLead ? 'Your work' : 'The lead’s work'}</h3>
                <span className="small">
                  {directFlow
                    ? isLead
                      ? 'You and the client fill it; Submit completes it.'
                      : 'The client and the lead fill it; Submit completes it. You read it here.'
                    : isLead
                      ? 'Fill it, then ask your manager to approve it'
                    : 'What the lead filled, read only, with your decision when it waits on you'}
                </span>
              </div>
              <span className="sp" />
              {checklistLoading ? <span className="small cx-sync">Syncing client answers…</span> : null}
            </div>
            {docPackHref && docPack.data ? <DocStrip itemId={item.id} summary={docPack.data} href={docPackHref} /> : null}
            <Island cls="cx-step">
              {ASSIST_PROFILE_STEP_IDS.has(item.id) ? (
                <CopyForAssist engagementId={eng.id} hrefForMissing={(input) => paths.step(eng, input.stepId, input.tabId)} />
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
                hideDocumentsTab
                hideStatus
                hideWorkspaceRail
                viewer="staff"
                readOnly={!isLead}
                clientNothingYet={staffAwaitingLead}
                nothingYetIntro={nothingYetIntro}
              />
            </Island>
            {directFlowComplete ? (
              <div className="mx-sfoot">
                <span className="small">Submitted. Reopening opens every field again for the client and the lead, and locks the steps after it.</span>
                <span className="sp" />
                <Btn cls="sm" ico="back" disabled={reopening} onClick={() => void reopen()}>
                  {reopening ? 'Reopening…' : 'Reopen step'}
                </Btn>
              </div>
            ) : null}
          </section>
          <FileRequests eng={eng} item={item} />
        </div>

        <div className="mx-col">
          <PhaseRail view={view} item={item} eng={eng} />
          <StepFiles item={item} responses={responses} eng={eng} />
          {docPackHref ? <DocPackCard eng={eng} itemId={item.id} href={docPackHref} /> : null}
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- right rail: the phase's steps */

function railState(view: ClientView, id: string, state: Record<string, ChecklistItemStateSlice | undefined>): StepState {
  const s = view.model.byId[id];
  if (s) return stepStateOf(s);
  const st = state[id]?.status;
  return st === 'completed' ? 'done' : st === 'not-applicable' ? 'na' : 'up';
}

function PhaseRail({ view, item, eng }: { view: ClientView; item: ChecklistItem; eng: Engagement }) {
  const paths = useClientPaths();
  const { go } = useConsole();
  const { getStateForEngagement } = useApp();
  const phase = internOverviewPhaseForItem(item.id);
  const state = getStateForEngagement(eng);
  if (!phase) return null;
  const groups = phase.id === 'registration-phase-4' ? internRegistrationHeadingGroups(phase.items) : [{ heading: '', items: phase.items }];
  const done = phase.items.filter((i) => railState(view, i.id, state) === 'done' || railState(view, i.id, state) === 'na').length;
  const row = (it: ChecklistItem) => {
    const s = railState(view, it.id, state);
    const w = windowForStep(eng.schedule, it.id);
    const owner = it.id === 'pre-11' || it.id === 'pre-12' ? 'MCA' : it.responsibleRole === 'client' ? 'client' : 'lead';
    return (
      <button
        key={it.id}
        type="button"
        className={'mx-rs ' + s + (it.id === item.id ? ' here' : '')}
        aria-current={it.id === item.id ? 'step' : undefined}
        title={`${stepCode(it.id)} ${it.title} · ${STEP_STATE_LABEL[s]}${w ? ` · window ${formatWindow(w)}` : ''}`}
        onClick={() => go(paths.step(eng, it))}
      >
        <i className={'mx-si2 ' + (s === 'na' ? 'done' : s)}>{s === 'done' || s === 'na' ? <Icon name="check" size={11} /> : s === 'stuck' ? <Icon name="alert" size={11} /> : null}</i>
        <span className="cx-ell">{it.title}</span>
        <em title={owner === 'client' ? 'The client fills it' : owner === 'MCA' ? 'The Ministry of Corporate Affairs acts on it' : 'The project lead runs it'}>{owner}</em>
      </button>
    );
  };
  return (
    <Panel title={phase.title} sub={`${done} of ${phase.items.length} done · client and lead steps`}>
      <div className="mx-rail">
        {groups.map((g) => (
          <div key={g.heading || 'all'} className="cx-railg">
            {g.heading ? <span className="eyebrow cx-railh">{g.heading}</span> : null}
            {g.items.map(row)}
          </div>
        ))}
      </div>
      <div className="mx-leg cx-leg" aria-label="What the marks mean">
        {(['done', 'cur', 'stuck', 'up'] as const).map((k) => (
          <span key={k} className="cx-lk">
            <i className={'mx-si2 ' + k} />
            {STEP_STATE_LABEL[k]}
          </span>
        ))}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- files the step needs (live rail "Attachments required") */

function StepFiles({ item, responses, eng }: { item: ChecklistItem; responses: Record<string, string>; eng: Engagement }) {
  const files = getStepAttachmentRequirements(item, responses, eng.ownershipType);
  if (!files.length) return null;
  const up = files.filter((f) => f.uploaded).length;
  return (
    <Panel title="Files on this step" sub={`${up} of ${plural(files.length, 'file')} in`}>
      <div className="cx-files">
        {files.map((f) => (
          <div key={f.fieldId} className="cx-file" title={f.uploaded ? `${f.label} · ${f.fileName ?? 'uploaded'}` : `${f.label} · not uploaded yet`}>
            <i className={'mx-si2 ' + (f.uploaded ? 'done' : 'up')}>{f.uploaded ? <Icon name="check" size={11} /> : null}</i>
            <span className="mx-dt">
              <b className="cx-ell">{f.label}</b>
              <span className="cx-ell">{f.uploaded ? f.fileName ?? 'Uploaded' : 'Not uploaded yet'}</span>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- document pack */

function DocStrip({ itemId, summary, href }: { itemId: string; summary: NonNullable<ReturnType<typeof useDocPack>['data']>; href: string }) {
  const { go } = useConsole();
  const fed = docsFedByStep(summary, itemId);
  if (fed.total === 0) return null;
  const parts = [`${fed.counts.ready} ready`];
  if (fed.counts['needs-inputs'] > 0) parts.push(`${fed.counts['needs-inputs']} need inputs`);
  if (fed.counts['waiting-release'] > 0) parts.push(`${fed.counts['waiting-release']} waiting for release`);
  return (
    <div className="cx-strip">
      <Icon name="doc" />
      <span>
        <b>{fed.total}</b> {fed.total === 1 ? 'document uses' : 'documents use'} this step&apos;s data · {parts.join(', ')}
      </span>
      <span className="sp" />
      <button type="button" className="link" onClick={() => go(href)}>
        Open in document pack
      </button>
    </div>
  );
}

function DocPackCard({ eng, itemId, href }: { eng: Engagement; itemId: string; href: string }) {
  const paths = useClientPaths();
  const { go } = useConsole();
  const pack = useDocPack(eng.id);
  const s = pack.data;
  const hint = s ? fastestUnblock(s, itemId) : null;
  return (
    <Panel
      title="Document pack"
      sub={s ? `Pre-incorporation · ${s.counts.ready} of ${s.total} ready` : 'Pre-incorporation'}
      act={
        <button type="button" className="link" onClick={() => go(href)}>
          Open
          <Icon name="chev" size={14} />
        </button>
      }
    >
      {pack.isError ? (
        <div className="sec-err">
          <Icon name="alert" />
          <span>Readiness could not be loaded.</span>
          <span className="sp" />
          <button type="button" className="btn sm" onClick={() => void pack.refetch()}>
            Try again
          </button>
        </div>
      ) : !s ? (
        <p className="small">Checking readiness…</p>
      ) : (
        <>
          <div className="mx-dsum">
            <button type="button" className="pill ok cx-pbtn" title="Ready to download" onClick={() => go(href)}>
              <b>{s.counts.ready}</b> ready
            </button>
            <button type="button" className="pill due cx-pbtn" title="A field the document needs is still empty" onClick={() => go(href)}>
              <b>{s.counts['needs-inputs']}</b> need inputs
            </button>
            <button type="button" className="pill mut cx-pbtn" title="Waits for a release (the board resolution finalised, the directors accepted)" onClick={() => go(href)}>
              <b>{s.counts['waiting-release']}</b> waiting
            </button>
          </div>
          {hint ? (
            <p className="small cx-hint">
              Fastest unblock:{' '}
              <button type="button" className="link cx-inl" onClick={() => go(paths.step(eng, hint.input.stepId, hint.input.tabId))}>
                {missingInputLabel(hint.input)}
              </button>{' '}
              {hint.input.stepId === itemId ? 'in this step' : `in ${checklist.find((c) => c.id === hint.input.stepId)?.title ?? hint.input.stepId}`}
              {hint.releases > 0 ? ` releases ${plural(hint.releases, 'document')}.` : ` is needed by ${plural(hint.appearsIn, 'document')}.`}
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- file requests to the client (live ClientFileRequestsPanel) */

function FileRequests({ eng, item }: { eng: Engagement; item: ChecklistItem }) {
  const { toast } = useConsole();
  const qc = useQueryClient();
  const key = ['file-requests', eng.id];
  const fileFields = useMemo(() => (item.fields ?? []).filter((f) => f.type === 'file'), [item]);
  const [fieldId, setFieldId] = useState(fileFields[0]?.id ?? '');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${encodeURIComponent(eng.id)}/file-requests`);
      if (!res.ok) throw new Error('Could not load file requests');
      return ((await res.json()) as { requests: ClientFileRequestDto[] }).requests;
    },
    enabled: fileFields.length > 0,
  });
  const create = useMutation({
    mutationFn: async () => {
      const field = fileFields.find((f) => f.id === fieldId);
      const res = await fetch(`/api/engagements/${encodeURIComponent(eng.id)}/file-requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stepId: item.id, fieldId, label: label.trim() || field?.label || 'File', note: note.trim() || undefined, dueDate: dueDate || undefined }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not send the request');
    },
    onSuccess: () => {
      toast('Request sent to the client');
      setLabel('');
      setNote('');
      setDueDate('');
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast(e.message),
  });
  const cancel = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/engagements/${encodeURIComponent(eng.id)}/file-requests/${encodeURIComponent(requestId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not cancel the request');
    },
    onSuccess: () => {
      toast('Request cancelled');
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast(e.message),
  });

  if (fileFields.length === 0) return null;
  const mine = (list.data ?? []).filter((r) => r.stepId === item.id);
  const field = fileFields.find((f) => f.id === fieldId);
  return (
    <Panel title="Request files from the client" sub="Shown on the client's step page; their approval waits for the file">
      {list.isPending ? (
        <p className="small">Loading the requests…</p>
      ) : list.isError ? (
        <div className="sec-err">
          <Icon name="alert" />
          <span>The requests could not load.</span>
          <span className="sp" />
          <button type="button" className="btn sm" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      ) : mine.length ? (
        <div className="cx-reqs">
          {mine.map((r) => (
            <div key={r.id} className="mx-qi">
              <span className="mx-ni">
                <Icon name="up" />
              </span>
              <span className="mx-dt">
                <b className="cx-ell">{r.label}</b>
                <span>{[r.dueDate ? `due ${dShort(r.dueDate)}` : '', r.note ?? ''].filter(Boolean).join(' · ') || 'No due date'}</span>
              </span>
              {r.fulfilledAt ? (
                <span className="pill done" title={r.fileName ?? undefined}>
                  <Icon name="check" />
                  Uploaded{r.fileName ? ` · ${r.fileName}` : ''}
                </span>
              ) : (
                <>
                  <span className="pill due">Waiting on the client</span>
                  <Btn cls="sm" ico="x" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>
                    Cancel
                  </Btn>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="small">No file asked for on this step yet. A request shows on the client&apos;s step page and in their week.</p>
      )}
      <form
        className="cx-reqf"
        onSubmit={(e) => {
          e.preventDefault();
          if (fieldId) create.mutate();
        }}
      >
        <label className="mx-f">
          <span className="mx-fl">File</span>
          <select className="lsel cx-sel" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
            {fileFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mx-f">
          <span className="mx-fl">Name the client sees</span>
          <input className="mx-in" value={label} placeholder={field?.label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">Due</span>
          <input className="mx-in" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="mx-f cx-wide">
          <span className="mx-fl">Note (optional)</span>
          <input className="mx-in" value={note} placeholder="For example: not older than two months" onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="cx-reqgo">
          <Btn type="submit" cls="sm pri" ico="send" disabled={create.isPending || !fieldId}>
            {create.isPending ? 'Sending…' : 'Request'}
          </Btn>
        </div>
      </form>
    </Panel>
  );
}

