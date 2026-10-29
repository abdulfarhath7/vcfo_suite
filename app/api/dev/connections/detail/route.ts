import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { checkMailDomain } from '@/lib/dev/domain';
import { messageRoutes } from '@/lib/dev/message-routes';
import { listConnectionEventsForDev } from '@/db/repositories/dev-checks';
import { messageRoutesForDev } from '@/db/repositories/dev-messages';
import type { ConnectionDetailPayload } from '@/lib/dev/types';

const Query = z.object({
  service: z.enum(['email', 'whatsapp', 'storage', 'jobs', 'ask', 'outlook', 'credentials', 'logs', 'deploys', 'costs']),
});

/**
 * GET /api/dev/connections/detail?service=<id>: the sections under a picked service. The last
 * five events (checks and console actions), the message routes that use it (email and
 * WhatsApp only), and for email the mail domain check (SPF, DKIM, DMARC, return path).
 * Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, Query, async (ctx, q): Promise<ConnectionDetailPayload> => {
    const channel = q.service === 'email' ? 'email' : q.service === 'whatsapp' ? 'whatsapp' : null;
    const [events, usedBy, domain] = await Promise.all([
      listConnectionEventsForDev(ctx, q.service),
      channel ? messageRoutesForDev(ctx, messageRoutes().filter((r) => r.channel === channel)) : Promise.resolve([]),
      q.service === 'email' ? checkMailDomain() : Promise.resolve(null),
    ]);
    return { service: q.service, events, usedBy, domain, canSendTest: q.service === 'email' };
  });
}
