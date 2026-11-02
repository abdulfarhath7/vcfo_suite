/**
 * Masking for the developer console. A developer may see that a message went out and where
 * it was routed, but not whom it was for, so addresses keep only enough to debug a routing
 * fault: the first letter and the domain of an email, the country code and last two digits of
 * a phone number.
 */

const DOTS = '•••';

/** "rahul@acme.in" becomes "r•••@acme.in". Anything that is not an email is masked whole. */
export function maskEmail(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  const at = v.lastIndexOf('@');
  if (at <= 0 || at === v.length - 1) return DOTS;
  return `${v[0]}${DOTS}@${v.slice(at + 1).toLowerCase()}`;
}

/** "+919876543210" becomes "+91•••10". Fewer than six digits are masked whole. */
export function maskPhone(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  const digits = v.replace(/\D/g, '');
  if (digits.length < 6) return v ? DOTS : '';
  const cc = v.startsWith('+') ? `+${digits.slice(0, digits.length > 10 ? digits.length - 10 : 0)}` : '';
  return `${cc === '+' ? '' : cc}${DOTS}${digits.slice(-2)}`;
}

/** Mask an address of either kind: an email when it holds "@", otherwise a phone number. */
export function maskAddress(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  return v.includes('@') ? maskEmail(v) : maskPhone(v);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+\d[\d\s-]{8,15}\d/g;
const PAN_RE = /\b[A-Z]{5}\d{4}[A-Z]\b/g;

/**
 * Mask emails, international phone numbers and PANs inside free text (log lines, audit
 * summaries), so a stray client identifier in a message does not reach the console.
 */
export function scrubText(text: string | null | undefined): string {
  return (text ?? '')
    .replace(EMAIL_RE, (m) => maskEmail(m))
    .replace(PHONE_RE, (m) => maskPhone(m))
    .replace(PAN_RE, (m) => `${m.slice(0, 2)}${DOTS}`);
}
