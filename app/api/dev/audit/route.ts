import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { decodeAuditCursor, listAuditForDev } from '@/db/repositories/dev-audit';

const Query = z.object({
  before: z
    .string()
    .max(80)
    .refine((v) => decodeAuditCursor(v) !== null, 'invalid cursor')
    .optional(),
  result: z.enum(['ok', 'failed', 'denied']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * GET /api/dev/audit: system and access audit events, newest first, with the result column.
 * `before` is the `nextBefore` cursor from the previous page ("Load older"). Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, Query, async (ctx, q) => {
    const before = q.before ? decodeAuditCursor(q.before) : null;
    return listAuditForDev(ctx, { before, result: q.result, limit: q.limit });
  });
}
