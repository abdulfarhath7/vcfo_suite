import { z } from 'zod';
import { devAction } from '@/lib/dev/route-helpers';
import { sendEmailNoLog } from '@/lib/email/send-email';
import { maskEmail } from '@/lib/dev/mask';
import { getFailedEmailForDev, settleFailedEmailForDev } from '@/db/repositories/failed-emails';
import { recordAuditEvent } from '@/db/repositories/audit-events';

const Body = z.object({ id: z.string().uuid() });

/**
 * POST /api/dev/messages/retry { id }: send one failed mail again through the app's email
 * path (P-321). A mail that goes out is deleted from `failed_emails` (sent mail is never
 * kept); one that fails again counts the try. 404 when it is gone, 409 when it had
 * attachments (they are not kept), 503 when no email provider is set. Every try writes
 * `dev.message.retry` with the address masked. Developer or super admin.
 */
export async function POST(request: Request) {
  return devAction(request, Body, async (ctx, body) => {
    const mail = await getFailedEmailForDev(ctx, body.id);
    if (!mail) return { status: 404, body: { error: 'not_found' } };
    if (mail.hadAttachments) return { status: 409, body: { error: 'not_retryable' } };

    const res = await sendEmailNoLog({
      to: mail.to,
      cc: mail.cc,
      replyTo: mail.replyTo.length ? mail.replyTo : undefined,
      from: mail.from ?? undefined,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      purpose: mail.templateKey ?? 'dev.retry',
    });
    if (res.skipped) return { status: 503, body: { error: 'not_set_up' } };
    await settleFailedEmailForDev(ctx, mail.id, { ok: res.ok, error: res.error ?? null });
    const to = mail.to.map((a) => maskEmail(a)).join(', ');
    await recordAuditEvent(ctx, {
      action: 'dev.message.retry',
      summary: `Failed mail to ${to} ${res.ok ? 'sent again' : 'failed again'}`,
      metadata: { failedEmailId: mail.id, attempt: mail.attempts + 1, before: 'Failed', after: res.ok ? 'Sent' : 'Failed' },
      result: res.ok ? 'ok' : 'failed',
    });
    if (!res.ok) return { status: 502, body: { error: 'unreachable' } };
    return { status: 200, body: { ok: true } };
  });
}
