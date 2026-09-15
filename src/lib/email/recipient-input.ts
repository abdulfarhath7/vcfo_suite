/**
 * Free-typed recipients on staff compose. The directory is a convenience, not
 * a boundary: a lead can mail a CA, a bank or a prospect who is not in the
 * system. Typed text is split into addresses, matched back to directory
 * people where the address is theirs (so the chip carries the name), and
 * otherwise kept as a plain address chip.
 */

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;

export function isEmailAddress(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * `"Anita <anita@x.in>, raj@y.com; bad"` → tokens `anita@x.in`, `raj@y.com`,
 * `bad`. Separators are commas, semicolons and whitespace; a display name in
 * front of `<…>` is dropped.
 */
export function splitTypedRecipients(text: string): string[] {
  return text
    .replace(/[^,;<>]*<([^<>]+)>/g, ' $1 ')
    .split(/[,;\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export type ResolvedRecipients = {
  /** Directory people whose address was typed — select them, not a raw chip. */
  personIds: string[];
  /** Valid addresses nobody in the directory owns. */
  emails: string[];
  /** Tokens that are not an email address. */
  invalid: string[];
};

export function resolveTypedRecipients(
  people: ReadonlyArray<{ userId: string; email: string }>,
  text: string,
): ResolvedRecipients {
  const byEmail = new Map(people.map((p) => [p.email.trim().toLowerCase(), p.userId]));
  const out: ResolvedRecipients = { personIds: [], emails: [], invalid: [] };
  for (const token of splitTypedRecipients(text)) {
    const lower = token.toLowerCase();
    const personId = byEmail.get(lower);
    if (personId) {
      if (!out.personIds.includes(personId)) out.personIds.push(personId);
    } else if (isEmailAddress(token)) {
      if (!out.emails.includes(lower)) out.emails.push(lower);
    } else {
      out.invalid.push(token);
    }
  }
  return out;
}
