import { z } from 'zod';
import { FEE_BILLING, FEE_STATUS } from '@/db/repositories/engagement-fees';

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

/** One fee line as the Fees tab sends it (P-100). */
export const feeBodySchema = z.object({
  service: z.string().trim().min(1).max(120),
  amountRupees: z.number().int().min(0).max(1_000_000_000),
  billing: z.enum(FEE_BILLING),
  status: z.enum(FEE_STATUS),
  billedOn: isoDay,
  paidOn: isoDay,
});

/** Maps a repository error to an HTTP status. */
export function feeErrorStatus(message: string): number {
  if (message.startsWith('Only')) return 403;
  if (message.includes('not found')) return 404;
  return 500;
}
