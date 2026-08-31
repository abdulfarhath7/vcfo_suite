/**
 * Phone-number helpers, deliberately in their own module.
 *
 * These are imported by CLIENT components (the create-project form, account
 * settings) to normalise input before it is sent to the API. Keeping them out
 * of `channels.ts` means no client bundle ever imports the module that reads
 * Twilio credentials, so the "no secrets in the client bundle" rule holds
 * structurally rather than by accident.
 *
 * Nothing here touches the environment or the network.
 */

/**
 * E.164: leading +, country code 1-9, 8-15 digits total.
 * Deliberately strict — Twilio charges for an invalid-number attempt.
 */
const E164 = /^\+[1-9]\d{7,14}$/;

export function isValidE164(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return E164.test(trimmed);
}

/**
 * Normalise loose user input to E.164 where the intent is unambiguous.
 * Returns null rather than guessing — a wrong country code messages a stranger.
 */
export function normalizeToE164(
  raw: string | null | undefined,
  defaultCountryCode = '+91',
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[\s()\-.]/g, '');
  if (E164.test(compact)) return compact;

  // 00 international prefix → +
  if (compact.startsWith('00')) {
    const plus = `+${compact.slice(2)}`;
    return E164.test(plus) ? plus : null;
  }

  // Bare national number → prepend the default country code.
  if (/^\d{6,14}$/.test(compact)) {
    const candidate = `${defaultCountryCode}${compact.replace(/^0+/, '')}`;
    return E164.test(candidate) ? candidate : null;
  }

  return null;
}

/** `whatsapp:+91...` ↔ `+91...` — Twilio uses the prefixed form on the wire. */
export function stripWhatsAppPrefix(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/^whatsapp:/i, '');
}

export function withWhatsAppPrefix(value: string): string {
  const bare = stripWhatsAppPrefix(value);
  return bare ? `whatsapp:${bare}` : '';
}

/**
 * Inbound opt-out keywords. Twilio handles some of these itself on its own
 * numbers, but a self-managed sender must honour them too — and we record the
 * timestamp regardless so the send guards stop sending.
 */
const OPT_OUT_KEYWORDS = new Set([
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'revoke',
  'optout',
  'opt-out',
]);

export function isOptOutKeyword(body: string | null | undefined): boolean {
  const normalized = body?.trim().toLowerCase().replace(/[.!]+$/, '');
  if (!normalized) return false;
  return OPT_OUT_KEYWORDS.has(normalized);
}
