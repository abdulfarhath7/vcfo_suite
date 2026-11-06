import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { uploadRequestFiles } from '@/db/repositories/client-documents';
import { notifyEngagementEventSoon } from '@/lib/email/send-after-response';

type Files = Parameters<typeof uploadRequestFiles>[2];

/**
 * A client answers one of their own open document requests, from the portal's upload or from an
 * approved chat card: the files are stored, and the lead hears about it once at least one landed.
 * Null when the request is not on their project.
 */
export async function answerDocumentRequest(ctx: AuthContext, requestId: string, files: Files) {
  const out = await uploadRequestFiles(ctx, requestId, files);
  if (!out) return null;
  if (out.fileIds.length === 0) return { out, email: null };
  const email = await notifyEngagementEventSoon({
    engagementId: out.engagementId,
    itemId: 'document-request',
    event: 'client_uploaded',
    requestLabel: out.requestLabel,
    actorUserId: ctx.userId,
  }).catch(() => null);
  return { out, email };
}
