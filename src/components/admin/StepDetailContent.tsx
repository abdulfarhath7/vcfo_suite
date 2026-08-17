'use client';

import { useMemo, useReducer, useRef } from 'react';
import { ChecklistItem, getPreIncPhaseStep, StatusCode } from '@/data/checklist';
import { TaskInstance, ActivityEvent } from '@/data/engagements';
import { useApp } from '@/context/AppContext';
import { type ChecklistItemResponses } from '@/lib/checklist-responses';
import { hasResponseFormFields } from '@/lib/checklist-field-access';
import { cn } from '@/lib/utils';
import { toastSuccess } from '@/lib/toast-errors';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import { useBoardResolutionProgress } from '@/lib/use-board-resolution-progress';
import {
  checklistGateViewerFrom,
  gateActiveCatalog,
  gateDisplayStatus,
  getStepGate,
} from '@/lib/checklist-step-gate';
import { StepDetailContentView } from '@/components/admin/StepDetailContentSections';
import {
  EMPTY_STEP_ACTIVITY,
  computeLegacyStepTotals,
  saveStepProgress,
  stepDetailUiReducer,
  type StepProgress,
} from '@/components/admin/step-detail-progress';

export interface StepDetailContentProps {
  item: ChecklistItem;
  task?: TaskInstance;
  engagementId: string;
  clientId?: string;
  responses?: ChecklistItemResponses;
  activity?: ActivityEvent[];
  onCompleted?: (taskId: string) => void;
  /** Sheet drawer vs full page */
  theme?: 'light' | 'dark';
  /** Called when user finishes (page: back; drawer: close) */
  onDone?: () => void;
  /** Defer milestone form until host is ready (drawer open) */
  contentReady?: boolean;
  /** Hide legacy Forms/Documents tabs (project-lead delivery steps use MilestoneResponseForm). */
  hideLegacyChecklist?: boolean;
  /** Hide read-only Documents checklist tab (intern portal — uploads live in MilestoneResponseForm). */
  hideDocumentsTab?: boolean;
  /** Hide expected-timeline / working-days SLA copy (intern portal). */
  hideTimeline?: boolean;
}

const STATUS_TONE: Record<
  StatusCode,
  { dot: 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'muted'; cls: string; clsLight: string }
> = {
  'not-started': {
    dot: 'muted',
    cls: 'text-paper-subtle',
    clsLight: 'text-text-tertiary',
  },
  'in-progress': {
    dot: 'info',
    cls: 'text-info',
    clsLight: 'text-info-text',
  },
  'awaiting-client': {
    dot: 'warning',
    cls: 'text-warning',
    clsLight: 'text-warning-text',
  },
  completed: {
    dot: 'success',
    cls: 'text-success',
    clsLight: 'text-success-text',
  },
  overdue: {
    dot: 'danger',
    cls: 'text-danger',
    clsLight: 'text-danger-text',
  },
  'not-applicable': {
    dot: 'muted',
    cls: 'text-paper-subtle',
    clsLight: 'text-text-tertiary',
  },
};

export function StepDetailContent(props: StepDetailContentProps) {
  const taskKey = props.task
    ? `${props.task.id}:${props.task.status}:${props.item.id}:${props.hideDocumentsTab}`
    : `no-task:${props.item.id}:${props.hideDocumentsTab}`;
  return <StepDetailContentInner key={taskKey} {...props} />;
}

function StepDetailContentInner({
  item,
  task,
  engagementId,
  clientId,
  responses,
  activity = EMPTY_STEP_ACTIVITY,
  onCompleted,
  theme = 'light',
  onDone,
  contentReady = true,
  hideLegacyChecklist = false,
  hideDocumentsTab = false,
  hideTimeline = false,
}: StepDetailContentProps) {
  const { updateTask, getStateForEngagement, engagements, user } = useApp();
  const [ui, dispatchUi] = useReducer(
    stepDetailUiReducer,
    { progress: { forms: [], docs: [] }, tab: 'docs' as const, justCompleted: false },
    (initial) =>
      task
        ? stepDetailUiReducer(initial, { type: 'sync_task', task, item, hideDocumentsTab })
        : initial,
  );
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const isLight = theme === 'light';
  const scopeId = engagementId ?? clientId;
  const hasClientFields = Boolean(scopeId && hasResponseFormFields(item, 'admin'));
  const showLegacyChecklist = !hideLegacyChecklist && !hasClientFields;

  const { progress, tab, justCompleted } = ui;
  const setProgress = (next: StepProgress | ((prev: StepProgress) => StepProgress)) => {
    dispatchUi({
      type: 'set_progress',
      progress: typeof next === 'function' ? next(ui.progress) : next,
    });
  };
  const setTab = (next: typeof tab) => dispatchUi({ type: 'set_tab', tab: next });

  const stepActivity = useMemo(() => {
    const needle = item.title.toLowerCase().split(' ').slice(0, 2).join(' ');
    return activity.filter(
      (a) =>
        a.target?.toLowerCase().includes(needle) ||
        item.forms.some((f) => a.target?.toLowerCase().includes(f.toLowerCase())),
    );
  }, [activity, item]);

  const totals = useMemo(() => {
    if (!showLegacyChecklist) return { done: 0, total: 0, pct: 0 };
    return computeLegacyStepTotals(item, progress, hideDocumentsTab);
  }, [item, progress, showLegacyChecklist, hideDocumentsTab]);

  const applyProgressUpdate = (nextProgress: StepProgress) => {
    dispatchUi({ type: 'set_progress', progress: nextProgress });
    if (!task || !showLegacyChecklist) return;

    saveStepProgress(task.id, nextProgress);

    const { done, total } = computeLegacyStepTotals(item, nextProgress, hideDocumentsTab);
    if (total > 0 && done === total && task.status !== 'completed') {
      updateTask(task.id, { status: 'completed' });
      dispatchUi({ type: 'set_just_completed', value: true });
      onCompletedRef.current?.(task.id);
      toastSuccess('Step marked complete', `${item.title} — workspace updated.`);
    } else if (done > 0 && done < total && task.status === 'not-started') {
      updateTask(task.id, { status: 'in-progress' });
    }
  };

  const toggleForm = (f: string) =>
    applyProgressUpdate({
      ...progress,
      forms: progress.forms.includes(f)
        ? progress.forms.filter((x) => x !== f)
        : [...progress.forms, f],
    });

  const toggleDoc = (d: string) =>
    applyProgressUpdate({
      ...progress,
      docs: progress.docs.includes(d)
        ? progress.docs.filter((x) => x !== d)
        : [...progress.docs, d],
    });

  const markAll = () =>
    applyProgressUpdate({
      forms: [...item.forms],
      docs: hideDocumentsTab ? progress.docs : [...item.infoRequired],
    });

  const engagement = engagements.find((e) => e.id === engagementId);
  const checklistState = engagement ? getStateForEngagement(engagement) : {};
  const itemState = checklistState[item.id];
  const { snapshot: brSnapshot } = useBoardResolutionProgress(engagementId);
  const stepGate = getStepGate(
    gateActiveCatalog(checklistState, checklistGateViewerFrom('admin', user?.role)),
    item.id,
  );
  const status = gateDisplayStatus(
    deriveChecklistDisplayStatus(item.id, item, itemState, brSnapshot),
    stepGate,
  );
  const tone = STATUS_TONE[status];
  const statusCls = isLight ? tone.clsLight : tone.cls;
  const preIncPhaseStep = item.bucket === 'pre-inc' ? getPreIncPhaseStep(item.id) : null;

  const rowBtn = (done: boolean) =>
    cn(
      'w-full flex items-center gap-3 px-3 py-2.5 border rounded-sm text-left transition-all',
      done
        ? isLight
          ? 'border-brand/30 bg-primary-light/50'
          : 'border-primary/40 bg-primary/5'
        : isLight
          ? 'border-border hover:border-border/80 hover:bg-muted/40'
          : 'border-hairline hover:border-hairline-strong',
    );

  const tabTrigger = cn(
    'relative rounded-none bg-transparent px-3 py-2.5 text-[11px] mono uppercase tracking-[0.16em]',
    'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
    'transition-colors',
    isLight
      ? 'text-text-tertiary data-[state=active]:text-brand hover:text-ink'
      : 'text-paper-muted data-[state=active]:text-blue-600 hover:text-paper',
  );

  const emptyCopy = isLight ? 'text-text-tertiary' : 'text-paper-muted';
  const bodyText = (done: boolean) =>
    isLight
      ? done
        ? 'text-ink'
        : 'text-text-secondary'
      : done
        ? 'text-paper'
        : 'text-paper-muted';

  const viewProps = {
    item,
    task,
    engagementId,
    clientId,
    responses,
    activity,
    onCompleted,
    theme,
    onDone,
    contentReady,
    hideLegacyChecklist,
    hideDocumentsTab,
    hideTimeline,
    progress,
    setProgress,
    tab,
    setTab,
    justCompleted,
    isLight,
    scopeId,
    hasClientFields,
    showLegacyChecklist,
    stepActivity,
    totals,
    engagement,
    itemState,
    status,
    tone,
    statusCls,
    preIncPhaseStep,
    toggleForm,
    toggleDoc,
    markAll,
    rowBtn,
    tabTrigger,
    emptyCopy,
    bodyText,
    brSnapshot,
    stepGate,
  };
  return <StepDetailContentView {...viewProps} />;
}
