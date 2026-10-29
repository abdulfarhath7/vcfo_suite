import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { outlookConnections, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { OutlookConnectionRow } from '@/lib/dev/types';
import { maskEmail } from '@/lib/dev/mask';
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
