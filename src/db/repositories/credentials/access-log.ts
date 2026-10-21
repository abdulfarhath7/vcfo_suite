import 'server-only';
import { and, desc, eq, like, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditEvents } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { CredentialsLogEntry } from '@/lib/client-portal/credentials';
import { resolveAccess } from './access';

/* ------------------------------------------------------------------ */
/* access log                                                          */
/* ------------------------------------------------------------------ */

export async function listCredentialsLog(ctx: AuthContext, engagementId?: string | null): Promise<CredentialsLogEntry[]> {
  const acc = await resolveAccess(ctx, engagementId);
  const rows = await db
    .select({
      id: auditEvents.id,
      at: auditEvents.createdAt,
      name: auditEvents.actorName,
      email: auditEvents.actorEmail,
      summary: auditEvents.summary,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.engagementId, acc.dbId),
        or(like(auditEvents.action, 'credentials.%'), eq(auditEvents.action, 'identifiers.reveal')),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(200);
  // clients never see staff e-mail addresses (security review M2)
  const who = (r: (typeof rows)[number]) => r.name?.trim() || (acc.staff ? r.email : null) || 'Someone';
  return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), text: `${who(r)} ${r.summary.replace(/[^\s<>()@,;:]+@[^\s<>()@,;:]+\.[a-z]{2,}/gi, acc.staff ? '$&' : 'a colleague')}` }));
}
