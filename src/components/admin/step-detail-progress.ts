import type { ActivityEvent } from '@/data/engagements';
import type { ChecklistItem } from '@/data/checklist';
import type { TaskInstance } from '@/data/engagements';
import { persist, read } from '@/lib/storage';

export const EMPTY_STEP_ACTIVITY: ActivityEvent[] = [];

export interface StepProgress {
  forms: string[];
  docs: string[];
}

export type StepDetailTab = 'forms' | 'docs' | 'activity';

export type StepDetailUiState = {
  progress: StepProgress;
  tab: StepDetailTab;
  justCompleted: boolean;
};

export type StepDetailUiAction =
  | { type: 'sync_task'; task: TaskInstance; item: ChecklistItem; hideDocumentsTab: boolean }
  | { type: 'set_progress'; progress: StepProgress }
  | { type: 'toggle_form'; formId: string }
  | { type: 'toggle_doc'; docId: string }
  | { type: 'mark_all'; forms: string[]; docs: string[] }
  | { type: 'set_tab'; tab: StepDetailTab }
  | { type: 'set_just_completed'; value: boolean };

function progressKey(taskId: string) {
  return `vcfo.stepProgress:${taskId}`;
}

export function loadStepProgress(taskId: string): StepProgress {
  return read(progressKey(taskId), { forms: [], docs: [] });
}

export function saveStepProgress(taskId: string, progress: StepProgress) {
  persist(progressKey(taskId), progress);
}

export function clearAllStepProgress(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('vcfo.stepProgress:')) keysToRemove.push(k);
    }
    for (const k of keysToRemove) localStorage.removeItem(k);
  } catch {
    // localStorage may be unavailable in SSR — safe to swallow
  }
}

function defaultTab(item: ChecklistItem, hideDocumentsTab: boolean): StepDetailTab {
  if (item.forms.length) return 'forms';
  return hideDocumentsTab ? 'activity' : 'docs';
}

export function stepDetailUiReducer(
  state: StepDetailUiState,
  action: StepDetailUiAction,
): StepDetailUiState {
  switch (action.type) {
    case 'sync_task': {
      const { task, item, hideDocumentsTab } = action;
      const loaded = loadStepProgress(task.id);
      const progress =
        task.status === 'completed'
          ? {
              forms: [...item.forms],
              docs: hideDocumentsTab ? [] : [...item.infoRequired],
            }
          : loaded;
      return {
        progress,
        tab: defaultTab(item, hideDocumentsTab),
        justCompleted: false,
      };
    }
    case 'set_progress':
      return { ...state, progress: action.progress };
    case 'toggle_form': {
      const forms = state.progress.forms.includes(action.formId)
        ? state.progress.forms.filter((x) => x !== action.formId)
        : [...state.progress.forms, action.formId];
      return { ...state, progress: { ...state.progress, forms } };
    }
    case 'toggle_doc': {
      const docs = state.progress.docs.includes(action.docId)
        ? state.progress.docs.filter((x) => x !== action.docId)
        : [...state.progress.docs, action.docId];
      return { ...state, progress: { ...state.progress, docs } };
    }
    case 'mark_all':
      return { ...state, progress: { forms: action.forms, docs: action.docs } };
    case 'set_tab':
      return { ...state, tab: action.tab };
    case 'set_just_completed':
      return { ...state, justCompleted: action.value };
    default:
      return state;
  }
}

export function computeLegacyStepTotals(
  item: ChecklistItem,
  progress: StepProgress,
  hideDocumentsTab: boolean,
) {
  const docTotal = hideDocumentsTab ? 0 : item.infoRequired.length;
  const docDone = hideDocumentsTab ? 0 : progress.docs.length;
  const total = item.forms.length + docTotal;
  const done = progress.forms.length + docDone;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
