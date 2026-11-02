import 'server-only';
import { and, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { emailSendLog, emailTemplates, firmSettings, notificationDeliveries } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { DeliveryRow, EmailLogRow, EmailTemplateRow, MessageRouteRow, MessagesPayload } from '@/lib/dev/types';
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
      templateSid: notificationDeliveries.templateSid,
      updatedAt: notificationDeliveries.updatedAt,
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
    template: r.templateSid ?? null,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
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

/**
 * Delivery rows per status (all time) for the channel filter, for the status tab counts on
 * the Messages page. The tabs filter the delivery grid, so the checklist mail log is not counted.
 */
export async function deliveryStatusCountsForDev(ctx: AuthContext, channel?: 'email' | 'whatsapp'): Promise<Record<string, number>> {
  assertDeveloper(ctx);
  const rows = await db
    .select({ status: notificationDeliveries.status, n: sql<number>`count(*)::int` })
    .from(notificationDeliveries)
    .where(channel ? eq(notificationDeliveries.channel, channel) : undefined)
    .groupBy(notificationDeliveries.status);
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.status)] = Number(r.n) || 0;
  return out;
}

/**
 * Message routes: each event on each channel with its 7-day numbers from the delivery log
 * and the template it last used. Pass the event list from the code, so a route that has
 * sent nothing yet still shows with zeros.
 */
export async function messageRoutesForDev(
  ctx: AuthContext,
  routes: Array<{ event: string; channel: 'email' | 'whatsapp'; template: string | null }>,
  now = new Date(),
): Promise<MessageRouteRow[]> {
  assertDeveloper(ctx);
  const since = new Date(now.getTime() - 7 * 86400000);
  const rows = await db
    .select({
      event: notificationDeliveries.eventType,
      channel: notificationDeliveries.channel,
      sent: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('sent','delivered','read'))::int`,
      delivered: sql<number>`count(*) filter (where ${notificationDeliveries.status} in ('delivered','read'))::int`,
      failed: sql<number>`count(*) filter (where ${notificationDeliveries.status} = 'failed')::int`,
    })
    .from(notificationDeliveries)
    .where(gte(notificationDeliveries.createdAt, since))
    .groupBy(notificationDeliveries.eventType, notificationDeliveries.channel);
  const key = (e: string, c: string) => `${e}|${c}`;
  const counts = new Map(rows.map((r) => [key(r.event, r.channel), r]));
  return routes.map((r) => {
    const c = counts.get(key(r.event, r.channel));
    return {
      event: r.event,
      channel: r.channel,
      template: r.template,
      sent7d: Number(c?.sent ?? 0),
      delivered7d: Number(c?.delivered ?? 0),
      failed7d: Number(c?.failed ?? 0),
    };
  });
}

/** Failed deliveries in the last 24 hours, grouped by channel and error code. */
export async function failureCausesForDev(ctx: AuthContext, now = new Date()): Promise<Array<{ channel: string; cause: string; count: number }>> {
  assertDeveloper(ctx);
  const since = new Date(now.getTime() - 86400000);
  const cause = sql<string>`coalesce(${notificationDeliveries.errorCode}, 'no_code')`;
  const rows = await db
    .select({ channel: notificationDeliveries.channel, cause, n: sql<number>`count(*)::int` })
    .from(notificationDeliveries)
    .where(and(eq(notificationDeliveries.status, 'failed'), gte(notificationDeliveries.createdAt, since)))
    .groupBy(notificationDeliveries.channel, cause);
  return rows.map((r) => ({ channel: r.channel, cause: r.cause, count: Number(r.n) || 0 })).sort((a, b) => b.count - a.count);
}


/** The step mail templates with their last use and 7-day sends from the checklist mail log. */
export async function emailTemplatesForDev(ctx: AuthContext, now = new Date()): Promise<EmailTemplateRow[]> {
  assertDeveloper(ctx);
  const since = new Date(now.getTime() - 7 * 86400000);
  const usage = db
    .select({
      templateId: emailSendLog.templateId,
      last: sql<Date>`max(${emailSendLog.createdAt})`.as('last'),
      sent: sql<number>`count(*) filter (where ${emailSendLog.status} = 'sent' and ${emailSendLog.createdAt} >= ${since})::int`.as('sent'),
    })
    .from(emailSendLog)
    .groupBy(emailSendLog.templateId)
    .as('usage');
  const rows = await db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      active: emailTemplates.isActive,
      updatedAt: emailTemplates.updatedAt,
      last: usage.last,
      sent: usage.sent,
    })
    .from(emailTemplates)
    .leftJoin(usage, eq(usage.templateId, emailTemplates.id))
    .orderBy(emailTemplates.name)
    .limit(300);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    active: r.active,
    updatedAt: r.updatedAt.toISOString(),
    lastUsed: r.last ? new Date(r.last).toISOString() : null,
    sent7d: Number(r.sent ?? 0),
  }));
}

/** The firm's reminder days and time zone, for the read-only Timing card. */
export async function messageTimingForDev(ctx: AuthContext): Promise<{ reminderDays: number[]; timezone: string }> {
  assertDeveloper(ctx);
  const [row] = await db.select({ reminderDays: firmSettings.reminderDays, timezone: firmSettings.timezone }).from(firmSettings).limit(1);
  return {
    reminderDays: Array.isArray(row?.reminderDays) ? row.reminderDays : [7, 3, 1],
    timezone: row?.timezone || 'Asia/Kolkata',
  };
}
