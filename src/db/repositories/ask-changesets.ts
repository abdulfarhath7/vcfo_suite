import 'server-only';

import { and, asc, eq, gt, gte, inArray } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';
import { db } from '@/db/client';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { askChangesetRows, askChangesets, askRuns } from '@/db/schema-ask';
import { isAdminOrManager } from '@/lib/auth';
import { AskForbiddenError, assertAskRole } from '@/lib/ask/access';
import type { ChangesetDraft, ChangesetStatus } from '@/lib/ask/changeset/types';

/**
 * Review cards. A card belongs to the person it was prepared for, inside an engagement they can
 * still reach. A manager or firm admin on that engagement also reads a card that holds a row only
 * they may approve. Nobody else sees one, whatever their role. `getAskChangesetForDecision` holds
 * raw values for the code that applies them; anything shown to a person goes through
 * `getAskChangesetSummary`, whose rows carry `displayOld` and `displayNew` only.
 */
export type AskChangesetRow = typeof askChangesets.$inferSelect;
export type AskChangesetRowRow = typeof askChangesetRows.$inferSelect;
export type AskChangesetRowSummary = Omit<AskChangesetRowRow, 'oldValue' | 'newValue' | 'undoData'> & { hasUndo: boolean };

export interface ChangesetAccess {
  changeset: AskChangesetRow;
  rows: AskChangesetRowRow[];
  companyName: string;
  viewerId: string;
  /** Prepared for this person. */
  owner: boolean;
  /** May approve a row that only a manager may approve. */
  manager: boolean;
}

export const rowNeedsManager = (row: Pick<AskChangesetRowRow, 'target'>): boolean => row.target.needsManager === true;

/** The card a run already made for exactly these changes, still untouched. A retried step uses it and makes no second one. */
export async function findAskChangesetForRun(ctx: AuthContext, runId: string, contentHash: string): Promise<string | null> {
  assertAskRole(ctx);
  const [row] = await db
    .select({ id: askChangesets.id })
    .from(askChangesets)
    .where(and(eq(askChangesets.runId, runId), eq(askChangesets.profileId, ctx.userId), eq(askChangesets.contentHash, contentHash), eq(askChangesets.status, 'proposed')))
    .limit(1);
  return row?.id ?? null;
}

export async function createAskChangeset(
  ctx: AuthContext,
  input: { draft: ChangesetDraft; contentHash: string; conversationId: string | null; runId: string | null; expiresAt: Date },
): Promise<string | null> {
  assertAskRole(ctx);
  const access = input.draft.engagementId ? await assertEngagementAccess(ctx, input.draft.engagementId) : null;
  if (access && !access.ok) return null;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(askChangesets)
      .values({
        profileId: ctx.userId,
        conversationId: input.conversationId,
        runId: input.runId,
        engagementId: access?.ok ? access.dbId : null,
        title: input.draft.title,
        tier: input.draft.tier,
        contentHash: input.contentHash,
        recipients: input.draft.recipients,
        expiresAt: input.expiresAt,
      })
      .returning({ id: askChangesets.id });
    await tx.insert(askChangesetRows).values(
      input.draft.rows.map((draft, ordinal) => ({
        changesetId: row!.id,
        ordinal,
        action: draft.action,
        target: draft.target,
        label: draft.label,
        oldValue: draft.oldValue,
        newValue: draft.newValue,
        displayOld: draft.displayOld,
        displayNew: draft.displayNew,
        sensitive: draft.sensitive,
        source: draft.source,
        checks: draft.checks,
        status: draft.heldReason ? 'held' : 'proposed',
        heldReason: draft.heldReason,
      })),
    );
    return row!.id;
  });
}

export async function getAskChangesetForDecision(ctx: AuthContext, id: string): Promise<ChangesetAccess | null> {
  assertAskRole(ctx);
  const [changeset] = await db.select().from(askChangesets).where(eq(askChangesets.id, id)).limit(1);
  if (!changeset) return null;
  const access = changeset.engagementId ? await assertEngagementAccess(ctx, changeset.engagementId) : null;
  if (access && !access.ok) return null;
  const rows = await db.select().from(askChangesetRows).where(eq(askChangesetRows.changesetId, id)).orderBy(asc(askChangesetRows.ordinal));
  const owner = changeset.profileId === ctx.userId;
  const manager = isAdminOrManager(ctx.role) && access !== null;
  if (!owner && !(manager && rows.some(rowNeedsManager))) return null;
  return { changeset, rows, companyName: access?.ok ? access.row.companyName : '', viewerId: ctx.userId, owner, manager };
}

export type ChangesetSummary = Omit<ChangesetAccess, 'rows'> & { rows: AskChangesetRowSummary[] };

export async function getAskChangesetSummary(ctx: AuthContext, id: string): Promise<ChangesetSummary | null> {
  const found = await getAskChangesetForDecision(ctx, id);
  if (!found) return null;
  return { ...found, rows: found.rows.map(({ oldValue: _old, newValue: _new, undoData, ...row }) => ({ ...row, hasUndo: undoData != null })) };
}

/** What the overnight job has already put in front of this person, decided or not, so it is not proposed again. */
export async function listOwnScheduledRows(ctx: AuthContext, since: Date): Promise<Array<Pick<AskChangesetRowRow, 'action' | 'target'>>> {
  assertAskRole(ctx);
  return db
    .select({ action: askChangesetRows.action, target: askChangesetRows.target })
    .from(askChangesetRows)
    .innerJoin(askChangesets, eq(askChangesets.id, askChangesetRows.changesetId))
    .innerJoin(askRuns, eq(askRuns.id, askChangesets.runId))
    .where(and(eq(askChangesets.profileId, ctx.userId), eq(askRuns.trigger, 'schedule'), gte(askChangesets.createdAt, since)));
}

/** Writes below take the access just read for this person, so a card cannot be changed by anyone else. */
function assertDecider(ctx: AuthContext, found: ChangesetAccess): void {
  if (found.viewerId !== ctx.userId) throw new AskForbiddenError('This card belongs to someone else.');
}

/** The one moment a card is approved: this exact content, still open, by one click only. */
export async function claimAskChangeset(ctx: AuthContext, found: ChangesetAccess, contentHash: string, now: Date): Promise<boolean> {
  assertDecider(ctx, found);
  const rows = await db
    .update(askChangesets)
    .set({ status: 'approved', decidedById: ctx.userId, decidedAt: now })
    .where(
      and(
        eq(askChangesets.id, found.changeset.id),
        inArray(askChangesets.status, ['proposed', 'partly_applied']),
        eq(askChangesets.contentHash, contentHash),
        gt(askChangesets.expiresAt, now),
      ),
    )
    .returning({ id: askChangesets.id });
  return rows.length > 0;
}

export async function setAskChangesetStatus(
  ctx: AuthContext,
  found: ChangesetAccess,
  status: ChangesetStatus,
  patch: { appliedAt?: Date; undoneAt?: Date; decidedAt?: Date } = {},
): Promise<void> {
  assertDecider(ctx, found);
  await db
    .update(askChangesets)
    .set({ status, ...patch, ...(patch.decidedAt ? { decidedById: ctx.userId } : {}) })
    .where(eq(askChangesets.id, found.changeset.id));
}

/**
 * One click's hold on one row: it moves the row to `applying` only from a status it may be decided
 * in, so of two requests that both read the row as open, one applies it and the other skips it.
 */
export async function claimAskChangesetRow(ctx: AuthContext, found: ChangesetAccess, rowId: string, from: readonly string[]): Promise<boolean> {
  assertDecider(ctx, found);
  const rows = await db
    .update(askChangesetRows)
    .set({ status: 'applying' })
    .where(and(eq(askChangesetRows.id, rowId), eq(askChangesetRows.changesetId, found.changeset.id), inArray(askChangesetRows.status, [...from])))
    .returning({ id: askChangesetRows.id });
  return rows.length > 0;
}

/** Each update names the statuses it may write over, so a copy read before another click cannot undo that click's work. */
export async function updateAskChangesetRows(
  ctx: AuthContext,
  found: ChangesetAccess,
  updates: ReadonlyArray<{ id: string; from: readonly string[]; patch: Partial<Pick<AskChangesetRowRow, 'status' | 'checks' | 'heldReason' | 'error' | 'undoData' | 'appliedAt' | 'newValue' | 'oldValue' | 'displayOld' | 'displayNew' | 'editedAt'>> }>,
): Promise<void> {
  assertDecider(ctx, found);
  for (const { id, from, patch } of updates) {
    await db
      .update(askChangesetRows)
      .set(patch)
      .where(and(eq(askChangesetRows.id, id), eq(askChangesetRows.changesetId, found.changeset.id), inArray(askChangesetRows.status, [...from])));
  }
}

/**
 * An edit's hold on the card: the new hash replaces the one just read only while the card is still
 * open, so an edit cannot land on a card an approval has claimed, and an approval of the old content
 * fails once the edit holds it.
 */
export async function claimAskChangesetEdit(ctx: AuthContext, found: ChangesetAccess, contentHash: string): Promise<boolean> {
  assertDecider(ctx, found);
  const rows = await db
    .update(askChangesets)
    .set({ contentHash })
    .where(and(eq(askChangesets.id, found.changeset.id), inArray(askChangesets.status, ['proposed', 'partly_applied']), eq(askChangesets.contentHash, found.changeset.contentHash)))
    .returning({ id: askChangesets.id });
  return rows.length > 0;
}
