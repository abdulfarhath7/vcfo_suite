import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditEvents } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { listAuditEvents, toAuditEventRow } from '@/db/repositories/audit-events';
import { isAdminOrManager } from '@/lib/auth';
import { sentEmailFromAudit, sentEmailReached, type SentEmailRow } from '@/lib/email/sent-email';

/**
 * SENT EMAILS (GL-07): who sent an email from a project's cards, when, to whom and the subject,
 * read from the `email.sent` audit records, newest first.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   admin / super_admin / manager / intern — the `listAuditEvents` scope for the project.
 *   client — only their own project (`assertEngagementAccess`) and only the emails sent to their
 *            own address; the sender shows as a first name, or "Admin" for an Admin (BR-03).
 *   any other role — nothing.
 */
export async function listSentEmails(
  ctx: AuthContext,
  input: { engagementId: string; itemId?: string | null; limit?: number },
): Promise<SentEmailRow[]> {
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 200);
  const forItem = (r: SentEmailRow) => !input.itemId || r.itemId === input.itemId;

  if (isAdminOrManager(ctx.role) || ctx.role === 'intern') {
    const rows = await listAuditEvents(ctx, { engagementId: input.engagementId, action: 'email.sent', limit: 200 });
    return rows.map((r) => sentEmailFromAudit(r)).filter(forItem).slice(0, limit);
  }

  if (ctx.role !== 'client' || !ctx.email) return [];
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) return [];
  const rows = await db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.engagementId, access.dbId), eq(auditEvents.action, 'email.sent')))
    .orderBy(desc(auditEvents.createdAt))
    .limit(200);
  return rows
    .map(toAuditEventRow)
    .filter((r) => sentEmailReached(r, ctx.email))
    .map((r) => sentEmailFromAudit(r, { forClient: true }))
    .filter(forItem)
    .slice(0, limit);
}
