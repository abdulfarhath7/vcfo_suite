import 'server-only';

import {
  applyDevRedirect,
  normalizeAddresses,
  resolveFromEmail,
  type SendEmailInput,
  type SendEmailResult,
} from '@/lib/email/send-email-shared';

/** Resend HTTPS transport — used when EMAIL_PROVIDER=resend (default). */
export async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resolveFromEmail(input.from);
  const purpose = input.purpose ?? 'email';

  let to = normalizeAddresses(input.to);
  let cc = normalizeAddresses(input.cc);
  const replyTo = normalizeAddresses(input.replyTo);
  let subject = input.subject;

  const redirected = applyDevRedirect({ to, cc, subject, purpose });
  to = redirected.to;
  cc = redirected.cc;
  subject = redirected.subject;
  const { redirectedTo, intendedTo } = redirected;

  if (!apiKey || !from) {
    console.log(`[resend] skipped (${purpose}) — RESEND_API_KEY or From empty`, {
      to,
      cc,
      reply_to: replyTo,
      subject,
      text: input.text,
      intendedTo,
    });
    return {
      ok: false,
      skipped: true,
      error: 'email_not_configured',
      redirectedTo,
      intendedTo,
      provider: 'resend',
    };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        ...(cc.length > 0 ? { cc } : {}),
        ...(replyTo.length > 0 ? { reply_to: replyTo } : {}),
        subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[resend] ${purpose} API error`, res.status, body);
      return {
        ok: false,
        error: body || `resend_http_${res.status}`,
        redirectedTo,
        intendedTo,
        provider: 'resend',
      };
    }

    let providerMessageId: string | undefined;
    try {
      const payload = (await res.json()) as { id?: string };
      providerMessageId = payload.id?.trim() || undefined;
    } catch {
      /* Resend sometimes returns empty body; treat 2xx as success anyway */
    }

    return {
      ok: true,
      redirectedTo,
      intendedTo,
      provider: 'resend',
      providerMessageId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'resend_request_failed';
    console.error(`[resend] ${purpose} request failed`, message);
    return { ok: false, error: message, redirectedTo, intendedTo, provider: 'resend' };
  }
}
