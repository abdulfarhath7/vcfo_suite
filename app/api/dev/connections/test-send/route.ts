import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { sendEmailNoLog as sendEmail } from '@/lib/email/send-email';
import { maskEmail } from '@/lib/dev/mask';
import { recordAuditEvent } from '@/db/repositories/audit-events';

const Body = z.object({ to: z.string().trim().email().max(200) });

/**
 * POST /api/dev/connections/test-send: "Send a test" on the Email connection. Sends one plain
 * test mail through the app's own email path (Resend or SES) to the address given, and writes
 * a `dev.connection.test_send` audit row with the address masked. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const res = await sendEmail({
      to: body.to,
      subject: 'VCFO Suite test mail',
      text: `This is a test mail from the VCFO Suite developer console, sent by ${ctx.name || 'a developer'}.`,
      html: `<p>This is a test mail from the VCFO Suite developer console, sent by ${escapeHtml(ctx.name || 'a developer')}.</p>`,
      purpose: 'dev.test_send',
    });
    const ok = res.ok === true;
    await recordAuditEvent(ctx, {
      action: 'dev.connection.test_send',
      summary: `Test mail ${ok ? 'sent' : 'not sent'} to ${maskEmail(body.to)}`,
      metadata: { service: 'email', to: maskEmail(body.to) },
      result: ok ? 'ok' : 'failed',
    });
    if (res.skipped) return { status: 503, body: { error: 'not_set_up' } };
    if (!ok) return { status: 502, body: { error: 'unreachable' } };
    return { status: 200, body: { ok: true } };
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
