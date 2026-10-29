import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { outlookConnections, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { OutlookConnectionRow } from '@/lib/dev/types';
import { maskEmail } from '@/lib/dev/mask';
import { recordAuditEvent } from './audit-events';
import { assertDeveloper, isStaffRole } from './dev-scope';

/**
 * DEV CONNECTIONS — who has linked an Outlook mailbox, and when its token expires (G-01).
 *
 * Access: developer or super admin only (`assertDeveloper`). The token columns are never
 * selected. A staff member is shown by name and mailbox; a client owner (not expected, but
 * possible) is shown as "Client" with the mailbox masked.
 */
export async function listOutlookConnectionsForDev(ctx: AuthContext): Promise<OutlookConnectionRow[]> {
  assertDeveloper(ctx);
  const rows = await db
    .select({
      id: outlookConnections.id,
      msEmail: outlookConnections.msEmail,
      expiresAt: outlookConnections.expiresAt,
      signatureEnabled: outlookConnections.signatureEnabled,
      createdAt: outlookConnections.createdAt,
      updatedAt: outlookConnections.updatedAt,
      name: profiles.name,
      email: profiles.email,
      role: profiles.role,
    })
    .from(outlookConnections)
    .leftJoin(profiles, eq(profiles.id, outlookConnections.userId))
    .orderBy(desc(outlookConnections.updatedAt))
    .limit(500);

  return rows.map((r) => {
    const staff = isStaffRole(String(r.role ?? ''));
    return {
      id: r.id,
      person: staff ? r.name?.trim() || r.email?.split('@')[0] || 'Staff' : 'Client',
      role: String(r.role ?? 'unknown'),
      mailbox: staff ? r.msEmail : maskEmail(r.msEmail),
      expiresAt: r.expiresAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      connectedAt: r.createdAt.toISOString(),
      signatureEnabled: r.signatureEnabled,
    };
  });
}

/**
 * Disconnect one linked Outlook mailbox from the console (R-40). It deletes the link row, so
 * the stored tokens go with it and mail from the app stops leaving that mailbox until the
 * person connects again from their own Profile. Writes a `dev.outlook.disconnect` audit row
 * with the person (staff by name, a client only as "Client") and the before and after state.
 * Returns null when the link is already gone.
 */
export async function disconnectOutlookForDev(ctx: AuthContext, id: string): Promise<{ person: string } | null> {
  assertDeveloper(ctx);
  const [row] = await db
    .select({ id: outlookConnections.id, name: profiles.name, email: profiles.email, role: profiles.role })
    .from(outlookConnections)
    .leftJoin(profiles, eq(profiles.id, outlookConnections.userId))
    .where(eq(outlookConnections.id, id))
    .limit(1);
  if (!row) return null;

  const deleted = await db.delete(outlookConnections).where(eq(outlookConnections.id, id)).returning({ id: outlookConnections.id });
  if (deleted.length === 0) return null;

  const staff = isStaffRole(String(row.role ?? ''));
  const person = staff ? row.name?.trim() || row.email?.split('@')[0] || 'Staff' : 'Client';
  await recordAuditEvent(ctx, {
    action: 'dev.outlook.disconnect',
    summary: `Outlook mailbox disconnected for ${person}`,
    metadata: { connectionId: id, before: 'Connected', after: 'Not connected' },
  });
  return { person };
}
