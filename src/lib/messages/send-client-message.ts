import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { postClientMessage, type PostMessageInput } from '@/db/repositories/client-messages';
import type { Message } from '@/lib/messages/types';
import { notifyClientMessage } from './notify-messages';

/** A client's message to the people on their project: the portal's thread and the chat both come here. Null when the project is not theirs. */
export async function sendClientMessage(ctx: AuthContext, input: PostMessageInput): Promise<Message | null> {
  const message = await postClientMessage(ctx, input);
  if (!message) return null;
  await recordAuditEvent(ctx, {
    engagementId: message.engagementId,
    action: 'message.client_sent',
    summary: 'Client sent a message',
    metadata: { messageId: message.id, itemKey: message.itemKey },
  });
  await notifyClientMessage(message, { name: ctx.name, email: ctx.email });
  return message;
}
