import type { Engagement } from '@/data/engagements';
import {
  APP_ID_TO_DB_ID,
  engagementDbId,
  LEGACY_ENGAGEMENT_IDS,
} from '@/lib/legacy-engagement-ids';
import { isEngagementRouteParam, isUuid } from '@/lib/slug';
import {
  type ChecklistItemStateSlice,
  normalizeEngagementChecklistState,
} from '@/lib/checklist-state-key';
import {
  type BoardResolutionDoc,
  parseBoardResolutionRpcPayload,
} from '@/lib/board-resolution';
import { AppApiError, toastEmailDispatch } from '@/lib/toast-errors';
import type { EmailDispatchResult } from '@/lib/email/email-dispatch';

/**
 * ENGAGEMENTS — CLIENT-SIDE DATA ACCESS.
 *
 * Ported from the Supabase version. The public function names, arguments (minus
 * the leading `supabase` client) and return types are unchanged, so the ~10
 * views importing this module keep working.
 *
 * WHAT CHANGED, and why:
 *
 *  1. No `supabase` argument. The browser holds no database credentials; every
 *     call goes to an API route which authenticates, authorises via the
 *     repository layer (Path A scoping), and returns JSON.
 *
 *  2. The Postgres RPCs (submit/review/unlock checklist item, the board
 *     resolution state machine) were SECURITY DEFINER functions used to dodge
 *     RLS zero-row updates. Their logic now lives server-side in
 *     src/db/repositories/engagements.ts, behind the routes called here.
 *
 *  3. The `selectEngagementsWithFallback` / `preferLegacyEngagementSelect`
 *     machinery is GONE. It existed because a remote Supabase project might be
 *     missing the compliance migration, so PostgREST would error on
 *     entity_legal_form / incorporation_date. We own our migrations now, so a
 *     missing column is a bug to fix, not a case to silently degrade around.
 *
 * This module must stay client-safe: no `@/db/*`, no `@/storage/*`.
 */

export interface EngagementRow {
  id: string;
  slug: string;
  company_name: string;
  company_type: 'domestic' | 'foreign';
  entity_legal_form?: 'company' | 'llp' | 'partnership' | 'proprietorship';
  incorporation_date?: string | null;
  parent_entity_name: string | null;
  parent_entity_address: string | null;
  parent_entity_registration_number: string | null;
  client_id: string;
  client_user_id: string | null;
  intern_id: string;
  admin_id: string | null;
  client_name: string | null;
  stage: string;
  health: string;
  created_at: string;
  checklist_state?: Record<string, ChecklistItemStateSlice> | null;
}

export type EngagementChecklistState = Record<string, ChecklistItemStateSlice>;

export function rowToEngagement(
  row: EngagementRow,
  client?: { email: string; name: string | null } | null,
): Engagement {
  const id = LEGACY_ENGAGEMENT_IDS[row.id] ?? row.id;
  return {
    id,
    slug: row.slug,
    clientId: row.client_id,
    companyName: row.company_name,
    companyType: row.company_type ?? 'domestic',
    entityLegalForm: row.entity_legal_form ?? 'company',
    incorporationDate: row.incorporation_date?.slice(0, 10) ?? null,
    parentEntityName: row.parent_entity_name?.trim() || null,
    parentEntityAddress: row.parent_entity_address?.trim() || null,
    parentEntityRegistrationNumber:
      row.parent_entity_registration_number?.trim() || null,
    internId: row.intern_id,
    adminId: row.admin_id ?? 'admin',
    createdAt: row.created_at.slice(0, 10),
    stage: row.stage as Engagement['stage'],
    health: row.health as Engagement['health'],
    clientUserId: row.client_user_id,
    clientEmail: client?.email ?? null,
    clientDisplayName: row.client_name?.trim() || client?.name?.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Errors — thrown shapes preserved so existing catch blocks keep matching.
// ---------------------------------------------------------------------------

export class ChecklistSaveError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ChecklistSaveError';
    this.code = code;
  }
}

export class BoardResolutionSaveError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'BoardResolutionSaveError';
  }
}

// ---------------------------------------------------------------------------
// Fetch plumbing
// ---------------------------------------------------------------------------

interface ApiErrorBody {
  error?: string;
  code?: string;
  detail?: string;
}

/**
 * Calls an API route and unwraps the JSON. Throws AppApiError on non-2xx so
 * callers get the same toast-friendly error type the Supabase helpers produced.
 */
async function apiFetch<T>(
  path: string,
  init?: RequestInit & { fallbackError?: string },
): Promise<T> {
  const { fallbackError = 'Request failed.', ...rest } = init ?? {};

  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: {
        ...(rest.body && !(rest.body instanceof FormData)
          ? { 'content-type': 'application/json' }
          : {}),
        ...rest.headers,
      },
    });
  } catch {
    throw new AppApiError('Network error — check your connection.', { kind: 'network' });
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new AppApiError(body?.error ?? fallbackError, {
      kind: res.status === 401 || res.status === 403 ? 'auth' : 'server',
      code: body?.code,
    });
  }

  return (await res.json()) as T;
}

/** Shared by the checklist mutators, which all return the new state or throw. */
async function checklistMutation(
  path: string,
  body: unknown,
  fallback: string,
): Promise<EngagementChecklistState> {
  let payload: { checklistState?: unknown; email?: EmailDispatchResult };
  try {
    payload = await apiFetch<{ checklistState?: unknown; email?: EmailDispatchResult }>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      fallbackError: fallback,
    });
  } catch (err) {
    if (err instanceof AppApiError) {
      throw new ChecklistSaveError(err.message, err.code);
    }
    throw err;
  }

  const raw = payload.checklistState;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ChecklistSaveError(fallback);
  }
  toastEmailDispatch(payload.email);
  return normalizeEngagementChecklistState(raw as Record<string, unknown>);
}

async function boardResolutionMutation(
  path: string,
  init: RequestInit,
  fallback: string,
): Promise<BoardResolutionDoc> {
  let payload: { boardResolution?: unknown };
  try {
    payload = await apiFetch<{ boardResolution?: unknown }>(path, {
      ...init,
      fallbackError: fallback,
    });
  } catch (err) {
    if (err instanceof AppApiError) {
      throw new BoardResolutionSaveError(err.message, err.code);
    }
    throw err;
  }

  const doc = parseBoardResolutionRpcPayload(payload.boardResolution);
  if (!doc) throw new BoardResolutionSaveError(fallback);
  return doc;
}

function engagementPath(appOrDbId: string, suffix = ''): string {
  return `/api/engagements/${encodeURIComponent(engagementDbId(appOrDbId))}${suffix}`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface FetchEngagementsResult {
  engagements: Engagement[];
  checklistByEngagement: Record<string, EngagementChecklistState>;
}

export async function fetchEngagements(): Promise<FetchEngagementsResult> {
  const data = await apiFetch<{ engagements: Engagement[] }>('/api/engagements', {
    fallbackError: 'Could not load projects.',
  });
  // checklist_state is lazy-loaded per engagement via fetchChecklistState.
  return { engagements: data.engagements ?? [], checklistByEngagement: {} };
}

export async function fetchEngagementBySlug(slug: string): Promise<Engagement | null> {
  if (!isEngagementRouteParam(slug)) return null;
  const data = await apiFetch<{ engagement: Engagement | null }>(
    `/api/engagements/by-slug/${encodeURIComponent(slug)}`,
    { fallbackError: 'Could not load project.' },
  );
  return data.engagement ?? null;
}

export async function fetchEngagementById(appOrDbId: string): Promise<Engagement | null> {
  if (!isEngagementRouteParam(appOrDbId)) return null;
  const dbId = engagementDbId(appOrDbId);
  if (!isUuid(dbId) && !APP_ID_TO_DB_ID[appOrDbId]) return null;

  const data = await apiFetch<{ engagement: Engagement | null }>(engagementPath(appOrDbId), {
    fallbackError: 'Could not load project.',
  });
  return data.engagement ?? null;
}

export async function fetchEngagementChecklistState(
  appOrDbId: string,
): Promise<EngagementChecklistState | null> {
  if (!isEngagementRouteParam(appOrDbId)) return null;
  const dbId = engagementDbId(appOrDbId);
  if (!isUuid(dbId) && !APP_ID_TO_DB_ID[appOrDbId]) return null;
  return fetchChecklistState(appOrDbId);
}

export async function fetchChecklistState(
  appOrDbEngagementId: string,
): Promise<EngagementChecklistState> {
  const data = await apiFetch<{ checklistState?: unknown }>(
    engagementPath(appOrDbEngagementId, '/checklist'),
    { fallbackError: 'Could not load checklist answers.' },
  );
  const raw = data.checklistState;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return normalizeEngagementChecklistState(raw as Record<string, unknown>);
}

/** Checklist slices keyed by engagement app id (legacy e1 or uuid). */
export function checklistStateByEngagementFromRows(
  rows: EngagementRow[],
): Record<string, EngagementChecklistState> {
  const out: Record<string, EngagementChecklistState> = {};
  for (const row of rows) {
    const appId = LEGACY_ENGAGEMENT_IDS[row.id] ?? row.id;
    const raw = row.checklist_state;
    const state =
      !raw || typeof raw !== 'object' || Array.isArray(raw)
        ? {}
        : normalizeEngagementChecklistState(raw as Record<string, unknown>);
    if (Object.keys(state).length) out[appId] = state;
  }
  return out;
}

/**
 * The client portal's "which engagement am I?" lookup. The server resolves it
 * from the session, so userId/clientId are accepted for signature compatibility
 * but are NOT trusted as inputs — passing someone else's id gets you nothing.
 */
export async function fetchEngagementByClientUser(
  _userId: string,
  _clientId?: string | null,
): Promise<Engagement | null> {
  const data = await apiFetch<{ engagement: Engagement | null }>('/api/engagements/mine', {
    fallbackError: 'Could not load your project.',
  });
  return data.engagement ?? null;
}

export interface InternOption {
  id: string;
  name: string;
  initials: string;
}

export async function fetchInternOptions(): Promise<InternOption[] | null> {
  const data = await apiFetch<{ interns: InternOption[] }>('/api/admin/interns', {
    fallbackError: 'Could not load team members.',
  });
  return data.interns?.length ? data.interns : null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  companyName: string;
  companyType: 'domestic' | 'foreign';
  entityLegalForm?: 'company' | 'llp' | 'partnership' | 'proprietorship';
  parentEntityName: string;
  parentEntityAddress: string;
  clientEmail: string;
  clientPassword: string;
  clientName?: string;
  internId: string;
  /** Required when creating as firm admin. */
  managerId?: string;
  stage?: Engagement['stage'];
  health?: Engagement['health'];
}

export interface CreateProjectResult {
  engagement: Engagement;
  clientId: string;
  clientUserId: string;
  emailSent?: boolean;
  emailSkipped?: boolean;
  emailError?: string;
}

/**
 * Replaces the `create-client-engagement` Supabase Edge Function: one POST that
 * creates the client profile + engagement in a transaction and triggers the
 * welcome email.
 *
 * clientPassword is a one-time credential for the welcome email only — never
 * log it, persist it, or include it in error payloads.
 */
export async function createProjectWithClient(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  return apiFetch<CreateProjectResult>('/api/engagements', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      entityLegalForm: input.entityLegalForm ?? 'company',
      stage: input.stage ?? 'Pre-Incorporation',
      health: input.health ?? 'on-track',
    }),
    fallbackError: 'Failed to create project.',
  });
}

export interface UpdateEngagementInput {
  companyName?: string;
  /** Delivery lead scoping id — null clears the assignment. */
  internId?: string | null;
  /** Project manager profile UUID — null clears (admin only). */
  managerId?: string | null;
  stage?: Engagement['stage'];
  health?: Engagement['health'];
  incorporationDate?: string | null;
  entityLegalForm?: Engagement['entityLegalForm'];
}

export async function updateEngagementInDb(
  appId: string,
  patch: UpdateEngagementInput,
): Promise<Engagement | null> {
  const data = await apiFetch<{ engagement: Engagement | null }>(engagementPath(appId), {
    method: 'PATCH',
    body: JSON.stringify(patch),
    fallbackError: 'Could not save project changes.',
  });
  return data.engagement ?? null;
}

/** Merge one checklist item into engagement.checklist_state and persist. */
export async function patchChecklistItemInDb(
  appEngagementId: string,
  itemId: string,
  patch: Partial<ChecklistItemStateSlice>,
  current?: EngagementChecklistState,
): Promise<EngagementChecklistState> {
  return checklistMutation(
    engagementPath(appEngagementId, '/checklist'),
    { itemId, patch, current },
    'Could not save checklist answers.',
  );
}

/** Client submits a milestone — locks responses for review. */
export async function submitChecklistItemInDb(
  appEngagementId: string,
  itemId: string,
  responses?: Record<string, string>,
): Promise<EngagementChecklistState> {
  return checklistMutation(
    engagementPath(appEngagementId, '/checklist/submit'),
    { itemId, responses: responses ?? {} },
    'Submit did not return checklist state.',
  );
}

/** Intern/manager accepts or rejects a submitted milestone. */
export async function reviewChecklistItemInDb(
  appEngagementId: string,
  itemId: string,
  action: 'accept' | 'reject',
  note?: string,
): Promise<EngagementChecklistState> {
  return checklistMutation(
    engagementPath(appEngagementId, '/checklist/review'),
    { itemId, action, note: note ?? null },
    'Review did not return checklist state.',
  );
}

/** Intern/manager sets which fields the client may edit after submit. */
export async function setChecklistUnlockedFieldsInDb(
  appEngagementId: string,
  itemId: string,
  unlockedFields: string[],
): Promise<EngagementChecklistState> {
  return checklistMutation(
    engagementPath(appEngagementId, '/checklist/unlock'),
    { itemId, unlockedFields },
    'Unlock update did not return checklist state.',
  );
}

// ---------------------------------------------------------------------------
// Board resolution
// ---------------------------------------------------------------------------

export async function fetchBoardResolutionInDb(
  appEngagementId: string,
): Promise<BoardResolutionDoc | null> {
  let payload: { boardResolution?: unknown };
  try {
    payload = await apiFetch<{ boardResolution?: unknown }>(
      engagementPath(appEngagementId, '/board-resolution'),
      { fallbackError: 'Could not load board resolution.' },
    );
  } catch (err) {
    if (err instanceof AppApiError) {
      throw new BoardResolutionSaveError(err.message, err.code);
    }
    throw err;
  }
  if (payload.boardResolution == null) return null;
  return parseBoardResolutionRpcPayload(payload.boardResolution);
}

export async function saveBoardResolutionDraftInDb(
  appEngagementId: string,
  content: string,
  storagePath?: string | null,
  templateFingerprint?: string | null,
): Promise<BoardResolutionDoc> {
  return boardResolutionMutation(
    engagementPath(appEngagementId, '/board-resolution'),
    {
      method: 'PUT',
      body: JSON.stringify({
        content,
        storagePath: storagePath?.trim() || null,
        templateFingerprint: templateFingerprint?.trim() || null,
      }),
    },
    'Save did not return board resolution.',
  );
}

/** Replace .docx storage for a finalized board resolution without changing client-visible status. */
export async function repairBoardResolutionStorageInDb(
  appEngagementId: string,
  content: string,
  storagePath: string,
  templateFingerprint?: string | null,
): Promise<BoardResolutionDoc> {
  const path = storagePath.trim();
  if (!path) {
    throw new BoardResolutionSaveError('storage_path required for repair.');
  }
  return boardResolutionMutation(
    engagementPath(appEngagementId, '/board-resolution'),
    {
      method: 'PUT',
      body: JSON.stringify({
        content,
        storagePath: path,
        templateFingerprint: templateFingerprint?.trim() || null,
        repairFinalizedStorage: true,
      }),
    },
    'Repair did not return board resolution.',
  );
}

export async function finalizeBoardResolutionInDb(
  appEngagementId: string,
): Promise<BoardResolutionDoc> {
  return boardResolutionMutation(
    engagementPath(appEngagementId, '/board-resolution/finalize'),
    { method: 'POST' },
    'Finalize did not return board resolution.',
  );
}

export async function setSignedBoardResolutionInDb(
  appEngagementId: string,
  signedStoragePath: string,
): Promise<BoardResolutionDoc> {
  return boardResolutionMutation(
    engagementPath(appEngagementId, '/board-resolution/signed'),
    {
      method: 'POST',
      body: JSON.stringify({ signedStoragePath: signedStoragePath.trim() }),
    },
    'Signed upload did not return board resolution.',
  );
}

export { engagementDbId };
