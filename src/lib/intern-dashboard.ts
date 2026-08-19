import { checklist, getActiveCatalogItems, type StatusCode } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import {
  buildClientProgressPhases,
  overallClientProgressPercent,
  type BoardResolutionProgressSnapshot,
} from '@/lib/client-progress-board';
import { isAwaitingReview } from '@/lib/checklist-item-review';
import { gateActiveCatalog, getStepGate } from '@/lib/checklist-step-gate';

const NONE_BR: BoardResolutionProgressSnapshot = { status: 'none', hasDraftDoc: false };

/** Setup progress % from DB checklist state (pre-inc phases; BR optional). */
export function engagementSetupProgressPercent(
  checklistState: Record<string, ChecklistItemStateSlice>,
  boardResolution: BoardResolutionProgressSnapshot = NONE_BR,
): number {
  const phases = buildClientProgressPhases(checklistState, boardResolution);
  return overallClientProgressPercent(phases);
}

export interface InternQueueItem {
  engagementId: string;
  checklistKey: string;
  status: StatusCode;
  awaitsReview: boolean;
  isOverdue: boolean;
  isLocked: boolean;
}

function buildInternQueueForEngagement(
  engagement: Engagement,
  checklistState: Record<string, ChecklistItemStateSlice>,
  boardResolution?: BoardResolutionProgressSnapshot,
): InternQueueItem[] {
  const br = boardResolution ?? NONE_BR;
  const gates = gateActiveCatalog(checklistState, 'staff');
  return checklist.map((item) => {
    const slice = checklistState[item.id];
    const status = deriveChecklistDisplayStatus(item.id, item, slice, br);
    const gate = getStepGate(gates, item.id);
    const isLocked = gate.kind === 'locked';
    const current = gate.kind === 'active' || gate.kind === 'waiting';
    return {
      engagementId: engagement.id,
      checklistKey: item.id,
      status,
      awaitsReview: isAwaitingReview(slice) && !isLocked,
      isOverdue: status === 'overdue' && current,
      isLocked,
    };
  });
}

export function buildInternPortfolioQueue(
  engagements: Engagement[],
  getChecklistState: (engagement: Engagement) => Record<string, ChecklistItemStateSlice>,
  internId: string,
  boardResolutionByEngagement: Record<string, BoardResolutionProgressSnapshot> = {},
): InternQueueItem[] {
  const items: InternQueueItem[] = [];
  for (const e of engagements) {
    if (e.internId !== internId) continue;
    items.push(
      ...buildInternQueueForEngagement(
        e,
        getChecklistState(e),
        boardResolutionByEngagement[e.id],
      ),
    );
  }
  return items;
}

export interface InternQueueStats {
  open: InternQueueItem[];
  overdue: InternQueueItem[];
  inProgress: InternQueueItem[];
  awaitingClient: InternQueueItem[];
  awaitsReview: number;
  pendingRequests: number;
  requestsToReview: number;
  queuePct: number;
  total: number;
}

export function internQueueStats(
  items: InternQueueItem[],
  pendingRequests: number,
): InternQueueStats {
  const open = items.filter((i) => i.status !== 'completed');
  const overdue = open.filter((i) => i.isOverdue);
  const inProgress = open.filter((i) => i.status === 'in-progress');
  const awaitingClient = open.filter((i) => i.status === 'awaiting-client');
  const awaitsReview = items.filter((i) => i.awaitsReview).length;

  return {
    open,
    overdue,
    inProgress,
    awaitingClient,
    awaitsReview,
    pendingRequests,
    requestsToReview: awaitsReview + pendingRequests,
    queuePct: items.length ? Math.round(((items.length - open.length) / items.length) * 100) : 0,
    total: items.length,
  };
}

/** Overdue → awaiting review → in progress → everything else still open. */
export function prioritizeInternActions(items: InternQueueItem[], limit = 6): InternQueueItem[] {
  const open = items.filter((i) => i.status !== 'completed' && !i.isLocked);
  const overdue = open.filter((i) => i.isOverdue);
  const awaitingReview = open.filter((i) => i.awaitsReview && !overdue.includes(i));
  const inProgress = open.filter(
    (i) => i.status === 'in-progress' && !overdue.includes(i) && !awaitingReview.includes(i),
  );
  const rest = open.filter(
    (i) => !overdue.includes(i) && !awaitingReview.includes(i) && !inProgress.includes(i),
  );
  return [...overdue, ...awaitingReview, ...inProgress, ...rest].slice(0, limit);
}

export interface InternWeekQueueCompanyGroup {
  engagementId: string;
  companyName: string;
  stage?: string;
  items: InternQueueItem[];
}

const ACTIVE_CATALOG_IDS = new Set(getActiveCatalogItems().map((item) => item.id));

/** Unlocked catalog work for Today — completed, in-progress, and awaiting-client stay visible. */
export function internWeekQueueItems(items: InternQueueItem[]): InternQueueItem[] {
  return items.filter((i) => !i.isLocked && ACTIVE_CATALOG_IDS.has(i.checklistKey));
}

/** One card per company, A–Z by name; rows stay in catalog order. */
export function groupInternWeekQueueByCompany(
  items: InternQueueItem[],
  engagements: Pick<Engagement, 'id' | 'companyName' | 'stage'>[],
): InternWeekQueueCompanyGroup[] {
  const byId = new Map(engagements.map((e) => [e.id, e]));
  const groups = new Map<string, InternWeekQueueCompanyGroup>();

  for (const item of internWeekQueueItems(items)) {
    const eng = byId.get(item.engagementId);
    if (!eng) continue;
    let group = groups.get(item.engagementId);
    if (!group) {
      group = {
        engagementId: item.engagementId,
        companyName: eng.companyName,
        stage: eng.stage,
        items: [],
      };
      groups.set(item.engagementId, group);
    }
    group.items.push(item);
  }

  return [...groups.values()].sort(
    (a, b) =>
      a.companyName.localeCompare(b.companyName, undefined, { sensitivity: 'base' }) ||
      a.engagementId.localeCompare(b.engagementId),
  );
}
