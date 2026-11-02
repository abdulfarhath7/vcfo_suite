import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { disconnectOutlookForDev } from '@/db/repositories/dev-connections';

const Body = z.object({ id: z.uuid() });

/**
 * POST /api/dev/connections/outlook/disconnect: remove one linked Outlook mailbox (R-40). The
 * page asks for the word DISCONNECT first; the repository writes the audit row. 404 when the
 * link is already gone. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const out = await disconnectOutlookForDev(ctx, body.id);
    if (!out) return { status: 404, body: { error: 'not_found' } };
    return { status: 200, body: { ok: true, person: out.person } };
  });
}
