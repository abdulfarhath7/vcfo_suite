import type { ChecklistItem } from '@/data/checklist';
import { getChecklistStepTimelineLabel, getIncorporationPhases } from '@/data/checklist';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { isDeliveredToClient } from '@/lib/checklist-state-key';
import {
  extractItemResponses,
  formatResponseSummary,
  type ChecklistItemResponses,
} from '@/lib/checklist-responses';
import {
  getReviewStatus,
  isReviewAccepted,
  isReviewRejected,
  isAwaitingReview,
} from '@/lib/checklist-item-review';
import type { BoardResolutionDoc } from '@/lib/board-resolution';

/** Client progress board traffic-light status (maps to green / yellow / red in UI). */
export type ClientProgressTone = 'completed' | 'in-progress' | 'not-started';

export const CLIENT_PROGRESS_TONE_LABEL: Record<ClientProgressTone, string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
  'not-started': 'Not started',
};

export const CLIENT_PROGRESS_PHASE_TITLES: Record<string, string> = {
  'pre-inc-phase-1': 'Phase 1 — Pre-incorporation (Name Application)',
  'pre-inc-phase-2': 'Phase 2 — Pre-incorporation (Incorporation Details)',
  'post-inc-phase-3': 'Phase 3 — Post Incorporation Compliances',
  'registration-phase-4': 'Phase 4 — Registration',
};

export interface BoardResolutionProgressSnapshot {
  status: 'none' | 'draft' | 'finalized' | 'signed';
  hasDraftDoc: boolean;
}

export function boardResolutionProgressFromDoc(
  doc: BoardResolutionDoc | null | undefined,
): BoardResolutionProgressSnapshot {
  if (!doc) return { status: 'none', hasDraftDoc: false };
  if (doc.signedStoragePath?.trim()) {
    return { status: 'signed', hasDraftDoc: true };
  }
  if (doc.status === 'finalized') {
    return { status: 'finalized', hasDraftDoc: Boolean(doc.storagePath?.trim()) };
  }
  const hasDraftDoc = Boolean(doc.storagePath?.trim() || doc.content?.trim());
  return { status: hasDraftDoc ? 'draft' : 'none', hasDraftDoc };
}

function sliceFor(
  checklistState: Record<string, ChecklistItemStateSlice>,
  itemId: string,
): ChecklistItemStateSlice | undefined {
  return checklistState[itemId];
}

function clientFieldProgress(item: ChecklistItem, slice?: ChecklistItemStateSlice) {
  const responses = extractItemResponses(item, slice) as ChecklistItemResponses;
  const summary = formatResponseSummary(item, responses);
  return { responses, summary };
}

function deriveClientOwnedStep(
  item: ChecklistItem,
  slice?: ChecklistItemStateSlice,
): ClientProgressTone {
  if (!slice) {
    const { summary } = clientFieldProgress(item, undefined);
    return summary.hasAny ? 'in-progress' : 'not-started';
  }

  if (isDeliveredToClient(slice) || slice.status === 'completed' || isReviewAccepted(slice)) {
    return 'completed';
  }

  if (isReviewRejected(slice) || (slice.unlockedFields?.length ?? 0) > 0) {
    return 'in-progress';
  }

  if (isAwaitingReview(slice) || slice.clientSubmittedAt?.trim()) {
    return 'in-progress';
  }

  const { summary } = clientFieldProgress(item, slice);
  if (summary.isComplete) return 'in-progress';
  if (summary.hasAny || slice.status === 'in-progress' || slice.status === 'awaiting-client') {
    return 'in-progress';
  }

  return 'not-started';
}

function deriveInternDeliveredStep(
  item: ChecklistItem,
  slice?: ChecklistItemStateSlice,
): ClientProgressTone {
  if (isDeliveredToClient(slice) || slice?.status === 'completed') {
    return 'completed';
  }

  const { summary } = clientFieldProgress(item, slice);
  if (
    summary.hasAny ||
    slice?.status === 'in-progress' ||
    slice?.status === 'awaiting-client' ||
    getReviewStatus(slice) === 'reviewing'
  ) {
    return 'in-progress';
  }

  return 'not-started';
}

function derivePre1(slice?: ChecklistItemStateSlice, item?: ChecklistItem): ClientProgressTone {
  if (!item) return 'not-started';
  if (slice?.status === 'completed' || isReviewAccepted(slice)) return 'completed';
  if (isReviewRejected(slice) || (slice?.unlockedFields?.length ?? 0) > 0) {
    return 'in-progress';
  }
  if (isAwaitingReview(slice) || slice?.clientSubmittedAt?.trim()) return 'in-progress';
  const { summary } = clientFieldProgress(item, slice);
  if (summary.hasAny || slice?.status === 'in-progress') return 'in-progress';
  return 'not-started';
}

function derivePre2(
  item: ChecklistItem,
  slice: ChecklistItemStateSlice | undefined,
  br: BoardResolutionProgressSnapshot,
): ClientProgressTone {
  if (br.status === 'finalized' || br.status === 'signed') return 'completed';
  if (br.status === 'draft' && br.hasDraftDoc) return 'in-progress';

  if (isDeliveredToClient(slice) || slice?.status === 'completed') return 'completed';

  const { summary } = clientFieldProgress(item, slice);
  if (summary.isComplete || summary.hasAny) return 'in-progress';
  if (slice?.status === 'in-progress' || slice?.status === 'awaiting-client') {
    return 'in-progress';
  }

  return 'not-started';
}

function derivePre3(
  item: ChecklistItem,
  slice: ChecklistItemStateSlice | undefined,
  br: BoardResolutionProgressSnapshot,
): ClientProgressTone {
  const { responses } = clientFieldProgress(item, slice);
  if (responses.signedBoardResolutionUrl?.trim() || br.status === 'signed') {
    return 'completed';
  }
  if (slice?.status === 'completed' || isReviewAccepted(slice)) return 'completed';
  if (isAwaitingReview(slice) || slice?.clientSubmittedAt?.trim()) return 'in-progress';
  if (br.status === 'finalized') return 'in-progress';
  if (br.status === 'draft') return 'in-progress';
  return 'not-started';
}

function derivePostRegStepTone(
  item: ChecklistItem,
  checklistState: Record<string, ChecklistItemStateSlice>,
): ClientProgressTone {
  const slice = sliceFor(checklistState, item.id);
  if (slice?.status === 'not-applicable') return 'completed';
  if (item.responsibleRole === 'client') {
    return deriveClientOwnedStep(item, slice);
  }
  return deriveInternDeliveredStep(item, slice);
}

export function derivePreIncStepTone(
  itemId: string,
  item: ChecklistItem,
  checklistState: Record<string, ChecklistItemStateSlice>,
  boardResolution: BoardResolutionProgressSnapshot,
): ClientProgressTone {
  const slice = sliceFor(checklistState, itemId);

  if (itemId.startsWith('post-') || itemId.startsWith('reg-')) {
    return derivePostRegStepTone(item, checklistState);
  }

  switch (itemId) {
    case 'pre-1':
      return derivePre1(slice, item);
    case 'pre-2':
      return derivePre2(item, slice, boardResolution);
    case 'pre-3':
      return derivePre3(item, slice, boardResolution);
    case 'pre-4':
    case 'pre-5':
    case 'pre-7':
    case 'pre-10':
    case 'pre-11':
    case 'pre-12':
      return deriveInternDeliveredStep(item, slice);
    case 'pre-6':
    case 'pre-8':
    case 'pre-9':
      return deriveClientOwnedStep(item, slice);
    default:
      return deriveClientOwnedStep(item, slice);
  }
}

export interface ClientProgressStepView {
  itemId: string;
  stepNumber: number;
  title: string;
  tone: ClientProgressTone;
  timelineLabel: string;
  responsibleRole?: ChecklistItem['responsibleRole'];
}

export interface ClientProgressPhaseView {
  id: string;
  title: string;
  steps: ClientProgressStepView[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
}

export function buildClientProgressPhases(
  checklistState: Record<string, ChecklistItemStateSlice>,
  boardResolution: BoardResolutionProgressSnapshot,
): ClientProgressPhaseView[] {
  return getIncorporationPhases().map((phase) => {
    const steps: ClientProgressStepView[] = phase.items.map((item, index) => ({
      itemId: item.id,
      stepNumber: index + 1,
      title: item.title,
      tone: derivePreIncStepTone(item.id, item, checklistState, boardResolution),
      timelineLabel: getChecklistStepTimelineLabel(item),
      responsibleRole: item.responsibleRole,
    }));
    const completedCount = steps.filter((s) => s.tone === 'completed').length;
    const totalCount = steps.length;
    return {
      id: phase.id,
      title: CLIENT_PROGRESS_PHASE_TITLES[phase.id] ?? phase.title,
      steps,
      completedCount,
      totalCount,
      progressPercent: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
    };
  });
}

export function overallClientProgressPercent(phases: ClientProgressPhaseView[]): number {
  const total = phases.reduce((n, p) => n + p.totalCount, 0);
  const done = phases.reduce((n, p) => n + p.completedCount, 0);
  return total ? Math.round((done / total) * 100) : 0;
}
