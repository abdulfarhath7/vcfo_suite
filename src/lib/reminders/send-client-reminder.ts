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
import { composeReminderEmail, composeStepOpenedEmail } from '@/lib/messages/message-emails';
import { ANNOUNCED_ON_OPEN_STEP_IDS } from '@/lib/checklist/step-opened';
import { clientIncorporationStepPath } from '@/lib/projects/project-step-path';
import { parseItemKey } from '@/lib/work/item-key';
import { draftView, withEdits, type ComposedEmail, type EmailDraftView, type EmailEdits } from '@/lib/email/email-edits';
import { recordEmailSent } from '@/lib/email/record-email-sent';
import type { EngagementParty } from '@/db/repositories/engagement-recipients';
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

/**
 * What the email says. `reminder` is the G-15 nudge; `step-opened` is the DR-03 email that the
 * Proposed directors step is open (only for the steps in `ANNOUNCED_ON_OPEN_STEP_IDS`).
 */
export type ReminderPurpose = 'reminder' | 'step-opened';

export interface ReminderInput {
  itemKey: string;
  note?: string | null;
  purpose?: ReminderPurpose;
}

/** The checklist step id behind a step item key (`step:<engagement>:<stepId>`), else null. */
function stepIdOf(itemKey: string): string | null {
  const ref = parseItemKey(itemKey);
  return ref?.kind === 'step' ? ref.stepId : null;
}

export type SendReminderResult =
  | { ok: true; channels: ReminderChannel[] }
  | { ok: false; status: 400 | 404 | 409 | 429 | 502 | 503; error: string; retryAt?: string };

type Prepared =
  | { ok: false; result: Extract<SendReminderResult, { ok: false }> }
  | { ok: true; target: Extract<Awaited<ReturnType<typeof resolveReminderTarget>>, { ok: true }>['target']; clients: EngagementParty[]; composed: ComposedEmail; note: string | null };

/** Scope, the 24-hour limit, the client contacts and the drafted email (GL-07: nothing sent yet). */
async function prepareReminder(
  ctx: AuthContext,
  engagementId: string,
  input: ReminderInput,
  now: Date,
): Promise<Prepared> {
  const resolved = await resolveReminderTarget(ctx, engagementId, input.itemKey);
  if (resolved.ok === false) {
    if (resolved.reason === 'step_locked') {
      // 409: the step is real but locked behind an earlier one, so the client owes nothing yet.
      return { ok: false, result: { ok: false, status: 409, error: `This step is not open yet. ${resolved.message}` } };
    }
    return {
      ok: false,
      result:
        resolved.reason === 'invalid_item'
          ? { ok: false, status: 400, error: 'This item cannot be reminded' }
          : { ok: false, status: 404, error: 'Engagement not found' },
    };
  }
  const target = resolved.target;
  const stepId = stepIdOf(target.itemKey);
  const stepOpened = input.purpose === 'step-opened';
  if (stepOpened && (!stepId || !ANNOUNCED_ON_OPEN_STEP_IDS.includes(stepId))) {
    return { ok: false, result: { ok: false, status: 400, error: 'This step has no opening email' } };
  }

  const last = await lastReminderWithinWindow(ctx, target, now);
  if (last) {
    return {
      ok: false,
      result: {
        ok: false,
        status: 429,
        error: 'A reminder for this item went out in the last 24 hours',
        retryAt: new Date(last.getTime() + REMINDER_WINDOW_MS).toISOString(),
      },
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
  if (clients.length === 0) return { ok: false, result: { ok: false, status: 400, error: 'No client email on this engagement' } };

  const note = input.note?.trim() || null;
  const to = clients.map((c) => c.email).filter((e): e is string => Boolean(e));
  const replyTo = formatReplyTo({ name: ctx.name, email: ctx.email });
  const composed =
    stepOpened && stepId
      ? composeStepOpenedEmail({
          companyName: target.companyName,
          itemTitle: target.itemTitle,
          senderName: ctx.name,
          note,
          stepHref: clientIncorporationStepPath(stepId),
          to,
          replyTo,
        })
      : composeReminderEmail({
          companyName: target.companyName,
          itemTitle: target.itemTitle,
          senderName: ctx.name,
          note,
          portalHref: target.clientPath,
          to,
          replyTo,
        });
  return { ok: true, target, clients, composed, note };
}

/** GL-07: the reminder as a draft for the "Send email" pop-up. */
export async function previewClientReminder(
  ctx: AuthContext,
  engagementId: string,
  input: ReminderInput,
  now: Date = new Date(),
): Promise<{ ok: true; draft: EmailDraftView } | Extract<SendReminderResult, { ok: false }>> {
  const prepared = await prepareReminder(ctx, engagementId, input, now);
  if (prepared.ok === false) return prepared.result;
  return { ok: true, draft: draftView(prepared.composed) };
}

/**
 * Send the reminder. With `edits` (the pop-up's Send), one email goes to the edited To and Cc
 * with the edited subject, message and attachments. Without them (the Ask approval card, which
 * is its own Send), each client contact gets the drafted email.
 */
export async function sendClientReminder(
  ctx: AuthContext,
  engagementId: string,
  input: ReminderInput,
  now: Date = new Date(),
  edits?: EmailEdits,
): Promise<SendReminderResult> {
  const prepared = await prepareReminder(ctx, engagementId, input, now);
  if (prepared.ok === false) return prepared.result;
  const { target, clients, composed, note } = prepared;

  const deliveries: ReminderDeliveryInput[] = [];
  let emailed = 0;
  let notConfigured = 0;
  const outgoing = edits
    ? [{ input: withEdits(composed, edits), parties: edits.to.map((addr) => ({ email: addr, userId: clients.find((c) => c.email?.toLowerCase() === addr.toLowerCase())?.userId ?? null })) }]
    : clients.map((party) => ({
        input: { ...withEdits(composed, { to: [party.email], cc: [], subject: composed.subject, message: composed.message, dropAttachments: [], addAttachments: [] }) },
        parties: [{ email: party.email, userId: party.userId }],
      }));
  for (const send of outgoing) {
    const result = await sendEmail(send.input).catch((err: unknown) => ({ ok: false as const, error: err instanceof Error ? err.message : 'send_failed' }));
    const skipped = 'skipped' in result && result.skipped === true;
    for (const party of send.parties) {
      if (result.ok) emailed += 1;
      if (skipped) notConfigured += 1;
      deliveries.push({
        recipientProfileId: party.userId,
        channel: 'email',
        toAddress: party.email,
        providerMessageId: 'providerMessageId' in result ? (result.providerMessageId ?? null) : null,
        status: result.ok ? 'sent' : skipped ? 'skipped' : 'failed',
        skipReason: skipped ? 'disabled' : null,
        errorCode: !result.ok && !skipped ? (('error' in result ? result.error : null) ?? 'send_failed').slice(0, 120) : null,
      });
    }
  }
  const sentTo = outgoing.flatMap((o) => o.parties.map((p) => p.email));

  if (emailed === 0) {
    await recordReminderDeliveries(ctx, target, deliveries);
    return notConfigured === sentTo.length
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
    summary: input.purpose === 'step-opened' ? `Emailed the client that ${target.itemTitle} is open` : `Reminded the client: ${target.itemTitle}`,
    metadata: { itemKey: target.itemKey, channels, note, recipients: emailed, purpose: input.purpose ?? 'reminder' },
  });
  // GL-07: who sent it, when (the row), to whom and the subject. A step reminder is filed under
  // the step id, the key the step page and the step cards read; other items keep their item key.
  const sentInput = outgoing[0]!.input;
  await recordEmailSent(ctx, {
    to: sentTo,
    cc: sentInput.cc ?? [],
    subject: sentInput.subject,
    engagementId: target.engagementDbId,
    itemId: stepIdOf(target.itemKey) ?? target.itemKey,
    via: 'firm',
  });

  return { ok: true, channels };
}
