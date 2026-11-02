import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { itemKeySchema } from '@/lib/messages/schemas';
import { sendClientReminder } from '@/lib/reminders/send-client-reminder';

type RouteContext = { params: Promise<{ id: string }> };

const remindSchema = z.object({
  itemKey: itemKeySchema,
  note: z.string().trim().max(1000, 'Note is too long').nullish(),
});

/**
 * POST /api/engagements/:id/remind { itemKey, note? } — staff remind the client about one
 * item they still owe. Email first, WhatsApp only for clients who opted in, an audit event,
 * and at most one reminder per item per 24 hours (429 with `retryAt` after that).
 * Returns `{ sent: true, channels }`.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, remindSchema);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const result = await sendClientReminder(guard.ctx, id, parsed.data);
    if (result.ok === false) {
      return NextResponse.json(
        { error: result.error, ...(result.retryAt ? { retryAt: result.retryAt } : {}) },
        { status: result.status },
      );
    }
    return NextResponse.json({ sent: true, channels: result.channels });
  } catch (err) {
    console.error('[api/engagements/:id/remind] failed', err);
    return NextResponse.json({ error: 'Could not send the reminder' }, { status: 500 });
  }
}
