import type { AuthUser } from '@/lib/auth';
import type { Engagement } from '@/data/engagements';
import {
  type ChecklistItemResponses,
  responseFieldIdsForItem,
} from '@/lib/checklist-responses';
import { coerceStatusCode, type StatusCode } from '@/data/checklist';
import {
  coerceRegistrationWorkflowStage,
  type RegistrationWorkflowStage,
} from '@/lib/registration-workflow';

export type ChecklistReviewStatus = 'reviewing' | 'accepted' | 'rejected';

/** Lead asks the client to fill a step; a manager has to approve before the client hears about it. */
export type ClientFillRequestStatus = 'pending_manager' | 'approved' | 'declined';

export interface ClientFillRequest {
  status: ClientFillRequestStatus;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: string;
  /** Lead's note to the manager, carried into the client email. */
  note?: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionNote?: string;
  /** ISO time the approved request actually reached the client. */
  sentToClientAt?: string;
  /** ISO time the client submitted the step after being asked. */
  fulfilledAt?: string;
}
/** Who put the item into reviewing — client KYC vs lead→manager request. */
export type ChecklistReviewSource = 'client_submission' | 'lead_manager_request';

const ITEM_META_KEYS = new Set([
  'status',
  'assigneeId',
  'notes',
  'completedOn',
  'responses',
  'clientSubmittedAt',
  'locked',
  'unlockedFields',
  'reviewStatus',
  'reviewSource',
  'reviewedAt',
  'reviewedBy',
  'rejectionNote',
  'deliveredToClientAt',
  'sharedIncorpDraftDocs',
  'incorpDraftsSharedAt',
  'workflowStage',
  'clientFillRequest',
]);

export interface ChecklistItemStateSlice {
  status: StatusCode;
  assigneeId?: string;
  notes?: string;
  completedOn?: string;
  responses?: ChecklistItemResponses;
  /** ISO timestamp when the client submitted this milestone for review */
  clientSubmittedAt?: string;
  /** When true, client fields are read-only except those in unlockedFields */
  locked?: boolean;
  /** Field ids the intern/manager has reopened for client editing */
  unlockedFields?: string[];
  /** Client submit → intern review lifecycle */
  reviewStatus?: ChecklistReviewStatus;
  /** Distinguishes client KYC submit vs lead requesting manager approval */
  reviewSource?: ChecklistReviewSource;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionNote?: string;
  /** ISO timestamp when project lead delivered intern-filled milestone to client */
  deliveredToClientAt?: string;
  /** Incorporation draft row keys (`doc:director`) shared with the client portal (Pre-8 downloads) */
  sharedIncorpDraftDocs?: string[];
  /** ISO timestamp when all incorporation drafts were bulk-shared with the client */
  incorpDraftsSharedAt?: string;
  /** Statutory registration 3-step workflow (Client → VCFO → Department) */
  workflowStage?: RegistrationWorkflowStage;
  /** Lead → manager → client "please fill this step" request. */
  clientFillRequest?: ClientFillRequest;
}

/** Narrow one jsonb blob to a ClientFillRequest, or undefined when it is not one. */
export function normalizeClientFillRequest(raw: unknown): ClientFillRequest | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const status = obj.status;
  if (status !== 'pending_manager' && status !== 'approved' && status !== 'declined') {
    return undefined;
  }
  const str = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value : undefined;
  const requestedBy = str(obj.requestedBy);
  const requestedAt = str(obj.requestedAt);
  if (!requestedBy || !requestedAt) return undefined;
  return {
    status,
    requestedBy,
    requestedAt,
    requestedByName: str(obj.requestedByName),
    note: str(obj.note),
    decidedBy: str(obj.decidedBy),
    decidedByName: str(obj.decidedByName),
    decidedAt: str(obj.decidedAt),
    decisionNote: str(obj.decisionNote),
    sentToClientAt: str(obj.sentToClientAt),
    fulfilledAt: str(obj.fulfilledAt),
  };
}

/** True when project lead has formally delivered this step to the client portal. */
export function isDeliveredToClient(slice?: Pick<ChecklistItemStateSlice, 'deliveredToClientAt' | 'status'>): boolean {
  if (slice?.deliveredToClientAt?.trim()) return true;
  return slice?.status === 'completed';
}

/** Canonical scope for checklist state — `engagements.id` (matches `engagements.checklist_state`). */
export function checklistStateKeyForEngagement(engagement: Pick<Engagement, 'id'>): string {
  return engagement.id;
}

/** Client's engagement row (portal + RLS use `client_user_id` or `client_id`). */
export function findEngagementForClientUser(
  engagements: Engagement[],
  user: Pick<AuthUser, 'id' | 'clientId'>,
): Engagement | undefined {
  return (
    engagements.find((e) => e.clientUserId === user.id) ??
    (user.clientId ? engagements.find((e) => e.clientId === user.clientId) : undefined)
  );
}

/** Key used when reading/writing checklist state for a signed-in client. */
/** Scope ids that may refer to the same engagement (id, legacy client_id). */
export function engagementScopeIds(engagement: Engagement, extra?: string | null): string[] {
  const ids = new Set<string>([engagement.id]);
  if (engagement.clientId) ids.add(engagement.clientId);
  if (extra?.trim()) ids.add(extra.trim());
  return [...ids];
}

/** Normalize one checklist item slice from DB jsonb. */
export function normalizeChecklistItemSlice(
  raw: unknown,
  itemId?: string,
): ChecklistItemStateSlice {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: 'not-started' };
  }

  const obj = raw as Record<string, unknown>;
  const fieldIds = itemId ? responseFieldIdsForItem(itemId) : [];
  const responses: ChecklistItemResponses = {};

  const mergeResponses = (source: unknown) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return;
    const bag = source as Record<string, unknown>;
    if (
      bag.responses &&
      typeof bag.responses === 'object' &&
      !Array.isArray(bag.responses)
    ) {
      mergeResponses(bag.responses);
    }
    for (const [key, value] of Object.entries(bag)) {
      if (key === 'responses') continue;
      if (typeof value === 'string' && value.trim()) {
        responses[key] = value;
      }
    }
  };

  mergeResponses(obj.responses);

  const fieldIdSet = new Set(fieldIds);

  for (const id of fieldIds) {
    const v = obj[id];
    if (typeof v === 'string' && v.trim()) {
      responses[id] = v;
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (ITEM_META_KEYS.has(key)) continue;
    if (itemId && !fieldIdSet.has(key)) continue;
    if (typeof value === 'string' && value.trim()) {
      responses[key] = value;
    }
  }

  const status =
    typeof obj.status === 'string' ? coerceStatusCode(obj.status) : 'not-started';

  const unlockedRaw = obj.unlockedFields;
  const unlockedFields = Array.isArray(unlockedRaw)
    ? unlockedRaw.filter((id): id is string => typeof id === 'string')
    : undefined;

  const reviewRaw = obj.reviewStatus;
  const reviewStatus =
    reviewRaw === 'reviewing' || reviewRaw === 'accepted' || reviewRaw === 'rejected'
      ? reviewRaw
      : undefined;

  const workflowStage = coerceRegistrationWorkflowStage(
    typeof obj.workflowStage === 'string' ? obj.workflowStage : undefined,
  );

  const clientFillRequest = normalizeClientFillRequest(obj.clientFillRequest);

  return {
    status,
    assigneeId: typeof obj.assigneeId === 'string' ? obj.assigneeId : undefined,
    notes: typeof obj.notes === 'string' ? obj.notes : undefined,
    completedOn: typeof obj.completedOn === 'string' ? obj.completedOn : undefined,
    clientSubmittedAt:
      typeof obj.clientSubmittedAt === 'string' ? obj.clientSubmittedAt : undefined,
    locked: obj.locked === true ? true : undefined,
    ...(unlockedFields?.length ? { unlockedFields } : {}),
    reviewStatus,
    reviewSource:
      obj.reviewSource === 'client_submission' || obj.reviewSource === 'lead_manager_request'
        ? obj.reviewSource
        : undefined,
    reviewedAt: typeof obj.reviewedAt === 'string' ? obj.reviewedAt : undefined,
    reviewedBy: typeof obj.reviewedBy === 'string' ? obj.reviewedBy : undefined,
    rejectionNote: typeof obj.rejectionNote === 'string' ? obj.rejectionNote : undefined,
    deliveredToClientAt:
      typeof obj.deliveredToClientAt === 'string' ? obj.deliveredToClientAt : undefined,
    sharedIncorpDraftDocs: Array.isArray(obj.sharedIncorpDraftDocs)
      ? obj.sharedIncorpDraftDocs.filter(
          (k): k is string => typeof k === 'string' && k.trim().length > 0,
        )
      : undefined,
    incorpDraftsSharedAt:
      typeof obj.incorpDraftsSharedAt === 'string' ? obj.incorpDraftsSharedAt : undefined,
    ...(workflowStage ? { workflowStage } : {}),
    ...(clientFillRequest ? { clientFillRequest } : {}),
    ...(Object.keys(responses).length ? { responses } : {}),
  };
}

export function normalizeEngagementChecklistState(
  state: Record<string, unknown>,
): Record<string, ChecklistItemStateSlice> {
  const out: Record<string, ChecklistItemStateSlice> = {};
  for (const [itemId, slice] of Object.entries(state)) {
    out[itemId] = normalizeChecklistItemSlice(slice, itemId);
  }
  return out;
}
