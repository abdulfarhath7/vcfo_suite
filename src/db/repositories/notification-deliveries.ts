import 'server-only';

import { desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagements, notificationDeliveries, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { managerOwnsEngagement } from '@/db/repositories/engagements';
import { listLeadMemberEngagementIds } from '@/db/repositories/engagement-leads-membership';
import type {
  DeliveryStatus,
  NotifyChannel,
  NotifyEvent,
  SkipReason,
} from '@/lib/notify/types';

/**
 * NOTIFICATION DELIVERIES REPOSITORY.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   admin / super_admin — firm-wide
 *   manager            — deliveries on engagements they own or co-manage
 *   intern             — deliveries on engagements they lead
 *   client             — none (this is a staff diagnostic surface)
 *
 * >>> SYSTEM WRITERS (documented deviation) <<<
 * `systemRecordDelivery` and `systemUpdateDeliveryByProviderId` take no
 * AuthContext. They exist because their callers have no session:
 *   - the Inngest WhatsApp job (background, post-response)
 *   - the Twilio status webhook (unauthenticated, signature-verified only)
 * Both are narrow single-row writes keyed by an id we already hold. They live
 * here, beside their AuthContext siblings, so the deviation stays visible.
 * Every UI read goes through the scoped functions.
 */

export type NotificationDeliveryRow = typeof notificationDeliveries.$inferSelect;

export type RecordDeliveryInput = {
  engagementId?: string | null;
  recipientProfileId?: string | null;
  eventType: NotifyEvent;
  channel: NotifyChannel;
  toAddress?: string | null;
  templateSid?: string | null;
  providerMessageId?: string | null;
  status: DeliveryStatus;
  skipReason?: SkipReason | null;
  errorCode?: string | null;
};

/** Resolve slug/legacy id → engagements.id, tolerating an already-resolved uuid. */
async function resolveEngagementDbId(
  engagementId: string | null | undefined,
): Promise<string | null> {
  const raw = engagementId?.trim();
  if (!raw) return null;
  try {
    return (await engagementDbId(raw)) ?? null;
  } catch {
    return null;
  }
}

function toRowValues(input: RecordDeliveryInput, dbEngagementId: string | null) {
  return {
    engagementId: dbEngagementId,
    recipientProfileId: input.recipientProfileId?.trim() || null,
    eventType: input.eventType,
    channel: input.channel,
    toAddress: input.toAddress?.trim() || null,
    templateSid: input.templateSid?.trim() || null,
    providerMessageId: input.providerMessageId?.trim() || null,
    status: input.status,
    skipReason: input.skipReason ?? null,
    errorCode: input.errorCode?.trim() || null,
  };
}

/**
 * Record one attempt (send OR skip) from a request path that has a session.
 * Never throws — a delivery-log failure must not fail the mutation that
 * triggered the notification.
 */
export async function createDelivery(
  ctx: AuthContext,
  input: RecordDeliveryInput,
): Promise<NotificationDeliveryRow | null> {
  if (ctx.role === 'client') return null;
  return systemRecordDelivery(input);
}

/**
 * SYSTEM WRITER — background jobs. See the header note.
 * Never throws; returns null when the row could not be written.
 */
export async function systemRecordDelivery(
  input: RecordDeliveryInput,
): Promise<NotificationDeliveryRow | null> {
  try {
    const dbEngagementId = await resolveEngagementDbId(input.engagementId);
    const [row] = await db
      .insert(notificationDeliveries)
      .values(toRowValues(input, dbEngagementId))
      .returning();
    return row ?? null;
  } catch (err) {
    console.error('[notification-deliveries] record failed', input.eventType, err);
    return null;
  }
}

/**
 * SYSTEM WRITER — Twilio status webhook. See the header note.
 * Keyed by the opaque provider message id; no engagement scope is available
 * or needed. Never throws.
 */
export async function systemUpdateDeliveryByProviderId(
  providerMessageId: string,
  patch: {
    status?: DeliveryStatus;
    errorCode?: string | null;
  },
): Promise<NotificationDeliveryRow | null> {
  const sid = providerMessageId.trim();
  if (!sid) return null;

  try {
    const [row] = await db
      .update(notificationDeliveries)
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
        updatedAt: new Date(),
      })
      .where(eq(notificationDeliveries.providerMessageId, sid))
      .returning();
    return row ?? null;
  } catch (err) {
    console.error('[notification-deliveries] status update failed', sid, err);
    return null;
  }
}

/** Engagement ids this staff member may read deliveries for. */
async function readableEngagementIds(ctx: AuthContext): Promise<string[] | 'all'> {
  if (isFirmWideAdmin(ctx.role)) return 'all';

  if (ctx.role === 'manager') {
    const rows = await db
      .select({ id: engagements.id })
      .from(engagements)
      .where(managerOwnsEngagement(ctx.userId));
    return rows.map((r) => r.id);
  }

  if (ctx.role === 'intern') {
    if (!ctx.internId) return [];
    const memberIds = await listLeadMemberEngagementIds(ctx.internId);
    const rows = await db
      .select({ id: engagements.id })
      .from(engagements)
      .where(
        memberIds.length > 0
          ? or(eq(engagements.internId, ctx.internId), inArray(engagements.id, memberIds))
          : eq(engagements.internId, ctx.internId),
      );
    return rows.map((r) => r.id);
  }

  // Clients do not see the delivery log.
  return [];
}

export type NotificationDeliveryView = {
  id: string;
  eventType: string;
  channel: string;
  status: string;
  skipReason: string | null;
  errorCode: string | null;
  toAddress: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  createdAt: string;
};

const DELIVERY_LIST_LIMIT = 50;

/**
 * Recent deliveries for one engagement, newest first.
 * Cross-tenant safe: a manager asking for another firm's engagement gets [].
 */
export async function listDeliveriesByEngagement(
  ctx: AuthContext,
  engagementId: string,
  limit: number = DELIVERY_LIST_LIMIT,
): Promise<NotificationDeliveryView[]> {
  const dbId = await resolveEngagementDbId(engagementId);
  if (!dbId) return [];

  const scope = await readableEngagementIds(ctx);
  if (scope !== 'all' && !scope.includes(dbId)) return [];

  const rows = await db
    .select({
      delivery: notificationDeliveries,
      recipientName: profiles.name,
      recipientEmail: profiles.email,
    })
    .from(notificationDeliveries)
    .leftJoin(profiles, eq(profiles.id, notificationDeliveries.recipientProfileId))
    .where(eq(notificationDeliveries.engagementId, dbId))
    .orderBy(desc(notificationDeliveries.createdAt))
    .limit(Math.min(Math.max(limit, 1), DELIVERY_LIST_LIMIT));

  return rows.map((r) => ({
    id: r.delivery.id,
    eventType: r.delivery.eventType,
    channel: r.delivery.channel,
    status: r.delivery.status,
    skipReason: r.delivery.skipReason,
    errorCode: r.delivery.errorCode,
    toAddress: r.delivery.toAddress,
    recipientName: r.recipientName,
    recipientEmail: r.recipientEmail,
    createdAt: r.delivery.createdAt.toISOString(),
  }));
}
