import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { stepFieldStates } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { postStaffMessage } from '@/db/repositories/client-messages';
import { getItem } from '@/data/checklist';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import type { StepFieldAction, StepFieldState, StepFieldStateWord } from '@/lib/steps/field-states';

export type { StepFieldAction, StepFieldState, StepFieldStateWord };

/**
 * STEP FIELD STATES (S-496, S-497, S-499): the review state of one field inside a step.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   developer — nothing; refused before the first query.
 *   client — reads the states of its own engagement (`assertEngagementAccess`); never writes.
 *   intern / manager — read and write on engagements `assertEngagementAccess` allows.
 *   admin / super_admin — every engagement.
 * Writes target `access.dbId`, never the id the caller sent, and every change writes an audit
 * event. A reminder also posts one staff message on the client thread, keyed to the step.
 *
 * Actions: ask (state asked, asked_at now), remind (only an asked field; asked_at kept, so
 * "Asked · 3d" keeps counting), answered, approve (approved, reviewed_at now), send_back
 * (sent_back, reviewed_at now) and clear (the row is removed).
 */

export class StepFieldStateError extends Error {
  constructor(
    public code: 'forbidden' | 'not_found' | 'bad_item' | 'not_asked',
    public status: 400 | 403 | 404 | 409,
  ) {
    super(code);
  }
}

const STAFF = new Set(['super_admin', 'admin', 'manager', 'intern']);
const READERS = new Set([...STAFF, 'client']);

async function access(ctx: AuthContext, engagementId: string, write: boolean) {
  if (!(write ? STAFF : READERS).has(ctx.role)) throw new StepFieldStateError('forbidden', 403);
  const a = await assertEngagementAccess(ctx, engagementId);
  if (!a.ok) {
    if ('notFound' in a) throw new StepFieldStateError('not_found', 404);
    throw new StepFieldStateError('forbidden', 403);
  }
  return a;
}

type Row = typeof stepFieldStates.$inferSelect;

function toState(row: Row): StepFieldState {
  return {
    engagementId: appEngagementId(row.engagementId),
    itemId: row.itemId,
    fieldId: row.fieldId,
    state: row.state as StepFieldStateWord,
    askedAt: row.askedAt ? row.askedAt.toISOString() : null,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    actorId: row.actorId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Field states of one engagement, or of one step when `itemId` is given. */
export async function listStepFieldStates(
  ctx: AuthContext,
  engagementId: string,
  itemId?: string,
): Promise<StepFieldState[]> {
  const a = await access(ctx, engagementId, false);
  const where = itemId
    ? and(eq(stepFieldStates.engagementId, a.dbId), eq(stepFieldStates.itemId, itemId))
    : eq(stepFieldStates.engagementId, a.dbId);
  const rows = await db.select().from(stepFieldStates).where(where);
  return rows.map(toState);
}

const NEXT: Record<Exclude<StepFieldAction, 'clear' | 'remind'>, StepFieldStateWord> = {
  ask: 'asked',
  answered: 'answered',
  approve: 'approved',
  send_back: 'sent_back',
};

const AUDIT: Record<StepFieldAction, string> = {
  ask: 'asked the client for a field',
  remind: 'reminded the client about a field',
  answered: 'marked a field answered',
  approve: 'approved a field',
  send_back: 'sent a field back',
  clear: 'cleared a field state',
};

/**
 * Apply one action to one field. Returns the new state, or null after `clear`.
 * `label` is the field's on-screen name, used only in the reminder message.
 */
export async function applyStepFieldAction(
  ctx: AuthContext,
  input: { engagementId: string; itemId: string; fieldId: string; action: StepFieldAction; label?: string | null },
): Promise<StepFieldState | null> {
  const a = await access(ctx, input.engagementId, true);
  const item = getItem(input.itemId);
  if (!item) throw new StepFieldStateError('bad_item', 400);
  const fieldId = input.fieldId.trim();
  if (!fieldId) throw new StepFieldStateError('bad_item', 400);

  const key = and(
    eq(stepFieldStates.engagementId, a.dbId),
    eq(stepFieldStates.itemId, item.id),
    eq(stepFieldStates.fieldId, fieldId),
  );
  const [cur] = await db.select().from(stepFieldStates).where(key).limit(1);
  const now = new Date();
  let out: StepFieldState | null = null;

  if (input.action === 'clear') {
    if (cur) await db.delete(stepFieldStates).where(key);
  } else if (input.action === 'remind') {
    if (!cur || cur.state !== 'asked') throw new StepFieldStateError('not_asked', 409);
    const what = input.label?.trim() || fieldId;
    await postStaffMessage(ctx, {
      engagementId: a.dbId,
      body: `Reminder: ${what} for ${item.title}`,
      itemKey: `step:${appEngagementId(a.dbId)}:${item.id}`,
    });
    out = toState(cur);
  } else {
    const state = NEXT[input.action];
    const set = {
      state,
      actorId: ctx.userId,
      updatedAt: now,
      askedAt: state === 'asked' ? now : (cur?.askedAt ?? null),
      reviewedAt: state === 'approved' || state === 'sent_back' ? now : (cur?.reviewedAt ?? null),
    };
    const [row] = await db
      .insert(stepFieldStates)
      .values({ engagementId: a.dbId, itemId: item.id, fieldId, ...set })
      .onConflictDoUpdate({
        target: [stepFieldStates.engagementId, stepFieldStates.itemId, stepFieldStates.fieldId],
        set,
      })
      .returning();
    out = row ? toState(row) : null;
  }

  void recordAuditEvent(ctx, {
    engagementId: a.dbId,
    action: `step.field_${input.action}`,
    summary: `${AUDIT[input.action]} on ${item.title}`,
    metadata: { itemId: item.id, fieldId },
  });
  return out;
}
