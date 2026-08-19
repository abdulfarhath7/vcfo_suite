import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { sendMailViaOutlook } from '@/db/repositories/outlook-connections';
import { getEmailTemplate } from '@/db/repositories/email-templates';
import { wrapComposeBodyHtml, type EmailBranding } from '@/lib/email/compose-branding';

const bodySchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  subject: z.string().trim().min(1).max(500),
  text: z.string().max(20000).optional(),
  html: z.string().max(50000).optional(),
  branding: z.enum(['sbc', 'plain']).optional(),
  templateId: z.string().uuid().optional(),
});

/** POST /api/outlook/send — Graph Mail.Send from the linked mailbox. */
export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const to = Array.isArray(body.data.to) ? body.data.to : [body.data.to];
  const ccRaw = body.data.cc;
  const cc = ccRaw ? (Array.isArray(ccRaw) ? ccRaw : [ccRaw]) : [];
  const text = body.data.text?.trim() ?? '';
  let branding: EmailBranding = body.data.branding ?? 'plain';
  if (body.data.templateId) {
    try {
      const template = await getEmailTemplate(guard.ctx, body.data.templateId);
      if (!template) {
        return NextResponse.json({ error: 'template_not_found' }, { status: 400 });
      }
      branding = template.branding;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'template_failed';
      const status = message.includes('not permitted') ? 403 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }
  const html =
    body.data.html?.trim() ||
    (text ? wrapComposeBodyHtml(text, branding, body.data.subject) : '');
  if (!html) {
    return NextResponse.json({ error: 'body_required' }, { status: 400 });
  }

  try {
    const sent = await sendMailViaOutlook(guard.ctx, {
      to,
      cc,
      subject: body.data.subject,
      html,
      text: text || undefined,
    });
    return NextResponse.json({ ok: true, from: sent.msEmail });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'send_failed';
    const status =
      message === 'outlook_not_connected'
        ? 409
        : message === 'outlook_not_configured'
          ? 503
          : message.includes('not permitted')
            ? 403
            : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
