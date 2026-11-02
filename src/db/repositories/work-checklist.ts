import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { workChecklistItems } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { resolveWorkItem } from '@/db/repositories/work-items';
import { isSameIdSet } from '@/lib/work/checklist-order';
import { canUseWorkTools } from '@/lib/work/work-access';

/**
 * WORK CHECKLIST — a person's own checklist on one work item (task drawer, G-16),
 * table `work_checklist_items`.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   Every read and write is the caller's own rows (`created_by = ctx.userId`) on an
 *   item they can resolve (`resolveWorkItem`: lead on the engagements they lead,
 *   manager on theirs, admins on all). Nobody reads another person's checklist.
 *   client / developer — nothing.
 */

export const CHECKLIST_LABEL_MAX = 200;
const MAX_ITEMS_PER_LIST = 60;

export interface WorkChecklistItemDto {
  id: string;
  itemKey: string;
  label: string;
  done: boolean;
  position: number;
}

type Row = typeof workChecklistItems.$inferSelect;

function toDto(row: Row): WorkChecklistItemDto {
  return { id: row.id, itemKey: row.itemKey, label: row.label, done: row.done, position: row.position };
}

async function ownRows(ctx: AuthContext, key: string): Promise<Row[]> {
  return db
    .select()
    .from(workChecklistItems)
    .where(and(eq(workChecklistItems.itemKey, key), eq(workChecklistItems.createdBy, ctx.userId)))
    .orderBy(asc(workChecklistItems.position), asc(workChecklistItems.createdAt));
}

/** One own row, and only while its item still resolves for the caller. */
async function ownRow(ctx: AuthContext, id: string): Promise<Row | null> {
  if (!canUseWorkTools(ctx.role)) return null;
  const [row] = await db
    .select()
    .from(workChecklistItems)
    .where(and(eq(workChecklistItems.id, id), eq(workChecklistItems.createdBy, ctx.userId)))
    .limit(1);
  if (!row) return null;
  const item = await resolveWorkItem(ctx, row.itemKey);
  return item ? row : null;
}

export async function listChecklist(ctx: AuthContext, key: string): Promise<WorkChecklistItemDto[] | null> {
  const item = await resolveWorkItem(ctx, key);
  if (!item) return null;
  return (await ownRows(ctx, item.key)).map(toDto);
}

export async function addChecklistItem(
  ctx: AuthContext,
  key: string,
  label: string,
): Promise<WorkChecklistItemDto | null> {
  const text = label.trim().slice(0, CHECKLIST_LABEL_MAX);
  if (!text) throw new Error('invalid_label');
  const item = await resolveWorkItem(ctx, key);
  if (!item) return null;
  const existing = await ownRows(ctx, item.key);
  if (existing.length >= MAX_ITEMS_PER_LIST) throw new Error('invalid_too_many');
  const position = existing.reduce((max, r) => Math.max(max, r.position), -1) + 1;
  const [row] = await db
    .insert(workChecklistItems)
    .values({
      itemKey: item.key,
      engagementId: item.engagementId,
      label: text,
      position,
      createdBy: ctx.userId,
    })
    .returning();
  if (!row) return null;
  void recordAuditEvent(ctx, {
    engagementId: item.engagementId,
    action: 'work.checklist.added',
    summary: `Checklist item added: ${text}`,
    metadata: { itemKey: item.key, checklistItemId: row.id },
  });
  return toDto(row);
}

export async function updateChecklistItem(
  ctx: AuthContext,
  id: string,
  patch: { label?: string; done?: boolean },
): Promise<WorkChecklistItemDto | null> {
  const row = await ownRow(ctx, id);
  if (!row) return null;
  const label = patch.label !== undefined ? patch.label.trim().slice(0, CHECKLIST_LABEL_MAX) : undefined;
  if (label !== undefined && !label) throw new Error('invalid_label');
  const [updated] = await db
    .update(workChecklistItems)
    .set({
      ...(label !== undefined ? { label } : {}),
      ...(patch.done !== undefined ? { done: patch.done } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(workChecklistItems.id, row.id), eq(workChecklistItems.createdBy, ctx.userId)))
    .returning();
  if (!updated) return null;
  void recordAuditEvent(ctx, {
    engagementId: row.engagementId,
    action: 'work.checklist.updated',
    summary:
      patch.done !== undefined
        ? `Checklist item ${patch.done ? 'ticked' : 'unticked'}: ${updated.label}`
        : `Checklist item renamed: ${updated.label}`,
    metadata: { itemKey: row.itemKey, checklistItemId: row.id },
  });
  return toDto(updated);
}

/** Write a new order for the caller's list on an item. `ids` must be exactly their rows. */
export async function reorderChecklist(
  ctx: AuthContext,
  key: string,
  ids: string[],
): Promise<WorkChecklistItemDto[] | null> {
  const item = await resolveWorkItem(ctx, key);
  if (!item) return null;
  const rows = await ownRows(ctx, item.key);
  if (!isSameIdSet(rows.map((r) => r.id), ids)) throw new Error('invalid_order');
  for (const [position, id] of ids.entries()) {
    await db
      .update(workChecklistItems)
      .set({ position, updatedAt: new Date() })
      .where(and(eq(workChecklistItems.id, id), eq(workChecklistItems.createdBy, ctx.userId)));
  }
  void recordAuditEvent(ctx, {
    engagementId: item.engagementId,
    action: 'work.checklist.reordered',
    summary: 'Checklist reordered',
    metadata: { itemKey: item.key },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id, position) => toDto({ ...byId.get(id)!, position }));
}

export async function deleteChecklistItem(ctx: AuthContext, id: string): Promise<boolean> {
  const row = await ownRow(ctx, id);
  if (!row) return false;
  await db
    .delete(workChecklistItems)
    .where(and(eq(workChecklistItems.id, row.id), eq(workChecklistItems.createdBy, ctx.userId)));
  void recordAuditEvent(ctx, {
    engagementId: row.engagementId,
    action: 'work.checklist.deleted',
    summary: `Checklist item removed: ${row.label}`,
    metadata: { itemKey: row.itemKey, checklistItemId: row.id },
  });
  return true;
}
