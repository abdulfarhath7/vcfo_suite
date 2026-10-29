import { NextResponse } from 'next/server';
import { requireRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { listClientThread, postClientMessage } from '@/db/repositories/client-messages';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { notifyClientMessage } from '@/lib/messages/notify-messages';
import { postMessageSchema } from '@/lib/messages/schemas';

/**
 * GET /api/client/messages?engagementId=<id> — the client's thread on one of their own
 * engagements, oldest first. Staff messages are marked read.
 */
export async function GET(request: Request) {
  const guard = await requireRole('client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const engagementId = new URL(request.url).searchParams.get('engagementId')?.trim();
  if (!engagementId) return NextResponse.json({ error: 'engagementId is required' }, { status: 400 });

  try {
    const messages = await listClientThread(guard.ctx, engagementId);
    if (!messages) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[api/client/messages] list failed', err);
    return NextResponse.json({ error: 'Could not load messages' }, { status: 500 });
  }
}

/**
 * POST /api/client/messages { engagementId, body, itemKey? } — the client writes to the people
 * on the engagement. The leads get a bell notification and an email.
 */
export async function POST(request: Request) {
  const guard = await requireRole('client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const parsed = await parseJsonBody(request, postMessageSchema);
  if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const message = await postClientMessage(guard.ctx, parsed.data);
    if (!message) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });

    await recordAuditEvent(guard.ctx, {
      engagementId: message.engagementId,
      action: 'message.client_sent',
      summary: 'Client sent a message',
      metadata: { messageId: message.id, itemKey: message.itemKey },
    });
    await notifyClientMessage(message, { name: guard.ctx.name, email: guard.ctx.email });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error('[api/client/messages] post failed', err);
    return NextResponse.json({ error: 'Could not send the message' }, { status: 500 });
  }
}
