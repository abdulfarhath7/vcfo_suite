import { NextResponse } from 'next/server';
import { fromMetaPhone, isOptOutKeyword } from '@/lib/notify/channels';
import { systemUpdateDeliveryByProviderId } from '@/db/repositories/notification-deliveries';
import {
  systemMarkWhatsAppStatus,
  systemRecordWhatsAppOptOut,
} from '@/db/repositories/profiles';
import {
  confirmSnsSubscription,
  verifySnsSignature,
  type SnsMessage,
} from '@/lib/notify/aws-sns-verify';
import { parseEumWebhookEvents } from '@/lib/notify/eum-events';

/**
 * AWS End User Messaging (Social) delivery events, via Amazon SNS.
 *
 * The EUM counterpart of the Twilio status + inbound webhooks, collapsed into
 * one route because SNS delivers both on the same topic.
 *
 * Unauthenticated by construction, so the SNS signature IS the authentication:
 * every request is verified against the AWS signing certificate before
 * anything is read from it, and an unverified request gets 403 without
 * touching the database.
 *
 * THIS IS NOT A CHAT ENDPOINT. WhatsApp is outbound-only here. Exactly three
 * behaviours:
 *   - confirm the subscription handshake so the topic can deliver at all
 *   - advance a delivery row by its wamid, and mark a number reachable or dead
 *   - stamp `whatsapp_opt_out_at` when an inbound message is an opt-out keyword
 *
 * No inbound message body is persisted, logged or echoed. Unrecognised events
 * are acknowledged with 200: making SNS retry a payload that will never parse
 * buys nothing.
 */
export async function POST(request: Request) {
  let envelope: SnsMessage;
  try {
    // SNS posts JSON with a text/plain content type, so parse the raw body.
    envelope = JSON.parse(await request.text()) as SnsMessage;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const verified = await verifySnsSignature(envelope);
  if (!verified) {
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 403 });
  }

  // Pin the topic when one is configured: a valid signature proves the message
  // came from SNS, not that it came from OUR topic.
  const expectedTopic = process.env.AWS_EUM_SNS_TOPIC_ARN?.trim();
  if (expectedTopic && envelope.TopicArn?.trim() !== expectedTopic) {
    return NextResponse.json({ ok: false, error: 'unexpected_topic' }, { status: 403 });
  }

  if (envelope.Type === 'SubscriptionConfirmation') {
    const confirmed = await confirmSnsSubscription(envelope.SubscribeURL);
    return NextResponse.json({ ok: confirmed });
  }

  if (envelope.Type !== 'Notification') {
    return NextResponse.json({ ok: true });
  }

  const { statuses, inbound } = parseEumWebhookEvents(envelope.Message, isOptOutKeyword);

  for (const event of statuses) {
    await systemUpdateDeliveryByProviderId(event.wamid, {
      status: event.status,
      errorCode: event.errorCode,
    });

    const phone = fromMetaPhone(event.recipientId);
    if (!phone) continue;
    if (event.status === 'failed') {
      await systemMarkWhatsAppStatus(phone, 'failed');
    } else if (event.status === 'delivered' || event.status === 'read') {
      await systemMarkWhatsAppStatus(phone, 'verified');
    }
  }

  for (const event of inbound) {
    if (!event.isOptOut) continue;
    const phone = fromMetaPhone(event.from);
    if (phone) await systemRecordWhatsAppOptOut(phone);
  }

  return NextResponse.json({ ok: true });
}
