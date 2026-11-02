/**
 * DIN recognition. A DIN is exactly 8 digits (leading zeros are part of it,
 * so it stays a string). An 8-digit number alone is too common (amounts,
 * dates like 20261026) to treat as a DIN, so a message must either name it
 * ("DIN 01234567", "director identification number: 01234567") or be the
 * bare number and nothing else.
 */
const NAMED_DIN_RE = /\b(?:DIN|director\s+identification\s+(?:number|no\.?))\s*(?:no\.?|number)?\s*[:#-]?\s*(\d{8})(?!\d)/i;
const BARE_DIN_RE = /^\s*(\d{8})\s*$/;

export function isValidDin(value: string): boolean {
  return /^\d{8}$/.test(value);
}

/** The DIN a chat message asks about, or null. */
export function findDinInMessage(message: string): string | null {
  const named = NAMED_DIN_RE.exec(message);
  if (named) return named[1]!;
  const bare = BARE_DIN_RE.exec(message);
  return bare ? bare[1]! : null;
}

/** "Approved" / "Active" read as active; deactivated, disabled, surrendered, lapsed as not. */
export function dinStatusIsActive(status: string): boolean | null {
  const s = status.toLowerCase();
  if (/deactivat|disabl|surrender|lapsed|cancel|inactive|struck/.test(s)) return false;
  if (/approved|active/.test(s)) return true;
  return null;
}
