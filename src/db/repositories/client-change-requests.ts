import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientTimelineRequests, profiles, tasks } from '@/db/schema';
import type { TimelinePhaseDates, TimelineRequestDto } from '@/lib/client-home';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { getActiveCatalogItems } from '@/data/checklist';

/**
 * CLIENT CHANGE REQUESTS.
 *
 * The client never edits a checklist step. When something on their file is
 * wrong, they ask the firm to change it, and that ask lands as a task on the
 * engagement's delivery lead — so it shows up in the lead's own work queue
 * rather than in a separate inbox nobody watches.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * `assertEngagementAccess` is the only door: a client asking about an
 * engagement they cannot see gets `null`, which the route turns into 404. The
 * task is written against the engagement id that check just approved, and the
 * assignee is resolved from that engagement's own `intern_id` — a caller
 * cannot choose who to assign work to.
 *
 * This is the ONLY write a client makes to the engagement's work surface, and
 * it cannot touch `checklist_state`.
 */

/** How a change request reads in the lead's queue. */
const TITLE_PREFIX = 'Client change request';

const CLIENT_CHANGE_REQUEST_MAX_NOTE = 2000;

export interface ClientChangeRequestInput {
  engagementId: string;
  /** Catalog step the request is about. */
  stepId: string;
  /** What the client wants changed, in their words. */
  note: string;
}

export interface ClientChangeRequest {
  id: string;
  stepId: string;
  stepTitle: string;
  note: string;
  createdAt: string;
}

/** The lead who owns delivery on this engagement, if one is assigned. */
async function resolveLeadUserId(internId: string | null): Promise<string | null> {
  const key = internId?.trim();
  if (!key) return null;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.internId, key))
    .limit(1);
  return row?.id ?? null;
}

export async function createClientChangeRequest(
  ctx: AuthContext,
  input: ClientChangeRequestInput,
): Promise<ClientChangeRequest | null> {
  const note = input.note.trim();
  if (!note) throw new Error('A change request needs a note');
  if (note.length > CLIENT_CHANGE_REQUEST_MAX_NOTE) {
    throw new Error('That note is too long');
  }

  const item = getActiveCatalogItems().find((step) => step.id === input.stepId);
  if (!item) throw new Error('Unknown step');

  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) return null;

  const assignedTo = await resolveLeadUserId(access.row.internId);

  const [row] = await db
    .insert(tasks)
    .values({
      engagementId: access.dbId,
      assignedTo,
      title: `${TITLE_PREFIX}: ${item.title}`,
      description: note,
      stepId: item.id,
      status: 'open',
    })
    .returning();

  if (!row) throw new Error('Could not record the request');

  await recordAuditEvent(ctx, {
    engagementId: access.dbId,
    action: 'client.change_request',
    summary: `Client asked for a change on ${item.title}`,
    metadata: { stepId: item.id, taskId: row.id },
  });

  return {
    id: row.id,
    stepId: item.id,
    stepTitle: item.title,
    note,
    createdAt: row.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------------
 * TIMELINE change requests (client portal v7 · Home › Timeline › Edit).
 *
 * Same door as a step change request: `assertEngagementAccess`, a task for the
 * engagement's delivery lead, an audit event. The proposed dates are stored in
 * `client_timeline_requests` (pending until the Project Manager decides); the
 * schedule itself is NOT touched here — a client can only ask.
 * A withdraw (the toast's Undo) is the requester's own, pending request only.
 * ---------------------------------------------------------------------- */

export interface ClientTimelineRequestInput {
  engagementId: string;
  reason: string;
  phases: TimelinePhaseDates[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export async function createClientTimelineRequest(
  ctx: AuthContext,
  input: ClientTimelineRequestInput,
  before?: { coiTo?: string },
): Promise<TimelineRequestDto | null> {
  const reason = input.reason.trim();
  if (!reason) throw new Error('Add a short reason so the project manager can approve it');
  if (reason.length > CLIENT_CHANGE_REQUEST_MAX_NOTE) throw new Error('That note is too long');
  const phases = (input.phases ?? [])
    .filter((p) => p && ['p1', 'p2', 'mca', 'coi'].includes(p.id) && ISO.test(p.from) && ISO.test(p.to) && p.from <= p.to)
    .map((p) => ({ id: p.id, name: String(p.name ?? '').slice(0, 80), from: p.from, to: p.to }));
  if (phases.length === 0) throw new Error('No dates to change');

  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) return null;

  const coi = phases.find((p) => p.id === 'coi');
  const coiFrom = before?.coiTo && ISO.test(before.coiTo) ? before.coiTo : undefined;
  const slipDays = coi && coiFrom ? daysBetween(coiFrom, coi.from) : 0;

  const assignedTo = await resolveLeadUserId(access.row.internId);
  const summary = phases.map((p) => `${p.name}: ${p.from} → ${p.to}`).join('\n');
  const [task] = await db
    .insert(tasks)
    .values({
      engagementId: access.dbId,
      assignedTo,
      title: `${TITLE_PREFIX}: Timeline`,
      description: `${reason}\n\n${summary}`,
      stepId: 'pre-12',
      status: 'open',
    })
    .returning();

  // A newer request replaces an older pending one.
  await db
    .update(clientTimelineRequests)
    .set({ status: 'withdrawn', updatedAt: new Date() })
    .where(
      and(
        eq(clientTimelineRequests.engagementId, access.dbId),
        eq(clientTimelineRequests.status, 'pending'),
      ),
    );

  const [row] = await db
    .insert(clientTimelineRequests)
    .values({
      engagementId: access.dbId,
      taskId: task?.id ?? null,
      requestedBy: ctx.userId,
      requestedByName: ctx.name || ctx.email,
      reason,
      payload: { phases, coiFrom, coiTo: coi?.from, slipDays },
      status: 'pending',
    })
    .returning();
  if (!row) throw new Error('Could not record the request');

  await recordAuditEvent(ctx, {
    engagementId: access.dbId,
    action: 'client.timeline_change_request',
    summary: 'Client asked for a timeline change',
    metadata: { requestId: row.id, taskId: task?.id, slipDays },
  });

  return {
    id: row.id,
    reason,
    status: 'pending',
    phases,
    coiFrom,
    coiTo: coi?.from,
    slipDays,
    createdAt: row.createdAt.toISOString(),
    requestedByName: row.requestedByName ?? undefined,
  };
}

export async function withdrawClientTimelineRequest(ctx: AuthContext, id: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(clientTimelineRequests)
    .where(eq(clientTimelineRequests.id, id))
    .limit(1);
  if (!row || row.requestedBy !== ctx.userId || row.status !== 'pending') return false;
  const access = await assertEngagementAccess(ctx, row.engagementId);
  if (!access.ok) return false;
  await db
    .update(clientTimelineRequests)
    .set({ status: 'withdrawn', updatedAt: new Date() })
    .where(and(eq(clientTimelineRequests.id, id), eq(clientTimelineRequests.engagementId, access.dbId)));
  if (row.taskId) {
    await db
      .update(tasks)
      .set({ status: 'done', updatedAt: new Date() })
      .where(and(eq(tasks.id, row.taskId), eq(tasks.engagementId, access.dbId)));
  }
  await recordAuditEvent(ctx, {
    engagementId: access.dbId,
    action: 'client.timeline_change_request_withdrawn',
    summary: 'Client withdrew a timeline change request',
    metadata: { requestId: id },
  });
  return true;
}
