import 'server-only';
import { and, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { emailSendLog, notificationDeliveries } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { DeliveryRow, EmailLogRow, MessagesPayload } from '@/lib/dev/types';
import { maskAddress } from '@/lib/dev/mask';
import { assertDeveloper } from './dev-scope';

/**
 * DEV MESSAGES — the outbound message log for the developer console (G-01).
 *
 * Access: developer or super admin only. Firm-wide, but nothing that names a client leaves
 * this file: recipient addresses are masked (first letter and domain, or the last digits of a
 * phone), and the engagement id, recipient profile and template body are not selected.
 */

export interface DevMessagesOptions {
  channel?: 'email' | 'whatsapp';
  status?: string;
  /** Keyset cursor: rows strictly older than this. */
  deliveriesBefore?: Date;
  emailsBefore?: Date;
  limit?: number;
  /** Which lists to read; both by default. */
  only?: 'deliveries' | 'emails';
}

export async function listDeliveriesForDev(ctx: AuthContext, opts: DevMessagesOptions = {}): Promise<DeliveryRow[]> {
  assertDeveloper(ctx);
  const conds: SQL[] = [];
  if (opts.channel) conds.push(eq(notificationDeliveries.channel, opts.channel));
  if (opts.status) conds.push(eq(notificationDeliveries.status, opts.status));
  if (opts.deliveriesBefore) conds.push(lt(notificationDeliveries.createdAt, opts.deliveriesBefore));
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  const rows = await db
    .select({
      id: notificationDeliveries.id,
      createdAt: notificationDeliveries.createdAt,
      eventType: notificationDeliveries.eventType,
      channel: notificationDeliveries.channel,
      status: notificationDeliveries.status,
      skipReason: notificationDeliveries.skipReason,
      errorCode: notificationDeliveries.errorCode,
      toAddress: notificationDeliveries.toAddress,
    })
    .from(notificationDeliveries)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(notificationDeliveries.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    event: r.eventType,
    channel: r.channel,
    status: r.status,
    skipReason: r.skipReason,
    errorCode: r.errorCode,
    to: maskAddress(r.toAddress),
  }));
}

export async function listEmailLogForDev(ctx: AuthContext, opts: DevMessagesOptions = {}): Promise<EmailLogRow[]> {
  assertDeveloper(ctx);
  const conds: SQL[] = [];
  if (opts.status) conds.push(eq(emailSendLog.status, opts.status));
  if (opts.emailsBefore) conds.push(lt(emailSendLog.createdAt, opts.emailsBefore));
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  const rows = await db
    .select({
      id: emailSendLog.id,
      createdAt: emailSendLog.createdAt,
      triggerEvent: emailSendLog.triggerEvent,
      checklistItemId: emailSendLog.checklistItemId,
      status: emailSendLog.status,
      reason: emailSendLog.reason,
    })
    .from(emailSendLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(emailSendLog.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    event: r.triggerEvent,
    item: r.checklistItemId,
    status: r.status,
    reason: r.reason,
  }));
}

/** Sent, failed and skipped in the last 24 hours, across both logs. */
export async function messageCounts24h(ctx: AuthContext): Promise<MessagesPayload['counts24h']> {
  assertDeveloper(ctx);
  const since = new Date(Date.now() - 86400000);
  const bucket = (col: typeof notificationDeliveries.status | typeof emailSendLog.status) =>
    sql<string>`case when ${col} in ('sent','delivered','read') then 'sent' when ${col} = 'failed' then 'failed' when ${col} = 'skipped' then 'skipped' else 'other' end`;

  const [deliveries, emails] = await Promise.all([
    db
      .select({ bucket: bucket(notificationDeliveries.status), n: sql<number>`count(*)::int` })
      .from(notificationDeliveries)
      .where(gte(notificationDeliveries.createdAt, since))
      .groupBy(bucket(notificationDeliveries.status)),
    db
      .select({ bucket: bucket(emailSendLog.status), n: sql<number>`count(*)::int` })
      .from(emailSendLog)
      .where(gte(emailSendLog.createdAt, since))
      .groupBy(bucket(emailSendLog.status)),
  ]);

  const out = { sent: 0, failed: 0, skipped: 0 };
  for (const r of [...deliveries, ...emails]) {
    if (r.bucket === 'sent' || r.bucket === 'failed' || r.bucket === 'skipped') out[r.bucket] += Number(r.n) || 0;
  }
  return out;
}

export async function listMessagesForDev(ctx: AuthContext, opts: DevMessagesOptions = {}): Promise<MessagesPayload> {
  assertDeveloper(ctx);
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const [deliveries, emails, counts24h] = await Promise.all([
    opts.only === 'emails' ? Promise.resolve([]) : listDeliveriesForDev(ctx, { ...opts, limit }),
    opts.only === 'deliveries' || opts.channel === 'whatsapp' ? Promise.resolve([]) : listEmailLogForDev(ctx, { ...opts, limit }),
    messageCounts24h(ctx),
  ]);
  return {
    deliveries,
    emails,
    nextBefore: {
      deliveries: deliveries.length === limit ? (deliveries.at(-1)?.createdAt ?? null) : null,
      emails: emails.length === limit ? (emails.at(-1)?.createdAt ?? null) : null,
    },
    counts24h,
  };
}
