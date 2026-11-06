import { z } from 'zod';

/**
 * The input rules a filing's routes and its chat actions share, so the two cannot drift apart. Who
 * may write stays in the repositories.
 */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isoDate = z.string().regex(DATE, 'invalid_date');

export const windowFields = z.object({ from: isoDate.nullable().optional(), to: isoDate.nullable().optional() });

/** A working window has both ends, or neither when it is being cleared. */
export function withBothDates<Schema extends z.ZodType<{ from?: string | null; to?: string | null }>>(schema: Schema) {
  return schema.refine((window) => Boolean(window.from) === Boolean(window.to), { message: 'window_needs_both_dates', path: ['to'] });
}

export const detailDate = z.string().regex(DATE).nullable().optional();

/** The dated facts on a filing that a person records as the work moves. */
export const filingDetailsFields = z.object({
  acknowledgementNo: z.string().max(80).nullable().optional(),
  amountPaid: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  dataReceivedOn: detailDate,
  preparingSince: detailDate,
  draftDueOn: detailDate,
  approvalDueOn: detailDate,
});
