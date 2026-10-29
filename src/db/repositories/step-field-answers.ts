import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { stepFieldStates } from '@/db/schema';

/**
 * ASKED FIELDS BECOME ANSWERED (S-497): when the client saves a step, every field staff had
 * asked for and the client now filled moves from "asked" to "answered", so the lead sees
 * "Review" on it. Called by `updateChecklistState` after a client write, on the engagement id
 * that call already checked; it never takes an id from the request. Best effort: a failure here
 * never blocks the client's save.
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
  try {
    for (const [itemId, fieldIds] of changed) {
      await db
        .update(stepFieldStates)
        .set({ state: 'answered', updatedAt: now })
        .where(
          and(
            eq(stepFieldStates.engagementId, engagementDbId),
            eq(stepFieldStates.itemId, itemId),
            inArray(stepFieldStates.fieldId, fieldIds),
            eq(stepFieldStates.state, 'asked'),
          ),
        );
    }
  } catch (err) {
    console.error('[field-states] could not mark answered', err instanceof Error ? err.message : err);
  }
}
