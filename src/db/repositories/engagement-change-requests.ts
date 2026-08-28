import 'server-only';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementChangeRequests, engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import type {
  ChangeRequestKind,
  ChangeRequestPreview,
  ChangeRequestStatus,
} from '@/lib/project-change-request-types';

export type ChangeRequestRow = typeof engagementChangeRequests.$inferSelect;

export {
  CHANGE_REQUEST_KINDS,
  CHANGE_REQUEST_KIND_LABEL,
  isChangeRequestKind,
} from '@/lib/project-change-request-types';
export type {
  ChangeRequestKind,
  ChangeRequestPreview,
  ChangeRequestPreviewField,
  ChangeRequestStatus,
} from '@/lib/project-change-request-types';

/**
 * Managers may only file against projects they can already reach, so the
 * engagement access check is the whole authorisation story on create.
 */
export async function createChangeRequest(
  ctx: AuthContext,
  input: {
    engagementId: string;
    kind: ChangeRequestKind;
    payload: Record<string, unknown>;
    preview: ChangeRequestPreview;
    reason?: string;
  },
): Promise<ChangeRequestRow> {
  if (ctx.role !== 'manager' && !isFirmWideAdmin(ctx.role)) {
    throw new Error('not_permitted');
  }
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (access.ok === false) {
    throw new Error('notFound' in access ? 'not_found' : 'not_permitted');
  }

  const [row] = await db
    .insert(engagementChangeRequests)
    .values({
      engagementId: access.dbId,
      kind: input.kind,
      status: 'pending',
      requestedBy: ctx.userId,
      requestedByName: ctx.name,
      reason: input.reason?.trim() || null,
      payload: input.payload,
      preview: input.preview,
    })
    .returning();
  return row;
}

export type ChangeRequestListRow = ChangeRequestRow & {
  companyName: string | null;
  engagementSlug: string | null;
};

/**
 * Admins see every request; a manager sees only their own. Both default to the
 * pending queue — pass `statuses` to widen it for a history view.
 */
export async function listChangeRequests(
  ctx: AuthContext,
  options: { statuses?: ChangeRequestStatus[]; engagementId?: string } = {},
): Promise<ChangeRequestListRow[]> {
  const isAdmin = isFirmWideAdmin(ctx.role);
  if (!isAdmin && ctx.role !== 'manager') return [];

  const conds = [];
  const statuses = options.statuses ?? ['pending'];
  conds.push(
    statuses.length === 1
      ? eq(engagementChangeRequests.status, statuses[0])
      : inArray(engagementChangeRequests.status, statuses),
  );
  if (!isAdmin) conds.push(eq(engagementChangeRequests.requestedBy, ctx.userId));
  if (options.engagementId) {
    conds.push(eq(engagementChangeRequests.engagementId, engagementDbId(options.engagementId)));
  }

  return db
    .select({
      id: engagementChangeRequests.id,
      engagementId: engagementChangeRequests.engagementId,
      kind: engagementChangeRequests.kind,
      status: engagementChangeRequests.status,
      requestedBy: engagementChangeRequests.requestedBy,
      requestedByName: engagementChangeRequests.requestedByName,
      reason: engagementChangeRequests.reason,
      payload: engagementChangeRequests.payload,
      preview: engagementChangeRequests.preview,
      decidedBy: engagementChangeRequests.decidedBy,
      decidedByName: engagementChangeRequests.decidedByName,
      decidedAt: engagementChangeRequests.decidedAt,
      decisionNote: engagementChangeRequests.decisionNote,
      createdAt: engagementChangeRequests.createdAt,
      updatedAt: engagementChangeRequests.updatedAt,
      companyName: engagements.companyName,
      engagementSlug: engagements.slug,
    })
    .from(engagementChangeRequests)
    .leftJoin(engagements, eq(engagements.id, engagementChangeRequests.engagementId))
    .where(conds.length === 1 ? conds[0] : and(...conds))
    .orderBy(desc(engagementChangeRequests.createdAt));
}

/** Admin reads any request; the requesting manager reads their own. */
export async function getChangeRequest(
  ctx: AuthContext,
  id: string,
): Promise<ChangeRequestRow | null> {
  const isAdmin = isFirmWideAdmin(ctx.role);
  if (!isAdmin && ctx.role !== 'manager') return null;
  const where = isAdmin
    ? eq(engagementChangeRequests.id, id)
    : and(
        eq(engagementChangeRequests.id, id),
        eq(engagementChangeRequests.requestedBy, ctx.userId),
      );
  const [row] = await db.select().from(engagementChangeRequests).where(where).limit(1);
  return row ?? null;
}

/**
 * Close a request. Only the admin decides approved/rejected; only the original
 * requester cancels. Guarded on `status = 'pending'` so a double-click or two
 * admins racing cannot decide the same request twice — the second call gets
 * no row back and the caller reports `already_decided`.
 */
export async function decideChangeRequest(
  ctx: AuthContext,
  id: string,
  decision: 'approved' | 'rejected' | 'cancelled',
  note?: string,
): Promise<ChangeRequestRow | null> {
  if (decision === 'cancelled') {
    const [row] = await db
      .update(engagementChangeRequests)
      .set({
        status: 'cancelled',
        decidedBy: ctx.userId,
        decidedByName: ctx.name,
        decidedAt: new Date(),
        decisionNote: note?.trim() || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(engagementChangeRequests.id, id),
          eq(engagementChangeRequests.status, 'pending'),
          eq(engagementChangeRequests.requestedBy, ctx.userId),
        ),
      )
      .returning();
    return row ?? null;
  }

  if (!isFirmWideAdmin(ctx.role)) throw new Error('not_permitted');

  const [row] = await db
    .update(engagementChangeRequests)
    .set({
      status: decision,
      decidedBy: ctx.userId,
      decidedByName: ctx.name,
      decidedAt: new Date(),
      decisionNote: note?.trim() || null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(engagementChangeRequests.id, id), eq(engagementChangeRequests.status, 'pending')),
    )
    .returning();
  return row ?? null;
}

/** Re-open a request the admin approved but whose execution then failed. */
export async function reopenChangeRequest(id: string): Promise<void> {
  await db
    .update(engagementChangeRequests)
    .set({
      status: 'pending',
      decidedBy: null,
      decidedByName: null,
      decidedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(engagementChangeRequests.id, id));
}

/** Pending count for the admin nav badge. */
export async function countPendingChangeRequests(ctx: AuthContext): Promise<number> {
  const rows = await listChangeRequests(ctx, { statuses: ['pending'] });
  return rows.length;
}

/** Superseded siblings — cancelling them keeps the queue honest after a decision. */
export async function cancelSiblingRequests(
  engagementDbIdValue: string,
  kind: ChangeRequestKind,
  exceptId: string,
): Promise<void> {
  await db
    .update(engagementChangeRequests)
    .set({
      status: 'cancelled',
      decisionNote: 'Superseded by another decision on the same project.',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(engagementChangeRequests.engagementId, engagementDbIdValue),
        eq(engagementChangeRequests.kind, kind),
        eq(engagementChangeRequests.status, 'pending'),
        ne(engagementChangeRequests.id, exceptId),
      ),
    );
}
