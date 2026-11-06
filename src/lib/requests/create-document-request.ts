import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { createDocumentRequest } from '@/db/repositories/document-requests';
import { notifyEngagementEventSoon } from '@/lib/email/send-after-response';

/** A document request and the client's notice about it: the screen and the chat call this one. */
export async function createAndNotifyDocumentRequest(
  ctx: AuthContext,
  input: { engagementId: string; taskId?: string; label: string; message?: string; dueAt?: string },
) {
  const label = input.label.trim();
  const request = await createDocumentRequest(ctx, { ...input, label });
  const email = await notifyEngagementEventSoon({
    engagementId: input.engagementId,
    itemId: input.taskId?.trim() || 'document-request',
    event: 'request_created',
    note: input.message,
    requestLabel: label,
    actorUserId: ctx.userId,
  });
  return { request, email };
}
