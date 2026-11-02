import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listWhatsAppRecipients } from '@/db/repositories/whatsapp-recipients';
import { isWhatsAppConfigured, readWhatsAppConfig } from '@/lib/notify/channels';

/**
 * GET /api/whatsapp/recipients — who the console WhatsApp page may message
 * (the Email page's directory scope) with each person's WhatsApp state, and
 * whether WhatsApp can send from this server at all (`configured`).
 */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const people = await listWhatsAppRecipients(guard.ctx);
    const canRetry = guard.ctx.role !== 'intern';
    return NextResponse.json({ configured: isWhatsAppConfigured(readWhatsAppConfig()), canRetry, people });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'recipients_failed';
    return NextResponse.json({ error: message }, { status: message.includes('not permitted') ? 403 : 500 });
  }
}
