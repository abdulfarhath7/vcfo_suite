import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { sendEmail } from '@/lib/email/send-email';
import { formatFromWithSender, formatReplyTo } from '@/lib/email/send-email-shared';
import { recordEmailSent } from '@/lib/email/record-email-sent';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { publicErrorMessage } from '@/lib/api-error';

const bodySchema = z.object({
  to: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).optional(),
  subject: z.string().trim().min(1).max(500),
  text: z.string().max(20000),
  html: z.string().max(50000).optional(),
  engagementId: z.string().trim().max(100).optional(),
  itemId: z.string().trim().max(100).optional(),
  /** Files the person added in the pop-up (GL-07), as base64; at most 5 and 10 MB in all. */
  attachments: z
    .array(z.object({ name: z.string().trim().min(1).max(200), contentType: z.string().max(200).optional(), contentBase64: z.string().min(1).max(14_000_000) }))
    .max(5)
    .optional(),
});

const ATTACHMENTS_MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/email/send-draft (GL-07). The "Send email" pop-up sends here when the person has no
 * Outlook mailbox connected: the firm's address sends it with the person's name in From and
 * Reply-To, so nothing waits on Outlook. Every send, from here or from `/api/outlook/send`, is
 * recorded in the audit log with the sender, the time, the recipients and the subject.
 */
export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ ok: false, error: body.error }, { status: body.status });
  const { to, cc, subject, text, html, engagementId, itemId } = body.data;
  const attachments = (body.data.attachments ?? []).map((a) => ({
    filename: a.name,
    contentType: a.contentType || 'application/octet-stream',
    content: Uint8Array.from(Buffer.from(a.contentBase64, 'base64')),
  }));
  if (attachments.reduce((n, a) => n + a.content.byteLength, 0) > ATTACHMENTS_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'The attachments are larger than 10 MB in all.' }, { status: 413 });
  }

  if (engagementId) {
    const access = await assertEngagementAccess(guard.ctx, engagementId);
    if (!access.ok) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  try {
    const results = await Promise.all(
      to.map((addr) =>
        sendEmail({
          to: addr,
          ...(cc?.length ? { cc } : {}),
          from: formatFromWithSender(guard.ctx.name),
          replyTo: formatReplyTo({ name: guard.ctx.name, email: guard.ctx.email }),
          subject,
          html: html ?? `<div style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(text)}</div>`,
          text,
          purpose: 'manual.send-draft',
          ...(attachments.length ? { attachments } : {}),
        }),
      ),
    );
    const sent = to.filter((_, i) => results[i]?.ok);
    const failed = to.filter((_, i) => !results[i]?.ok);
    await recordEmailSent(guard.ctx, { to: sent, cc, subject, engagementId, itemId, via: 'firm' });
    if (sent.length === 0) return NextResponse.json({ ok: false, error: 'send_failed', failed }, { status: 502 });
    return NextResponse.json({ ok: true, sent, failed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: publicErrorMessage(err, 'send_failed') }, { status: 500 });
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
