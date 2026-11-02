import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { deliveryStatusCountsForDev, listMessagesForDev } from '@/db/repositories/dev-messages';

const Query = z.object({
  channel: z.enum(['email', 'whatsapp']).optional(),
  status: z.enum(['queued', 'pending', 'sent', 'delivered', 'read', 'failed', 'skipped']).optional(),
  only: z.enum(['deliveries', 'emails']).optional(),
  deliveriesBefore: z.iso.datetime().optional(),
  emailsBefore: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/**
 * GET /api/dev/messages: notification deliveries and the checklist mail log, newest first,
 * with recipient addresses masked. "Load older" passes `only` and the matching `*Before`
 * cursor. The first page also carries the delivery count per status for the channel, for
 * the status tabs. Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, Query, async (ctx, q) => {
    const older = Boolean(q.deliveriesBefore || q.emailsBefore);
    const [page, statusCounts] = await Promise.all([
      listMessagesForDev(ctx, {
        channel: q.channel,
        status: q.status,
        only: q.only,
        deliveriesBefore: q.deliveriesBefore ? new Date(q.deliveriesBefore) : undefined,
        emailsBefore: q.emailsBefore ? new Date(q.emailsBefore) : undefined,
        limit: q.limit,
      }),
      older ? Promise.resolve(undefined) : deliveryStatusCountsForDev(ctx, q.channel),
    ]);
    return statusCounts ? { ...page, statusCounts } : page;
  });
}
