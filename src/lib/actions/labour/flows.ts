import 'server-only';

import { z } from 'zod';
import type { AuthContext } from '@/auth/guards';
import { getBatch, updateBatch } from '@/db/repositories/labour-registers';
import type { AssumptionSet } from '@/lib/labour-registers/cache-key';

/** How a figure was arrived at, for the assumptions route and for a card alike. */

export const assumptionsInput = z.object({
  fullAttendanceAssumed: z.boolean().optional(),
  /* The keys the grid understands, not free text. A value outside this set used to be
     accepted and then silently ignored by the grid, which is how a register came to print
     `P` on every Sunday under a footnote saying Sundays were off. */
  weekOff: z.enum(['none', 'sun', 'sat-sun', 'alt-sat-sun']).optional(),
  holidayList: z.string().max(200).optional(),
  dateOrder: z.enum(['day-first', 'month-first']).optional(),
  doubleRateOvertime: z.boolean().optional(),
  wageRateBasis: z.enum(['monthly', 'daily']).optional(),
  dailyHours: z.number().min(1).max(24).optional(),
  /* Whose rules this establishment is under. Decides which registers exist at all. */
  sphere: z.enum(['state', 'central']).optional(),
  establishment: z
    .object({
      name: z.string().max(200).optional(),
      address: z.string().max(400).optional(),
      shiftName: z.string().max(80).optional(),
      shiftStart: z.string().max(20).optional(),
      shiftEnd: z.string().max(20).optional(),
      restInterval: z.string().max(40).optional(),
      dateOfPayment: z.string().max(20).optional(),
    })
    .optional(),
});

export type MergeOutcome =
  | { kind: 'not_found' }
  | { kind: 'closed' }
  | { kind: 'done'; batchId: string; merged: Record<string, unknown>; previous: Record<string, unknown> };

/**
 * Merged, not replaced: the establishment's shift timings and the attendance decision are set on
 * different screens at different times and neither should clear the other. Refused once the period
 * is closed.
 */
export async function mergeAssumptions(ctx: AuthContext, batchId: string, incoming: z.infer<typeof assumptionsInput>): Promise<MergeOutcome> {
  const batch = await getBatch(ctx, batchId);
  if (!batch) return { kind: 'not_found' };
  if (batch.markedReadyAt) return { kind: 'closed' };

  const current = (batch.assumptions ?? {}) as AssumptionSet & { establishment?: Record<string, string> };
  const merged = {
    ...current,
    ...incoming,
    ...(incoming.establishment ? { establishment: { ...(current.establishment ?? {}), ...incoming.establishment } } : {}),
  };

  const updated = await updateBatch(ctx, batchId, { assumptions: merged });
  if (!updated) return { kind: 'not_found' };
  return { kind: 'done', batchId: updated.id, merged, previous: { ...current } };
}
