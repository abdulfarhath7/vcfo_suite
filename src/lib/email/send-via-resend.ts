import 'server-only';

import {
  applyDevRedirect,
  isRetryableFromIdentityError,
  normalizeAddresses,
  parseProviderErrorMessage,
  resendFromCandidates,
  type SendEmailInput,
  type SendEmailResult,
} from '@/lib/email/send-email-shared';

async function postResendEmail(
  apiKey: string,
  from: string,
  payload: {
    to: string[];
    cc: string[];
    replyTo: string[];
    subject: string;
    html: string;
    text: string;
  },
): Promise<{ ok: true; id?: string } | { ok: false; status: number; error: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      ...(payload.cc.length > 0 ? { cc: payload.cc } : {}),
      ...(payload.replyTo.length > 0 ? { reply_to: payload.replyTo } : {}),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return {
      ok: false,
      status: res.status,
      error: parseProviderErrorMessage(body) || `resend_http_${res.status}`,
    };
  }

  let id: string | undefined;
  try {
    const json = (await res.json()) as { id?: string };
    id = json.id?.trim() || undefined;
  } catch {
    /* Resend sometimes returns empty body; treat 2xx as success anyway */
  }
  return { ok: true, id };
}

/** Resend HTTPS transport — used when EMAIL_PROVIDER=resend (default). */
export async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const froms = resendFromCandidates(input.from);
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

  if (!apiKey || froms.length === 0) {
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
    let lastError = '';
    for (let i = 0; i < froms.length; i += 1) {
      const from = froms[i]!;
      const result = await postResendEmail(apiKey, from, {
        to,
        cc,
        replyTo,
        subject,
        html: input.html,
        text: input.text,
      });
      if (result.ok === false) {
        lastError = result.error;
        const canRetry =
          i < froms.length - 1 && isRetryableFromIdentityError(result.status, result.error);
        console.error(`[resend] ${purpose} API error`, result.status, result.error, { from });
        if (!canRetry) break;
        continue;
      }
      if (i > 0) {
        console.warn(`[resend] ${purpose} sent using fallback From ${from}`);
      }
      return {
        ok: true,
        redirectedTo,
        intendedTo,
        provider: 'resend',
        providerMessageId: result.id,
      };
    }

    return {
      ok: false,
      error: lastError || 'resend_send_failed',
      redirectedTo,
      intendedTo,
      provider: 'resend',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'resend_request_failed';
    console.error(`[resend] ${purpose} request failed`, message);
    return { ok: false, error: message, redirectedTo, intendedTo, provider: 'resend' };
  }
}
