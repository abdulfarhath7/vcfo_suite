import 'server-only';

import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientFileRequests, documents, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { getItem } from '@/data/checklist';
import { getClientResponseFields } from '@/lib/checklist/checklist-responses';
import { expandRepeatFields, parseRepeatFieldId } from '@/lib/checklist/checklist-repeat';
import { isMilestoneStoragePath } from '@/lib/milestone-document-storage';
import { isStepReleasedToClient } from '@/lib/checklist/checklist-visibility';
import { normalizeEngagementSchedule } from '@/lib/schedule-windows';
import {
  assertEngagementAccess,
  checklistStateForViewer,
  checklistStateFromRow,
  getMyEngagement,
  patchChecklistItem,
} from '@/db/repositories/engagements';
import { getBoardResolutionByEngagementId } from '@/db/repositories/board-resolution';
import type {
  ClientFileRequestDto,
  ClientIncorporationExtras,
  IncorporationFileMeta,
} from '@/lib/client-portal/incorporation-types';

/**
 * CLIENT INCORPORATION REPOSITORY (client portal v7 — Incorporation pages).
 *
 * Two things live here:
 *  1. `client_file_requests` — the firm asks the client for one file field of
 *     one step; the client attaches it (and may undo the attach).
 *  2. `getClientIncorporationExtras` — the bits of the Incorporation pages that
 *     the client-redacted checklist state does not carry: who set the
 *     incorporation window, the open file requests, upload metadata (size,
 *     uploader, date) for files on steps released to the client, and the
 *     board-resolution people.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Every function first runs `assertEngagementAccess(ctx, engagementId)` (the
 * engagements RLS table: admin/super_admin all · manager owned + co-managed ·
 * intern assigned + lead member · client own + member engagement).
 *   - create / cancel a request: admin, super_admin, manager, intern (staff
 *     with access). Clients never.
 *   - read requests: anyone with access to the engagement.
 *   - attach / undo: the client only, only on an OPEN request of its own
 *     engagement, only an object path under `<engagementId>/<fieldId>/`.
 *   - file metadata to a client: only object keys that appear in the
 *     client-redacted checklist state (i.e. on steps released to the client)
 *     or that the client attached itself.
 * A caller naming another tenant's engagement gets `not_found` / `forbidden`,
 * never a row.
 */

export class FileRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
  }
}

type RequestRow = typeof clientFileRequests.$inferSelect;

function iso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

async function namesFor(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const uniq = [...new Set(ids.filter((v): v is string => Boolean(v && /^[0-9a-f-]{36}$/i.test(v))))];
  if (!uniq.length) return new Map();
  const rows = await db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email })
    .from(profiles)
    .where(inArray(profiles.id, uniq));
  return new Map(rows.map((r) => [r.id, r.name?.trim() || r.email.split('@')[0] || '']));
}

function toDto(row: RequestRow, names: Map<string, string>): ClientFileRequestDto {
  return {
    id: row.id,
    stepId: row.stepId,
    fieldId: row.fieldId,
    label: row.label,
    note: row.note ?? undefined,
    dueDate: row.dueDate ?? undefined,
    requestedAt: row.requestedAt.toISOString(),
    requestedByName: row.requestedBy ? names.get(row.requestedBy) : undefined,
    fulfilledAt: iso(row.fulfilledAt),
    fulfilledByName: row.fulfilledBy ? names.get(row.fulfilledBy) : undefined,
    fulfilledPath: row.fulfilledPath ?? undefined,
    fileName: row.fileName ?? undefined,
    sizeBytes: row.sizeBytes ?? undefined,
    contentType: row.contentType ?? undefined,
  };
}

async function requireAccess(ctx: AuthContext, engagementId: string) {
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) {
    throw new FileRequestError('forbidden' in access ? 'forbidden' : 'not_found', 'forbidden' in access ? 403 : 404);
  }
  return access;
}

/** The file field a request names must exist on that step (repeat ids resolve to their template). */
function fileFieldExists(stepId: string, fieldId: string, responses: Record<string, string>): boolean {
  const item = getItem(stepId);
  if (!item) return false;
  const fields = expandRepeatFields(getClientResponseFields(item), responses);
  const hit = fields.find((f) => f.id === fieldId);
  if (hit) return hit.type === 'file';
  const parsed = parseRepeatFieldId(fieldId);
  if (!parsed) return false;
  const group = getClientResponseFields(item).find((f) => f.id === parsed.groupId);
  return Boolean(group?.entryFields?.some((f) => f.id === parsed.fieldId && f.type === 'file'));
}

/** Open + fulfilled (not cancelled) requests of one engagement, newest first. */
export async function listFileRequests(ctx: AuthContext, engagementId: string): Promise<ClientFileRequestDto[]> {
  const access = await requireAccess(ctx, engagementId);
  const rows = await db
    .select()
    .from(clientFileRequests)
    .where(and(eq(clientFileRequests.engagementId, access.dbId), isNull(clientFileRequests.cancelledAt)))
    .orderBy(desc(clientFileRequests.requestedAt));
  const names = await namesFor(rows.flatMap((r) => [r.requestedBy, r.fulfilledBy]));
  return rows.map((r) => toDto(r, names));
}

export async function createFileRequest(
  ctx: AuthContext,
  engagementId: string,
  input: { stepId: string; fieldId: string; label: string; note?: string | null; dueDate?: string | null },
): Promise<ClientFileRequestDto> {
  if (ctx.role === 'client') throw new FileRequestError('Only the firm may ask for a file', 403);
  const access = await requireAccess(ctx, engagementId);
  const stepId = input.stepId.trim();
  const fieldId = input.fieldId.trim();
  const label = input.label.trim();
  if (!stepId || !fieldId || !label) throw new FileRequestError('invalid_request', 400);
  const state = checklistStateFromRow(access.row);
  const responses = (state[stepId]?.responses ?? {}) as Record<string, string>;
  if (!fileFieldExists(stepId, fieldId, responses)) throw new FileRequestError('not_a_file_field', 400);
  const due = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null;
  const [row] = await db
    .insert(clientFileRequests)
    .values({
      engagementId: access.dbId,
      stepId,
      fieldId,
      label: label.slice(0, 200),
      note: input.note?.trim().slice(0, 500) || null,
      dueDate: due,
      requestedBy: ctx.userId,
    })
    .returning();
  const names = await namesFor([row.requestedBy]);
  return toDto(row, names);
}

export async function cancelFileRequest(ctx: AuthContext, engagementId: string, requestId: string): Promise<void> {
  if (ctx.role === 'client') throw new FileRequestError('Only the firm may cancel a request', 403);
  const access = await requireAccess(ctx, engagementId);
  await db
    .update(clientFileRequests)
    .set({ cancelledAt: new Date() })
    .where(and(eq(clientFileRequests.id, requestId), eq(clientFileRequests.engagementId, access.dbId)));
}

/** Open (not fulfilled, not cancelled) requests on one step — the approve guard reads this. */
export async function openFileRequestsForStep(
  ctx: AuthContext,
  engagementId: string,
  stepId: string,
): Promise<ClientFileRequestDto[]> {
  const access = await requireAccess(ctx, engagementId);
  const rows = await db
    .select()
    .from(clientFileRequests)
    .where(
      and(
        eq(clientFileRequests.engagementId, access.dbId),
        eq(clientFileRequests.stepId, stepId),
        isNull(clientFileRequests.cancelledAt),
        isNull(clientFileRequests.fulfilledAt),
      ),
    );
  return rows.map((r) => toDto(r, new Map()));
}

async function requestForClient(ctx: AuthContext, engagementId: string, stepId: string, requestId: string) {
  if (ctx.role !== 'client') throw new FileRequestError('Only the client may attach a requested file', 403);
  const access = await requireAccess(ctx, engagementId);
  const [row] = await db
    .select()
    .from(clientFileRequests)
    .where(
      and(
        eq(clientFileRequests.id, requestId),
        eq(clientFileRequests.engagementId, access.dbId),
        eq(clientFileRequests.stepId, stepId),
        isNull(clientFileRequests.cancelledAt),
      ),
    )
    .limit(1);
  if (!row) throw new FileRequestError('request_not_found', 404);
  return { access, row };
}

/**
 * The client attaches the file it was asked for. The object is already in S3
 * (POST /api/engagements/:id/milestone-documents); this writes ONLY that
 * response key and fulfils the request.
 */
export async function clientAttachRequestedFile(
  ctx: AuthContext,
  engagementId: string,
  stepId: string,
  input: { requestId: string; path: string; fileName?: string; sizeBytes?: number; contentType?: string },
): Promise<{ request: ClientFileRequestDto; checklistState: ReturnType<typeof checklistStateForViewer> }> {
  const { access, row } = await requestForClient(ctx, engagementId, stepId, input.requestId);
  if (row.fulfilledAt) throw new FileRequestError('request_already_fulfilled', 409);
  const path = input.path.trim();
  if (!isMilestoneStoragePath(path) || !path.startsWith(`${access.dbId}/${row.fieldId}/`)) {
    throw new FileRequestError('invalid_path', 400);
  }
  const persisted = checklistStateFromRow(access.row);
  const previous = String((persisted[stepId]?.responses as Record<string, string> | undefined)?.[row.fieldId] ?? '');
  const state = await patchChecklistItem(ctx, engagementId, stepId, { responses: { [row.fieldId]: path } });
  const [updated] = await db
    .update(clientFileRequests)
    .set({
      fulfilledAt: new Date(),
      fulfilledBy: ctx.userId,
      fulfilledPath: path,
      previousPath: previous || null,
      fileName: input.fileName?.slice(0, 200) || path.split('/').pop() || null,
      sizeBytes: Number.isFinite(input.sizeBytes) ? Math.max(0, Math.round(input.sizeBytes ?? 0)) : null,
      contentType: input.contentType?.slice(0, 120) || null,
    })
    .where(eq(clientFileRequests.id, row.id))
    .returning();
  const names = await namesFor([updated.requestedBy, updated.fulfilledBy]);
  return { request: toDto(updated, names), checklistState: checklistStateForViewer(ctx, state) };
}

/** Undo of the upload toast: restore the previous response value, reopen the request (the S3 object stays). */
export async function clientUndoRequestedFile(
  ctx: AuthContext,
  engagementId: string,
  stepId: string,
  requestId: string,
): Promise<{ request: ClientFileRequestDto; checklistState: ReturnType<typeof checklistStateForViewer> }> {
  const { row } = await requestForClient(ctx, engagementId, stepId, requestId);
  if (!row.fulfilledAt) throw new FileRequestError('request_not_fulfilled', 409);
  const state = await patchChecklistItem(ctx, engagementId, stepId, {
    responses: { [row.fieldId]: row.previousPath ?? '' },
  });
  const [updated] = await db
    .update(clientFileRequests)
    .set({ fulfilledAt: null, fulfilledBy: null, fulfilledPath: null, previousPath: null, fileName: null, sizeBytes: null, contentType: null })
    .where(eq(clientFileRequests.id, row.id))
    .returning();
  const names = await namesFor([updated.requestedBy]);
  return { request: toDto(updated, names), checklistState: checklistStateForViewer(ctx, state) };
}

/** Every milestone object path in a (redacted) checklist state. */
function pathsInState(state: Record<string, { responses?: Record<string, unknown> } | undefined>): string[] {
  const out: string[] = [];
  for (const slice of Object.values(state)) {
    const r = slice?.responses;
    if (!r || typeof r !== 'object') continue;
    for (const v of Object.values(r)) if (typeof v === 'string' && isMilestoneStoragePath(v)) out.push(v.trim());
  }
  return out;
}

/** GET /api/client/incorporation — see the header for what each part is. */
export async function getClientIncorporationExtras(
  ctx: AuthContext,
  engagementId?: string,
): Promise<ClientIncorporationExtras | null> {
  let id = engagementId?.trim();
  if (!id) {
    const mine = await getMyEngagement(ctx);
    if (!mine) return null;
    id = mine.id;
  }
  const access = await assertEngagementAccess(ctx, id);
  if (!access.ok) return null;
  const row = access.row;
  const schedule = normalizeEngagementSchedule(row.schedule);
  const visibleState = checklistStateForViewer(ctx, checklistStateFromRow(row)) as Record<
    string,
    { responses?: Record<string, unknown> } | undefined
  >;

  const requests = await listFileRequests(ctx, access.dbId);

  const paths = pathsInState(visibleState);
  const meta: Record<string, IncorporationFileMeta> = {};
  if (paths.length) {
    const docs = await db
      .select({
        objectKey: documents.objectKey,
        sizeBytes: documents.sizeBytes,
        contentType: documents.contentType,
        uploadedBy: documents.uploadedBy,
        createdAt: documents.createdAt,
        stepId: documents.stepId,
      })
      .from(documents)
      .where(and(eq(documents.engagementId, access.dbId), inArray(documents.objectKey, paths.slice(0, 500))));
    const names = await namesFor(docs.map((d) => d.uploadedBy));
    for (const d of docs) {
      meta[d.objectKey] = {
        sizeBytes: d.sizeBytes ?? undefined,
        contentType: d.contentType ?? undefined,
        uploadedByName: d.uploadedBy ? names.get(d.uploadedBy) : undefined,
        uploadedAt: d.createdAt.toISOString(),
      };
    }
  }
  for (const r of requests) {
    if (!r.fulfilledPath) continue;
    meta[r.fulfilledPath] = {
      sizeBytes: r.sizeBytes,
      contentType: r.contentType,
      uploadedByName: r.fulfilledByName,
      uploadedAt: r.fulfilledAt,
    };
  }

  const br = await getBoardResolutionByEngagementId(ctx, access.dbId).catch(() => null);
  const pre3 = checklistStateFromRow(row)['pre-3'];
  const names = await namesFor([
    schedule.incorporation?.setBy,
    br?.finalizedBy,
    br?.signedUploadedBy,
    typeof pre3?.reviewedBy === 'string' ? pre3.reviewedBy : null,
  ]);
  const clientMayReadBr = ctx.role !== 'client' || br?.status === 'finalized';

  return {
    engagementId: access.dbId,
    windowSetByName: schedule.incorporation?.setBy ? names.get(schedule.incorporation.setBy) : undefined,
    fileRequests: requests,
    fileMeta: meta,
    boardResolution:
      br && clientMayReadBr
        ? {
            status: br.status,
            hasDocx: Boolean(br.storagePath?.trim()),
            draftedAt: br.draftedAt ?? undefined,
            finalizedAt: br.finalizedAt ?? undefined,
            finalizedByName: br.finalizedBy ? names.get(br.finalizedBy) : undefined,
            signedUploadedAt: br.signedUploadedAt ?? undefined,
            signedUploadedByName: br.signedUploadedBy ? names.get(br.signedUploadedBy) : undefined,
            signedFileName: br.signedStoragePath ? br.signedStoragePath.split('/').pop()?.replace(/^\d+-/, '') : undefined,
            receivedAt: pre3 && isStepReleasedToClient(pre3) && pre3.reviewStatus === 'accepted' ? pre3.reviewedAt ?? undefined : undefined,
            receivedByName:
              pre3 && pre3.reviewStatus === 'accepted' && typeof pre3.reviewedBy === 'string'
                ? names.get(pre3.reviewedBy)
                : undefined,
          }
        : null,
  };
}
