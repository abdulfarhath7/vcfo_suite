import { NextResponse } from 'next/server';
import { getEmailSettings } from '@/db/repositories/receivables';
import { getOwnProfile } from '@/db/repositories/profiles';
import { isValidE164 } from '@/lib/notify/phone';
import { isDoubleTickConfigured, readDoubleTickConfig, sendDoubleTickMessage } from '@/lib/notify/send-whatsapp-doubletick';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * POST /api/receivables/sheets/:id/whatsapp-test — "Send test message" on the People tab's
 * WhatsApp (DoubleTick) card, to the caller's own number. It uses the approved receivables template
 * (DOUBLETICK_TEMPLATE_RECEIVABLES_EMAIL_SENT), which WhatsApp delivers at any time, with words
 * that say it is only a test. Without a template it falls back to plain text, which WhatsApp
 * delivers only inside the 24 hours after the person last wrote to the firm's number.
 * A refusal answers 502 `whatsapp_failed` with DoubleTick's reason in `detail`.
 */
export async function POST(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    // Only someone who may open this sheet may send a test from its page.
    await getEmailSettings(guard.ctx, id);
    const config = readDoubleTickConfig();
    if (!isDoubleTickConfigured(config)) return NextResponse.json({ error: 'doubletick_not_configured' }, { status: 409 });
    const me = await getOwnProfile(guard.ctx);
    if (!me.phoneE164 || !isValidE164(me.phoneE164)) return NextResponse.json({ error: 'no_phone' }, { status: 409 });
    const res = await sendDoubleTickMessage({
      to: me.phoneE164,
      templateName: config.receivablesTemplate || null,
      // The template's four values: subject, name, address, link.
      variables: ['Test message (no email was sent)', me.name || 'you', me.email, 'nothing to open, this is a test'],
      text: 'Test from VCFO Suite receivables: WhatsApp messages about emails sent from your Outlook will reach this number.',
      config,
    });
    if (res.ok === false) console.warn('[receivables] WhatsApp test not sent', res.error);
    if (res.ok === false) return NextResponse.json({ error: 'whatsapp_failed', detail: res.error }, { status: 502 });
    return NextResponse.json({ ok: true, to: me.phoneE164 });
  } catch (e) {
    return receivablesError(e);
  }
}
