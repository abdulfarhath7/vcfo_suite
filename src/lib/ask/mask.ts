/**
 * Masks identity numbers wherever text can reach chat, logs, stored prompts or a run trace. It runs
 * on text, so it also catches a number somebody pasted. GSTIN and CIN are public registry numbers
 * and stay readable; a PAN inside a GSTIN does not match, because it has no word boundary. A portal
 * login, OTP, DSC PIN or token goes further: it is replaced outright, because no model or Ask table
 * ever holds one.
 */
const lastFour = (value: string): string => {
  const compact = value.replace(/[\s-]/g, '');
  return `${'X'.repeat(compact.length - 4)}${compact.slice(-4)}`;
};

const PATTERNS: readonly RegExp[] = [
  /\b[A-Z]{5}\d{4}[A-Z]\b/gi, // PAN
  /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Aadhaar
  /\b[A-Z][1-9]\d{6}\b/gi, // Passport
];

const DIN_IN_CONTEXT = /\b(DIN[\s:#-]*)(\d{8})\b/gi;

const SECRET_VALUE = '[hidden]';
const PASSWORD_WORD = String.raw`(?:password|passcode|passwd|pwd)`;

/**
 * Each pattern needs a value that looks like a secret, so "the OTP is sent to the director" and
 * "the password is required" stay as they are. A bare "PIN" is a postal code here, so it does not count.
 */
const PORTAL_SECRETS: readonly RegExp[] = [
  new RegExp(String.raw`\b(${PASSWORD_WORD}\s*[:=]\s*)\S+`, 'gi'),
  new RegExp(String.raw`\b(${PASSWORD_WORD}\s+(?:is\s+)?)(?=\S*\d)\S{4,}`, 'gi'),
  /\b((?:otp|one[- ]time\s+(?:password|code)|dsc\s+(?:token\s+)?(?:pin|password)|token\s+pin)\s*(?:is|:|=|-)?\s*)\d{4,8}\b/gi,
  /\b((?:token|api[- ]?key|secret|bearer)\s*(?:is|:|=)?\s*)(?=[A-Za-z0-9._~+/=-]*\d)[A-Za-z0-9._~+/=-]{16,}/gi,
  /()\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g,
];

const hideSecrets = (text: string): string => PORTAL_SECRETS.reduce((out, pattern) => out.replace(pattern, `$1${SECRET_VALUE}`), text);

/** True when a message holds a portal login, OTP, DSC PIN or token. */
export function holdsPortalSecret(text: string): boolean {
  return hideSecrets(text) !== text;
}

/** A record id is never an identity number, though parts of one can look like a passport or an Aadhaar. */
const RECORD_ID = /(\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b)/i;

export function maskIdentityNumbers(text: string): string {
  return text
    .split(RECORD_ID)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      const masked = PATTERNS.reduce((out, pattern) => out.replace(pattern, lastFour), hideSecrets(part));
      return masked.replace(DIN_IN_CONTEXT, (_all, label: string, digits: string) => `${label}${lastFour(digits)}`);
    })
    .join('');
}

/** The whole of one identity value, for a field already known to hold one. */
export function maskIdentityValue(value: string): string {
  const compact = value.replace(/[\s-]/g, '');
  return compact.length > 4 ? lastFour(compact) : 'X'.repeat(compact.length);
}

/**
 * Swaps identity numbers for placeholders, so a model reading the text never sees one. `restore`
 * puts them back into what the model returned; a placeholder the model made up stays as it is and
 * then fails the format check.
 */
export function tokeniseIdentityNumbers(text: string): { text: string; restore: (value: string) => string } {
  const found: string[] = [];
  const hold = (value: string): string => `IDTOKEN${found.push(value)}X`;
  const swapped = PATTERNS.reduce((out, pattern) => out.replace(pattern, hold), hideSecrets(text)).replace(
    DIN_IN_CONTEXT,
    (_all, label: string, digits: string) => `${label}${hold(digits)}`,
  );
  return { text: swapped, restore: (value) => value.replace(/IDTOKEN(\d+)X/g, (all, n: string) => found[Number(n) - 1] ?? all) };
}
