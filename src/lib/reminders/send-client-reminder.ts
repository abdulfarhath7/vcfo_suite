import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  lastReminderWithinWindow,
  recordReminderDeliveries,
  REMINDER_AUDIT_ACTION,
  REMINDER_WINDOW_MS,
  resolveReminderTarget,
  type ReminderDeliveryInput,
} from '@/db/repositories/client-reminders';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { formatReplyTo, sendEmail } from '@/lib/email/send-email';
import { buildReminderEmail } from '@/lib/messages/message-emails';
import { queueWhatsAppSends } from '@/lib/notify/send-whatsapp';
import { firstNameOf } from '@/lib/notify/templates';
import { whatsappConsentOf } from '@/lib/reminders/reminder-rules';

/**
 * One-click "Remind" to the client (G-15), for `POST /api/engagements/:id/remind`.
 *
 * Order, as rule 6 of CLAUDE.md asks:
 *   1. scope and rate limit: the item must be on an engagement in the caller's scope, and
 *      only one reminder per item goes out in 24 hours;
 *   2. email to every client member through `sendEmail` (the system of record), one
 *      `notification_deliveries` row per address;
 *   3. WhatsApp after email, only for clients who opted in, on the background path that
 *      writes its own delivery row; a client who did not opt in gets a skipped row;
 *   4. an audit event, which is also what the rate limit reads.
 */

export type ReminderChannel = 'email' | 'whatsapp';

export type SendReminderResult =
  | { ok: true; channels: ReminderChannel[] }
  | { ok: false; status: 400 | 404 | 429 | 502 | 503; error: string; retryAt?: string };

export async function sendClientReminder(
  ctx: AuthContext,
  engagementId: string,
  input: { itemKey: string; note?: string | null },
  now: Date = new Date(),
): Promise<SendReminderResult> {
  const resolved = await resolveReminderTarget(ctx, engagementId, input.itemKey);
  if (resolved.ok === false) {
    return resolved.reason === 'invalid_item'
      ? { ok: false, status: 400, error: 'This item cannot be reminded' }
      : { ok: false, status: 404, error: 'Engagement not found' };
  }
  const target = resolved.target;

  const last = await lastReminderWithinWindow(ctx, target, now);
  if (last) {
    return {
      ok: false,
      status: 429,
      error: 'A reminder for this item went out in the last 24 hours',
      retryAt: new Date(last.getTime() + REMINDER_WINDOW_MS).toISOString(),
    };
  }

  const recipients = await resolveEngagementRecipients(target.engagementDbId);
  const clients = recipients
    ? recipients.clients.length > 0
      ? recipients.clients
      : recipients.client
        ? [recipients.client]
        : []
    : [];
  if (clients.length === 0) return { ok: false, status: 400, error: 'No client email on this engagement' };

  const note = input.note?.trim() || null;
  const copy = buildReminderEmail({
    companyName: target.companyName,
    itemTitle: target.itemTitle,
    senderName: ctx.name,
    note,
    portalHref: target.clientPath,
  });

  const deliveries: ReminderDeliveryInput[] = [];
  let emailed = 0;
  let notConfigured = 0;
  for (const party of clients) {
    const result = await sendEmail({
      to: party.email,
      replyTo: formatReplyTo({ name: ctx.name, email: ctx.email }),
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      purpose: 'reminder.client',
    }).catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : 'send_failed' }));
    const skipped = 'skipped' in result && result.skipped === true;
    if (result.ok) emailed += 1;
    if (skipped) notConfigured += 1;
    deliveries.push({
      recipientProfileId: party.userId,
      channel: 'email',
      toAddress: party.email,
      providerMessageId: 'providerMessageId' in result ? (result.providerMessageId ?? null) : null,
      status: result.ok ? 'sent' : skipped ? 'skipped' : 'failed',
      skipReason: skipped ? 'disabled' : null,
      errorCode: !result.ok && !skipped ? (result.error ?? 'send_failed').slice(0, 120) : null,
    });
  }

  if (emailed === 0) {
    await recordReminderDeliveries(ctx, target, deliveries);
    return notConfigured === clients.length
      ? { ok: false, status: 503, error: 'Email is not set up' }
      : { ok: false, status: 502, error: 'The reminder email could not be sent' };
  }

  // WhatsApp is additive: queued after email, never awaited for delivery, never fatal.
  const optedIn = clients.filter((party) => whatsappConsentOf(party) === 'opted_in');
  for (const party of clients) {
    const consent = whatsappConsentOf(party);
    if (consent === 'opted_in') continue;
    deliveries.push({
      recipientProfileId: party.userId,
      channel: 'whatsapp',
      toAddress: null,
      status: 'skipped',
      skipReason: consent,
    });
  }
  await recordReminderDeliveries(ctx, target, deliveries);

  const day = now.toISOString().slice(0, 10);
  if (optedIn.length > 0) {
    await queueWhatsAppSends(
      optedIn.map((party) => ({
        engagementId: target.engagementId,
        recipientProfileId: party.userId,
        event: 'client_reminder' as const,
        variables: {
          firstName: firstNameOf(party.name),
          companyName: target.companyName,
          stepTitle: target.itemTitle,
        },
        dedupeId: `reminder:${target.engagementDbId}:${target.itemKey}:${party.userId}:${day}`,
      })),
    );
  }

  const channels: ReminderChannel[] = optedIn.length > 0 ? ['email', 'whatsapp'] : ['email'];
  await recordAuditEvent(ctx, {
    engagementId: target.engagementDbId,
    action: REMINDER_AUDIT_ACTION,
    summary: `Reminded the client: ${target.itemTitle}`,
    metadata: { itemKey: target.itemKey, channels, note, recipients: emailed },
  });

  return { ok: true, channels };
}
