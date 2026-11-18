/**
 * "Already sent" (owner, 18 Nov 2026): a received invoice goes to a person once. Pure, so the email
 * pop-ups and the send routes ask the same question the same way.
 */

/** Per invoice id, who it was already sent to (lower-case addresses) and when (ISO). */
export type SentMap = Record<string, Array<{ email: string; sentAt: string }>>;

export type SentHit = { invoiceId: string; email: string; sentAt: string };

/** The already-sent received invoices among `invoiceIds` for these recipients. */
export function alreadySentHits(map: SentMap, invoiceIds: string[], recipients: string[]): SentHit[] {
  const who = new Set(recipients.map((e) => e.trim().toLowerCase()));
  const hits: SentHit[] = [];
  for (const id of invoiceIds) for (const s of map[id] ?? []) if (who.has(s.email)) hits.push({ invoiceId: id, email: s.email, sentAt: s.sentAt });
  return hits;
}
