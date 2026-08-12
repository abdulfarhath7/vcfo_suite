/**
 * Shared email-dispatch summary (safe for client + server).
 * API routes include this on responses so the UI can toast.
 */

export type EmailDispatchResult = {
  attempted: number;
  /** Addresses that the provider accepted. */
  sent: string[];
  /** Addresses skipped because email is not configured. */
  skipped: string[];
  /** Addresses that failed to send. */
  failed: string[];
};

export function emptyEmailDispatch(): EmailDispatchResult {
  return { attempted: 0, sent: [], skipped: [], failed: [] };
}

export function formatEmailRecipients(emails: string[]): string {
  const unique = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique[0]} and ${unique.length - 1} others`;
}

/** Merge several dispatch results (e.g. client + lead sends). */
export function mergeEmailDispatch(
  ...parts: Array<EmailDispatchResult | null | undefined>
): EmailDispatchResult {
  const out = emptyEmailDispatch();
  for (const part of parts) {
    if (!part) continue;
    out.attempted += part.attempted;
    out.sent.push(...part.sent);
    out.skipped.push(...part.skipped);
    out.failed.push(...part.failed);
  }
  out.sent = [...new Set(out.sent)];
  out.skipped = [...new Set(out.skipped)];
  out.failed = [...new Set(out.failed)];
  return out;
}
