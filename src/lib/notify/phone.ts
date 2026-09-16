/**
 * Phone-number helpers, deliberately in their own module.
 *
 * These are imported by CLIENT components (the create-project form, account
 * settings) to normalise input before it is sent to the API. Keeping them out
 * of `channels.ts` means no client bundle ever imports the module that reads
 * the messaging configuration, so the "no secrets in the client bundle" rule
 * holds structurally rather than by accident.
 *
 * Nothing here touches the environment or the network.
 */

/**
 * E.164: leading +, country code 1-9, 8-15 digits total.
 * Deliberately strict — an invalid-number attempt still costs a message fee.
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

/**
 * Meta's Cloud API wants bare digits with the country code and NO leading '+'
 * (e.g. 919876543210); a plus-prefixed number is rejected, so the EUM
 * transport formats here.
 */
export function toMetaPhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Meta reports numbers as bare digits (`919876543210`); profiles store E.164
 * (`+919876543210`). Convert on the way in from an EUM webhook so the lookup
 * matches, and return '' rather than a half-formed number when it cannot.
 */
export function fromMetaPhone(value: string | null | undefined): string {
  const digits = toMetaPhone(value);
  if (!digits) return '';
  const candidate = `+${digits}`;
  return isValidE164(candidate) ? candidate : '';
}

/**
 * Inbound opt-out keywords. A self-managed sender must honour them itself —
 * the timestamp is recorded so the send guards stop sending.
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
