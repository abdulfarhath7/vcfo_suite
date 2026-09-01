import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, tasks } from '@/db/schema';
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

export const CLIENT_CHANGE_REQUEST_MAX_NOTE = 2000;

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
