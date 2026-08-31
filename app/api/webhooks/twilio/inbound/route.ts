import { NextResponse } from 'next/server';
import {
  isOptOutKeyword,
  readWhatsAppConfig,
  stripWhatsAppPrefix,
} from '@/lib/notify/channels';
import { systemRecordWhatsAppOptOut } from '@/db/repositories/profiles';
import { readTwilioForm, validateTwilioSignature } from '@/lib/notify/twilio-webhook';

/**
 * Twilio inbound webhook.
 *
 * THIS IS NOT A CHAT ENDPOINT. WhatsApp is outbound-only here: we never read,
 * route, thread or reply to a conversation, and no inbound message body is
 * ever persisted or shown in the app.
 *
 * Exactly two behaviours:
 *   - an opt-out keyword (STOP, UNSUBSCRIBE, …) stamps `whatsapp_opt_out_at`
 *     on the matching profile, which the send guards then honour
 *   - everything else is acknowledged with 200 and discarded
 *
 * Signature-verified; unsigned requests get 403 and are never acted on.
 */
export async function POST(request: Request) {
  const config = readWhatsAppConfig();

  const form = await readTwilioForm(request);
  if (!form) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const valid = validateTwilioSignature({
    authToken: config.authToken,
    signature: request.headers.get('x-twilio-signature'),
    // The inbound path is not the status path, so it has its own configured URL.
    url: config.inboundCallbackUrl,
    params: form.params,
  });

  if (!valid) {
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 403 });
  }

  const from = stripWhatsAppPrefix(form.params.From);
  const body = form.params.Body;

  if (from && isOptOutKeyword(body)) {
    await systemRecordWhatsAppOptOut(from);
  }

  // Body is deliberately not logged, stored, or echoed anywhere.
  return NextResponse.json({ ok: true });
}
