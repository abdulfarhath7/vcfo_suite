import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { systemGetNotifyRecipient } from '@/db/repositories/profiles';
import { systemRecordDelivery } from '@/db/repositories/notification-deliveries';
import { sendWhatsAppTemplate } from '@/lib/notify/send-whatsapp';

const COOLDOWN_MS = 30_000;
const lastSentAt = new Map<string, number>();

/**
 * POST /api/account/whatsapp-test — send one test notice to the caller's own
 * WhatsApp number, straight away (no background queue), and report the outcome.
 * Same guards as every real notice: number, consent, opt-out, configuration.
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const userId = auth.ctx.userId;
  const last = lastSentAt.get(userId) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) {
    return NextResponse.json({ ok: false, error: 'too_soon' }, { status: 429 });
  }

  const recipient = await systemGetNotifyRecipient(userId);
  if (!recipient) {
    return NextResponse.json({ ok: false, error: 'account_not_found' }, { status: 404 });
  }

  lastSentAt.set(userId, Date.now());
  const result = await sendWhatsAppTemplate({
    recipient,
    event: 'process_notice',
    variables: {
      companyName: 'VCFO Suite',
      stepTitle: 'test message — WhatsApp updates are working',
      firstName: recipient.name.split(' ')[0],
    },
  });

  await systemRecordDelivery({
    engagementId: null,
    recipientProfileId: recipient.profileId,
    eventType: 'process_notice',
    channel: 'whatsapp',
    toAddress: 'toPhone' in result ? (result.toPhone ?? null) : null,
    templateSid: 'templateRef' in result ? (result.templateRef ?? null) : null,
    providerMessageId: result.ok ? result.providerMessageId : null,
    status: result.status,
    skipReason: result.status === 'skipped' ? result.skipReason : null,
    errorCode: result.status === 'failed' ? (result.errorCode ?? null) : null,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, status: result.status });
  }
  return NextResponse.json({
    ok: false,
    status: result.status,
    reason: result.status === 'skipped' ? result.skipReason : undefined,
    error: result.status === 'failed' ? result.error : undefined,
    errorCode: result.status === 'failed' ? result.errorCode : undefined,
  });
}
