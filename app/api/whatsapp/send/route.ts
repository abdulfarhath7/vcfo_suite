import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { getWhatsAppRecipientInScope } from '@/db/repositories/whatsapp-recipients';
import { systemGetNotifyRecipient } from '@/db/repositories/profiles';
import { systemRecordDelivery } from '@/db/repositories/notification-deliveries';
import { sendWhatsAppTemplate } from '@/lib/notify/send-whatsapp';
import { checkManualSend } from '@/lib/notify/manual-send';
import { isValidE164 } from '@/lib/notify/phone';

const COOLDOWN_MS = 15_000;
const lastSent = new Map<string, number>();

const bodySchema = z.object({
  recipientId: z.string().uuid(),
  event: z.string().trim().min(1).max(64),
  variables: z.record(z.string(), z.unknown()).optional(),
  engagementId: z.string().trim().max(128).optional().nullable(),
});

/**
 * POST /api/whatsapp/send — one approved template to one person, now (no
 * queue), from the console WhatsApp page. Same roles as Email. The person
 * must be in the sender's directory scope; number (E.164) and consent are
 * checked here and again by the dispatcher's guards. Every outcome — queued,
 * skipped, failed — is recorded in `notification_deliveries`, like
 * /api/account/whatsapp-test. Email is never touched.
 */
export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ ok: false, error: body.error }, { status: body.status });

  const check = checkManualSend(body.data.event, body.data.variables ?? {});
  if (check.ok === false) return NextResponse.json({ ok: false, error: check.error, field: check.field }, { status: 400 });

  const person = await getWhatsAppRecipientInScope(guard.ctx, body.data.recipientId);
  if (!person) return NextResponse.json({ ok: false, error: 'not_in_scope' }, { status: 403 });

  const recipient = await systemGetNotifyRecipient(person.userId);
  if (!recipient) return NextResponse.json({ ok: false, error: 'account_not_found' }, { status: 404 });
  if (!recipient.phoneE164 || !isValidE164(recipient.phoneE164)) {
    return NextResponse.json({ ok: false, status: 'skipped', reason: 'no_phone' }, { status: 409 });
  }
  if (!recipient.whatsappOptInAt) return NextResponse.json({ ok: false, status: 'skipped', reason: 'no_consent' }, { status: 409 });
  if (recipient.whatsappOptOutAt) return NextResponse.json({ ok: false, status: 'skipped', reason: 'opted_out' }, { status: 409 });

  const key = `${guard.ctx.userId}:${person.userId}`;
  if (Date.now() - (lastSent.get(key) ?? 0) < COOLDOWN_MS) {
    return NextResponse.json({ ok: false, error: 'too_soon' }, { status: 429 });
  }
  lastSent.set(key, Date.now());

  // the engagement the message is about: the one asked for when it is the person's, else their first
  const wanted = body.data.engagementId?.trim();
  const engagementId = person.projects.find((p) => p.id === wanted)?.id ?? person.projects[0]?.id ?? null;

  const result = await sendWhatsAppTemplate({ recipient, event: check.event, variables: check.variables });

  await systemRecordDelivery({
    engagementId,
    recipientProfileId: recipient.profileId,
    eventType: check.event,
    channel: 'whatsapp',
    toAddress: 'toPhone' in result ? (result.toPhone ?? null) : null,
    templateSid: 'templateRef' in result ? (result.templateRef ?? null) : null,
    providerMessageId: result.ok ? result.providerMessageId : null,
    status: result.status,
    skipReason: result.status === 'skipped' ? result.skipReason : null,
    errorCode: result.status === 'failed' ? (result.errorCode ?? null) : null,
    variables: check.variables,
  });

  if (result.ok) return NextResponse.json({ ok: true, status: result.status });
  return NextResponse.json({
    ok: false,
    status: result.status,
    reason: result.status === 'skipped' ? result.skipReason : undefined,
    error: result.status === 'failed' ? result.error : undefined,
    errorCode: result.status === 'failed' ? result.errorCode : undefined,
  });
}
