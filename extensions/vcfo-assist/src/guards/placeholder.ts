/**
 * G16 — NO PLACEHOLDER VALUES (docs/specs/vcfo-assist-agents/SAFETY.md).
 *
 * ICAI DC/1891/2024 suspended a CA for putting dummy phone numbers into mandatory SPICe+ fields
 * "to bypass system checks". The agent therefore never types a value that is blank or looks like
 * a placeholder, and never types the firm's own phone or email into a client's field. It leaves
 * the field empty, marks it "You fill this from the client's records" and records it on the run.
 *
 * Pure: no DOM, no chrome API. The rule runs on every field. A recipe's `noPlaceholder` only
 * decides whether a MISSING value is also highlighted and recorded; it can never let a placeholder
 * through, because a guard is not a setting.
 */

export type PlaceholderReason = 'empty' | 'placeholder' | 'firm_contact';

export interface PlaceholderHit {
  reason: PlaceholderReason;
  /** A short, value-free explanation for the log and the panel. */
  why: string;
}

/** The firm's own contact details, from Suite's catalog: lower-cased emails, ten-digit phones. */
export interface FirmContacts {
  emails: string[];
  phones: string[];
}

/** Whole values (after trimming, lower case, single spaces, no trailing dots) that are placeholders. */
const PLACEHOLDER_WORDS = new Set([
  'na', 'n/a', 'n.a', 'n a', 'n/a.', 'not applicable', 'not available', 'nil', 'nill', 'none', 'null', 'undefined', 'unknown',
  'tbd', 'tba', 'to be decided', 'to be updated', 'to be confirmed', 'pending',
  'test', 'testing', 'test test', 'dummy', 'sample', 'placeholder', 'example', 'demo',
  'abc', 'abcd', 'abcde', 'xyz', 'abc xyz', 'asdf', 'qwerty', 'lorem ipsum', 'foo', 'bar', 'temp',
]);

const PLACEHOLDER_EMAIL_LOCAL = new Set(['test', 'testing', 'dummy', 'na', 'none', 'nil', 'null', 'abc', 'xyz', 'sample', 'example', 'noemail', 'no-email', 'noreply', 'no-reply', 'xxx', 'asdf']);
const PLACEHOLDER_EMAIL_DOMAIN = new Set([
  'example.com', 'example.org', 'example.net', 'example.in', 'test.com', 'test.in', 'dummy.com', 'abc.com', 'xyz.com',
  'email.com', 'domain.com', 'none.com', 'na.com', 'mailinator.com', 'sample.com',
]);

// '1234567890' is the classic dummy mobile, so the ascending run may end on a 0.
const ASCENDING = '01234567890';
const DESCENDING = '9876543210';

/** The digits of a phone-like value, without a leading +91 or 0 when that leaves ten digits. */
function phoneDigits(value: string): string | null {
  if (!/^[\d\s()+\-.]+$/.test(value)) return null;
  const d = value.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  return d;
}

/** A run of six or more identical digits, or a run of six or more counting up or down. */
function isDummyNumber(digits: string): boolean {
  if (digits.length < 6) return false;
  if (/^(\d)\1+$/.test(digits)) return true;
  return ASCENDING.includes(digits) || DESCENDING.includes(digits);
}

/**
 * Null when the value may be typed. Otherwise why it may not. `undefined` and `null` are the
 * caller's "missing" case and are not judged here.
 */
export function placeholderReason(value: string | null | undefined, firm?: FirmContacts | null): PlaceholderHit | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || /^[\s\-–—_.,/\\*#?!~'"`|]+$/.test(trimmed)) return { reason: 'empty', why: 'blank or only punctuation' };

  const word = trimmed.toLowerCase().replace(/\s+/g, ' ').replace(/\.+$/, '');
  if (PLACEHOLDER_WORDS.has(word) || /^x{2,}$/.test(word) || /^(x+[\s-]*)+$/.test(word)) return { reason: 'placeholder', why: 'a placeholder word' };

  const email = /^([^@\s]+)@([^@\s]+)$/.exec(trimmed.toLowerCase());
  if (email) {
    if (firm?.emails.includes(trimmed.toLowerCase())) return { reason: 'firm_contact', why: "the firm's own email" };
    if (PLACEHOLDER_EMAIL_LOCAL.has(email[1]!) || PLACEHOLDER_EMAIL_DOMAIN.has(email[2]!)) return { reason: 'placeholder', why: 'a placeholder email' };
    return null;
  }

  const digits = phoneDigits(trimmed);
  if (digits) {
    if (firm && digits.length >= 8 && firm.phones.includes(digits.slice(-10))) return { reason: 'firm_contact', why: "the firm's own phone number" };
    if (isDummyNumber(digits)) return { reason: 'placeholder', why: 'a dummy number' };
  }
  return null;
}
