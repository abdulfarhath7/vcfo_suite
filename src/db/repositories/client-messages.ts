import 'server-only';
import { and, asc, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientMessages, engagements, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess, listScopedEngagementIds } from '@/db/repositories/engagements';
import { isAdminOrManager, isFirmWideAdmin } from '@/lib/auth';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import {
  isMessageTriage,
  MESSAGE_BODY_MAX,
  type Message,
  type MessageTriage,
  type MessageTriageFilter,
} from '@/lib/messages/types';

/**
 * CLIENT MESSAGES REPOSITORY (G-09, G-11).
 *
 * A client writes to the people on their engagement; staff reply from the same thread and
 * the lead triages each client message (new, to do, done, ignored).
 *
 * >>> ACCESS CONTROL (Path A, same scope as engagements) <<<
 *   client      — messages on their own engagements only (`assertEngagementAccess`)
 *   intern      — messages on engagements they lead (primary or `engagement_leads`)
 *   manager     — messages on engagements they own or co-manage
 *   admin / super_admin — every engagement
 *   developer   — none
 * A write is checked against the engagement first and stored against `access.dbId`, never
 * the id the caller sent. Triage only applies to client messages, and only staff may set it.
 */

type Row = typeof clientMessages.$inferSelect;

const LIST_LIMIT = 200;

const selectColumns = {
  message: clientMessages,
  companyName: engagements.companyName,
  senderName: profiles.name,
  senderEmail: profiles.email,
};

type JoinedRow = {
  message: Row;
  companyName: string | null;
  senderName: string | null;
  senderEmail: string | null;
};

function toMessage(row: JoinedRow): Message {
  const m = row.message;
  const fallback = m.senderSide === 'client' ? 'Client' : 'SBC team';
  return {
    id: m.id,
    engagementId: appEngagementId(m.engagementId),
    companyName: row.companyName ?? '',
    senderSide: m.senderSide === 'client' ? 'client' : 'staff',
    senderName: row.senderName?.trim() || row.senderEmail?.split('@')[0] || fallback,
    body: m.body,
    itemKey: m.itemKey ?? null,
    readAt: m.readAt ? m.readAt.toISOString() : null,
    triage: isMessageTriage(m.triage) ? m.triage : 'new',
    createdAt: m.createdAt.toISOString(),
  };
}

/** Staff who may read and answer client messages: lead, manager, admin, super admin. */
export function isMessageStaff(role: AuthContext['role']): boolean {
  return role === 'intern' || isAdminOrManager(role);
}

function cleanBody(body: string): string {
  const text = body.replace(/\r\n/g, '\n').trim();
  if (!text) throw new Error('body_required');
  if (text.length > MESSAGE_BODY_MAX) throw new Error('body_too_long');
  return text;
}

async function selectJoined(where: SQL | undefined, order: 'asc' | 'desc'): Promise<Message[]> {
  const rows = await db
    .select(selectColumns)
    .from(clientMessages)
    .innerJoin(engagements, eq(engagements.id, clientMessages.engagementId))
    .leftJoin(profiles, eq(profiles.id, clientMessages.senderId))
    .where(and(isNull(engagements.deletedAt), where))
    .orderBy(order === 'asc' ? asc(clientMessages.createdAt) : desc(clientMessages.createdAt))
    .limit(LIST_LIMIT);
  return (rows as JoinedRow[]).map(toMessage);
}

async function selectOne(id: string): Promise<Message | null> {
  const rows = await db
    .select(selectColumns)
    .from(clientMessages)
    .innerJoin(engagements, eq(engagements.id, clientMessages.engagementId))
    .leftJoin(profiles, eq(profiles.id, clientMessages.senderId))
    .where(eq(clientMessages.id, id))
    .limit(1);
  const row = (rows as JoinedRow[])[0];
  return row ? toMessage(row) : null;
}

/* ------------------------------------------------------------------ *
 * Client side
 * ------------------------------------------------------------------ */

/**
 * The client's thread on one engagement, oldest first. Staff messages are marked read
 * first, so the list comes back with their read time. Null when the engagement is not theirs.
 */
export async function listClientThread(
  ctx: AuthContext,
  engagementId: string,
): Promise<Message[] | null> {
  if (ctx.role !== 'client') return null;
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) return null;

  await db
    .update(clientMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(clientMessages.engagementId, access.dbId),
        eq(clientMessages.senderSide, 'staff'),
        isNull(clientMessages.readAt),
      ),
    );

  return selectJoined(eq(clientMessages.engagementId, access.dbId), 'asc');
}

export interface PostMessageInput {
  engagementId: string;
  body: string;
  itemKey?: string | null;
}

/** A client writes on their own engagement. Null when the engagement is not theirs. */
export async function postClientMessage(
  ctx: AuthContext,
  input: PostMessageInput,
): Promise<Message | null> {
  if (ctx.role !== 'client') return null;
  const body = cleanBody(input.body);
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) return null;

  const [row] = await db
    .insert(clientMessages)
    .values({
      engagementId: access.dbId,
      senderId: ctx.userId,
      senderSide: 'client',
      body,
      itemKey: input.itemKey?.trim() || null,
      triage: 'new',
    })
    .returning();
  if (!row) return null;
  return toMessage({ message: row, companyName: access.row.companyName, senderName: ctx.name, senderEmail: ctx.email });
}

/* ------------------------------------------------------------------ *
 * Staff side
 * ------------------------------------------------------------------ */

export interface ListStaffMessagesOptions {
  triage?: MessageTriageFilter;
  engagementId?: string | null;
}

/**
 * Staff list, scoped like engagements.
 *  - `triage` new | todo | done | ignored: client messages in that state, newest first.
 *  - `triage` all: every message on both sides.
 *  - With `engagementId`: that engagement's thread, oldest first; client messages are marked
 *    read first, because the caller is opening the thread.
 */
export async function listStaffMessages(
  ctx: AuthContext,
  opts: ListStaffMessagesOptions = {},
): Promise<Message[]> {
  if (!isMessageStaff(ctx.role)) return [];
  const triage = opts.triage ?? 'all';
  const triageWhere =
    triage === 'all'
      ? undefined
      : and(eq(clientMessages.senderSide, 'client'), eq(clientMessages.triage, triage));

  if (opts.engagementId?.trim()) {
    const access = await assertEngagementAccess(ctx, opts.engagementId.trim());
    if (!access.ok) return [];
    await db
      .update(clientMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(clientMessages.engagementId, access.dbId),
          eq(clientMessages.senderSide, 'client'),
          isNull(clientMessages.readAt),
        ),
      );
    return selectJoined(and(eq(clientMessages.engagementId, access.dbId), triageWhere), 'asc');
  }

  if (isFirmWideAdmin(ctx.role)) return selectJoined(triageWhere, 'desc');

  const ids = await listScopedEngagementIds(ctx);
  if (ids.length === 0) return [];
  return selectJoined(and(inArray(clientMessages.engagementId, ids), triageWhere), 'desc');
}

/** Staff set the triage state of one client message. Null when it is out of scope. */
export async function setMessageTriage(
  ctx: AuthContext,
  id: string,
  triage: MessageTriage,
): Promise<Message | null> {
  if (!isMessageStaff(ctx.role)) return null;
  const [row] = await db.select().from(clientMessages).where(eq(clientMessages.id, id)).limit(1);
  if (!row) return null;
  const access = await assertEngagementAccess(ctx, row.engagementId);
  if (!access.ok) return null;
  if (row.senderSide !== 'client') throw new Error('Only client messages are triaged');

  await db
    .update(clientMessages)
    .set({
      triage,
      triagedBy: ctx.userId,
      triagedAt: new Date(),
      readAt: row.readAt ?? new Date(),
    })
    .where(eq(clientMessages.id, row.id));
  return selectOne(row.id);
}

/**
 * A staff reply on an engagement in scope. Replying does not change the triage of the client
 * messages; that stays the lead's own decision. Null when the engagement is out of scope.
 */
export async function postStaffMessage(
  ctx: AuthContext,
  input: PostMessageInput,
): Promise<Message | null> {
  if (!isMessageStaff(ctx.role)) return null;
  const body = cleanBody(input.body);
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) return null;

  const [row] = await db
    .insert(clientMessages)
    .values({
      engagementId: access.dbId,
      senderId: ctx.userId,
      senderSide: 'staff',
      body,
      itemKey: input.itemKey?.trim() || null,
      // Staff messages are never triaged; "done" keeps them out of any triage count.
      triage: 'done',
    })
    .returning();
  if (!row) return null;
  return toMessage({ message: row, companyName: access.row.companyName, senderName: ctx.name, senderEmail: ctx.email });
}
