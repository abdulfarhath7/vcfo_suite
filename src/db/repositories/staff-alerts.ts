import 'server-only';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagements, notificationPrefs, profiles } from '@/db/schema';
import { listManagerIdsForEngagement } from '@/db/repositories/engagement-managers-membership';
import type { WhatsAppGatePrefs } from '@/lib/notify/prefs-gate';
import { staffAlertOn, type StaffAlertKey } from '@/lib/notify/staff-alerts';

/**
 * STAFF ALERT RECIPIENTS — SYSTEM readers for the staff-alerts Inngest job (no session; the
 * request was queued by a write that had already passed its own scope check).
 *
 *   approval   — the managers of that one engagement (manager_id, or admin_id on a legacy
 *                row with no manager, plus co-managers in engagement_managers), active,
 *                role manager, with "Approvals waiting" on.
 *   escalation — the assignee when the escalation names one, else every admin and super
 *                admin; active, with "Escalations" on.
 * Each recipient comes with their quiet hours so the job can wait them out. Removed people
 * and people without an email address are left out.
 */

export interface AlertRecipient {
  profileId: string;
  email: string;
  name: string;
  role: string;
  quiet: Pick<WhatsAppGatePrefs, 'quietHours' | 'quietStart' | 'quietEnd' | 'tz'>;
}

async function recipientsByIds(ids: string[], roles: string[], key: StaffAlertKey): Promise<AlertRecipient[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const rows = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
      role: profiles.role,
      status: profiles.status,
      removedAt: profiles.removedAt,
      prefsEmail: notificationPrefs.email,
      quietHours: notificationPrefs.quietHours,
      quietStart: notificationPrefs.quietStart,
      quietEnd: notificationPrefs.quietEnd,
      tz: notificationPrefs.tz,
    })
    .from(profiles)
    .leftJoin(notificationPrefs, eq(notificationPrefs.profileId, profiles.id))
    .where(and(inArray(profiles.id, unique), eq(profiles.status, 'active'), isNull(profiles.removedAt)));
  return toRecipients(rows, roles, key);
}

type Row = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string | null;
  removedAt: Date | null;
  prefsEmail: Record<string, unknown> | null;
  quietHours: boolean | null;
  quietStart: string | null;
  quietEnd: string | null;
  tz: string | null;
};

/** The same rules again in code, so a loose WHERE can never widen the list. */
export function toRecipients(rows: Row[], roles: string[], key: StaffAlertKey): AlertRecipient[] {
  const out: AlertRecipient[] = [];
  for (const r of rows) {
    if (r.status !== 'active' || r.removedAt) continue;
    if (!roles.includes(r.role)) continue;
    if (!r.email?.trim()) continue;
    if (!staffAlertOn(r.prefsEmail, key)) continue;
    out.push({
      profileId: r.id,
      email: r.email,
      name: r.name?.trim() || r.email.split('@')[0] || 'there',
      role: r.role,
      // A person who never saved preferences gets the defaults the Profile shows.
      quiet: {
        quietHours: r.quietHours ?? true,
        quietStart: r.quietStart ?? '21:00',
        quietEnd: r.quietEnd ?? '08:00',
        tz: r.tz || 'Asia/Kolkata',
      },
    });
  }
  return out;
}

/** SYSTEM: the company name and the managers to alert for an approval on one engagement. */
export async function systemApprovalAlertRecipients(
  engagementDbId: string,
): Promise<{ companyName: string; recipients: AlertRecipient[] } | null> {
  const [eng] = await db
    .select({
      companyName: engagements.companyName,
      managerId: engagements.managerId,
      adminId: engagements.adminId,
      deletedAt: engagements.deletedAt,
    })
    .from(engagements)
    .where(eq(engagements.id, engagementDbId))
    .limit(1);
  if (!eng || eng.deletedAt) return null;
  const members = await listManagerIdsForEngagement(engagementDbId);
  const owner = eng.managerId ?? eng.adminId ?? null;
  const ids = [...(owner ? [owner] : []), ...members];
  return { companyName: eng.companyName, recipients: await recipientsByIds(ids, ['manager'], 'approvalsWaiting') };
}

/** SYSTEM: the company name and the admins to alert for an escalation. */
export async function systemEscalationAlertRecipients(
  engagementDbId: string,
  assignedTo: string | null,
): Promise<{ companyName: string; recipients: AlertRecipient[] } | null> {
  const [eng] = await db
    .select({ companyName: engagements.companyName, deletedAt: engagements.deletedAt })
    .from(engagements)
    .where(eq(engagements.id, engagementDbId))
    .limit(1);
  if (!eng || eng.deletedAt) return null;
  const roles = ['admin', 'super_admin'];
  let ids: string[];
  if (assignedTo) {
    ids = [assignedTo];
  } else {
    const rows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(inArray(profiles.role, ['admin', 'super_admin']), eq(profiles.status, 'active'), isNull(profiles.removedAt)));
    ids = rows.map((r) => r.id);
  }
  return { companyName: eng.companyName, recipients: await recipientsByIds(ids, roles, 'escalations') };
}
