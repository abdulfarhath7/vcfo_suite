import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { stepFieldStates } from '@/db/schema';
import { getItem } from '@/data/checklist';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { stepPathForRole } from '@/lib/projects/project-step-path';
import { fieldsAnsweredBell } from '@/lib/steps/field-ask-email';

/**
 * ASKED FIELDS BECOME ANSWERED (S-497): when the client saves a step, every field staff had
 * asked for and the client now filled moves from "asked" to "answered", so the lead sees
 * "Review" on it. Called by `updateChecklistState` after a client write, on the engagement id
 * that call already checked; it never takes an id from the request. A field SBC sent back and
 * the client then corrected also moves to "answered". The project lead or leads and the managers
 * get one bell per step ("<Company> answered 2 fields on <Step>"), sent after the save without
 * waiting for it. Best effort: a failure here never blocks the client's save.
 */

function filled(v: unknown): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return String(v).trim() !== '';
}

function responsesOf(state: Record<string, unknown> | null | undefined, itemId: string): Record<string, unknown> {
  const slice = state?.[itemId] as { responses?: Record<string, unknown> } | undefined;
  return slice?.responses && typeof slice.responses === 'object' ? slice.responses : {};
}

/** Fields whose response changed to a filled value, per step. Pure. */
export function changedFilledFields(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const itemId of Object.keys(next)) {
    const before = responsesOf(prev, itemId);
    const after = responsesOf(next, itemId);
    const ids = Object.keys(after).filter((f) => filled(after[f]) && JSON.stringify(after[f]) !== JSON.stringify(before[f]));
    if (ids.length) out.set(itemId, ids);
  }
  return out;
}

export async function markAskedFieldsAnswered(
  engagementDbId: string,
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): Promise<void> {
  const changed = changedFilledFields(prev, next);
  if (changed.size === 0) return;
  const now = new Date();
  const flipped = new Map<string, number>();
  try {
    for (const [itemId, fieldIds] of changed) {
      const rows = await db
        .update(stepFieldStates)
        .set({ state: 'answered', updatedAt: now })
        .where(
          and(
            eq(stepFieldStates.engagementId, engagementDbId),
            eq(stepFieldStates.itemId, itemId),
            inArray(stepFieldStates.fieldId, fieldIds),
            inArray(stepFieldStates.state, ['asked', 'sent_back']),
          ),
        )
        .returning({ id: stepFieldStates.id });
      if (rows.length) flipped.set(itemId, rows.length);
    }
  } catch (err) {
    console.error('[field-states] could not mark answered', err instanceof Error ? err.message : err);
  }
  if (flipped.size) void notifyStaffOfAnswers(engagementDbId, flipped);
}

/** Bells the engagement's leads and managers once per step whose asked fields were answered. */
async function notifyStaffOfAnswers(engagementDbId: string, flipped: Map<string, number>): Promise<void> {
  try {
    const r = await resolveEngagementRecipients(engagementDbId);
    if (!r) return;
    const project = { id: r.appId, slug: r.slug };
    const people = new Map<string, 'intern' | 'manager'>();
    for (const p of r.leads) people.set(p.userId, 'intern');
    for (const p of r.managers) if (!people.has(p.userId)) people.set(p.userId, 'manager');
    if (people.size === 0) return;
    const items = [];
    for (const [itemId, count] of flipped) {
      const stepTitle = getItem(itemId)?.title ?? itemId;
      const bell = fieldsAnsweredBell(r.companyName, stepTitle, count);
      for (const [userId, role] of people) {
        items.push({
          userId,
          kind: 'checklist.submit' as const,
          title: bell.title,
          body: bell.body,
          engagementId: r.appId,
          companyName: r.companyName,
          itemId,
          href: stepPathForRole(role, project, itemId),
        });
      }
    }
    await createNotificationsForUsers(items);
  } catch (err) {
    console.warn('[field-states] answer bell failed', err instanceof Error ? err.message : err);
  }
}
