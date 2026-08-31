import { NextResponse } from 'next/server';
import {
  readWhatsAppConfig,
  stripWhatsAppPrefix,
} from '@/lib/notify/channels';
import { systemUpdateDeliveryByProviderId } from '@/db/repositories/notification-deliveries';
import { systemMarkWhatsAppStatus } from '@/db/repositories/profiles';
import { validateTwilioSignature, readTwilioForm } from '@/lib/notify/twilio-webhook';
import type { DeliveryStatus } from '@/lib/notify/types';

/**
 * Twilio message status callback.
 *
 * Signature-verified, unauthenticated. Every request is validated against
 * `X-Twilio-Signature`; unsigned or mismatched requests get 403 and are never
 * acted on.
 *
 * Outbound-only feature: this endpoint updates a delivery row and, on a hard
 * failure, marks the recipient's number so staff can see it. Nothing else.
 */

/** Twilio MessageStatus → our delivery status. */
function toDeliveryStatus(messageStatus: string): DeliveryStatus | null {
  switch (messageStatus.trim().toLowerCase()) {
    case 'queued':
    case 'accepted':
    case 'scheduled':
      return 'queued';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'failed':
    case 'undelivered':
      return 'failed';
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const config = readWhatsAppConfig();

  const form = await readTwilioForm(request);
  if (!form) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const valid = validateTwilioSignature({
    authToken: config.authToken,
    signature: request.headers.get('x-twilio-signature'),
    // Validate against the configured URL, not one reconstructed from headers:
    // behind a proxy the reconstructed host will not match what Twilio signed.
    url: config.statusCallbackUrl,
    params: form.params,
  });

  if (!valid) {
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 403 });
  }

  const messageSid = form.params.MessageSid ?? form.params.SmsSid ?? '';
  const status = toDeliveryStatus(form.params.MessageStatus ?? '');
  const errorCode = form.params.ErrorCode?.trim() || null;

  if (!messageSid || !status) {
    // Acknowledge — an unrecognised status is not a reason to make Twilio retry.
    return NextResponse.json({ ok: true });
  }

  await systemUpdateDeliveryByProviderId(messageSid, { status, errorCode });

  if (status === 'failed') {
    const to = stripWhatsAppPrefix(form.params.To);
    if (to) await systemMarkWhatsAppStatus(to, 'failed');
  } else if (status === 'delivered' || status === 'read') {
    const to = stripWhatsAppPrefix(form.params.To);
    if (to) await systemMarkWhatsAppStatus(to, 'verified');
  }

  return NextResponse.json({ ok: true });
}
