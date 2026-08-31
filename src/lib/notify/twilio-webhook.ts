import 'server-only';

// Function-only import — no Twilio client is constructed at module scope.
import { validateRequest } from 'twilio';

/**
 * Twilio webhook plumbing shared by the status and inbound routes.
 *
 * Two things that are easy to get wrong and expensive to get wrong:
 *
 *  1. The raw body must be read ONCE, before any parsing, and the signature
 *     validated against the exact parameters Twilio signed.
 *  2. The URL must come from configuration, not from request headers. Behind a
 *     proxy or tunnel the reconstructed host differs from the URL Twilio
 *     signed, so header-derived validation fails in production and — worse —
 *     invites someone to "fix" it by trusting X-Forwarded-Host.
 *
 * A hand-rolled HMAC that silently accepts forged webhooks is not detectable
 * in review, so validation goes through Twilio's own implementation.
 */

export type TwilioForm = {
  /** Flat form fields, exactly as signed. */
  params: Record<string, string>;
  /** Raw body, kept for debugging; never persisted. */
  raw: string;
};

/** Read the raw body once and parse it as urlencoded form data. */
export async function readTwilioForm(request: Request): Promise<TwilioForm | null> {
  try {
    const raw = await request.text();
    const search = new URLSearchParams(raw);
    const params: Record<string, string> = {};
    for (const [key, value] of search.entries()) params[key] = value;
    return { params, raw };
  } catch {
    return null;
  }
}

/**
 * Validate `X-Twilio-Signature`. Returns false — never throws — when the
 * token, signature or configured URL is missing, so a misconfigured
 * deployment rejects webhooks rather than accepting them unverified.
 */
export function validateTwilioSignature(input: {
  authToken: string;
  signature: string | null;
  url: string;
  params: Record<string, string>;
}): boolean {
  const { authToken, signature, url, params } = input;

  if (!authToken.trim() || !signature?.trim() || !url.trim()) return false;

  try {
    return validateRequest(authToken, signature.trim(), url.trim(), params);
  } catch (err) {
    console.error('[twilio-webhook] signature validation failed', err);
    return false;
  }
}
