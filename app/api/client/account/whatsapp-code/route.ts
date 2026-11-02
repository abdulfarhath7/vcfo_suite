import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { checkWhatsAppVerifyCode, sendWhatsAppVerifyCode, whatsappCodeSetUp } from '@/db/repositories/client-whatsapp-verify';

/**
 * WhatsApp code step (C-868), Settings › Turn on WhatsApp.
 *
 * GET  /api/client/account/whatsapp-code → { setUp } — false when WhatsApp is off or
 *      `WHATSAPP_TEMPLATE_NAME_VERIFY_CODE` is not set; the dialog then skips the code step.
 * POST { action: 'send', phoneE164 } → { status: 'sent' | 'not_set_up' | 'invalid_phone' | 'too_many' | 'failed' }
 * POST { action: 'check', phoneE164, code } → { status: 'ok' | 'wrong' | 'expired' | 'locked' }
 * The caller's own codes only (`client-whatsapp-verify.ts`).
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ setUp: whatsappCodeSetUp() });
}

const phone = z.string().trim().min(8).max(20);
const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('send'), phoneE164: phone }),
  z.object({ action: z.literal('check'), phoneE164: phone, code: z.string().trim().min(1).max(12) }),
]);

export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const b = body.data;
  try {
    if (b.action === 'send') {
      const out = await sendWhatsAppVerifyCode(guard.ctx, b.phoneE164);
      const status = out.status === 'sent' ? 200 : out.status === 'too_many' ? 429 : out.status === 'invalid_phone' ? 400 : out.status === 'not_set_up' ? 409 : 502;
      return NextResponse.json(out, { status });
    }
    const out = await checkWhatsAppVerifyCode(guard.ctx, b.phoneE164, b.code);
    return NextResponse.json(out, { status: out.status === 'ok' ? 200 : 400 });
  } catch (err) {
    console.error('[api/client/account/whatsapp-code] failed', err);
    return NextResponse.json({ status: 'failed' }, { status: 500 });
  }
}
