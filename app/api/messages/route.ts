import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { listStaffMessages, postStaffMessage } from '@/db/repositories/client-messages';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { notifyStaffReply } from '@/lib/messages/notify-messages';
import { postMessageSchema, triageFilterSchema } from '@/lib/messages/schemas';

const STAFF = ['super_admin', 'admin', 'manager', 'intern'] as const;

/**
 * GET /api/messages?triage=new|todo|done|ignored|all&engagementId? — staff, scoped like
 * engagements. A triage state lists client messages in that state, newest first; `all` lists
 * both sides. With `engagementId` it is that engagement's thread, oldest first, and the
 * client messages in it are marked read.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole(...STAFF);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const params = new URL(request.url).searchParams;
  const triage = triageFilterSchema.safeParse(params.get('triage') ?? 'all');
  if (!triage.success) return NextResponse.json({ error: 'Invalid triage filter' }, { status: 400 });
  const engagementId = params.get('engagementId')?.trim() || null;

  try {
    const messages = await listStaffMessages(guard.ctx, { triage: triage.data, engagementId });
    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[api/messages] list failed', err);
    return NextResponse.json({ error: 'Could not load messages' }, { status: 500 });
  }
}

/** POST /api/messages { engagementId, body, itemKey? } — a staff reply; the client is emailed. */
export async function POST(request: Request) {
  const guard = await requireAnyRole(...STAFF);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = await parseJsonBody(request, postMessageSchema);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const message = await postStaffMessage(guard.ctx, parsed.data);
    if (!message) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });

    await recordAuditEvent(guard.ctx, {
      engagementId: message.engagementId,
      action: 'message.staff_sent',
      summary: 'Replied to the client',
      metadata: { messageId: message.id, itemKey: message.itemKey },
    });
    await notifyStaffReply(message, { name: guard.ctx.name, email: guard.ctx.email });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error('[api/messages] post failed', err);
    return NextResponse.json({ error: 'Could not send the reply' }, { status: 500 });
  }
}
