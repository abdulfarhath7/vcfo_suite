/**
 * RECEIVABLES v2 — the key that makes two spellings of one client the same client
 * (docs/specs/receivables/V2.md). Lower case, every run of punctuation or spaces collapsed to one
 * space, trimmed: "Machinify, Inc" and "Machinify Inc." both read as "machinify inc".
 *
 * Migration 0058 backfills `receivable_clients.client_key` with the same rule in SQL
 * (`trim(regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g'))`); keep the two in step.
 */
export function clientKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The existing client a Tally buyer name belongs to when the keys are not equal. Tally writes the
 * full legal name ("Bupa Capability Centre Private Limited", "NetDocuments India Private
 * Limited") where the weekly workbook wrote a short one ("Bupa", "Net Documents India"). With
 * spaces removed, the short key must be the start of the long one; the longest such key wins
 * ("netdocumentsindia" over "netdocuments"), and a tie or a key under four letters matches
 * nothing, so a new client is made instead of a wrong guess.
 */
export function clientByPrefix<T extends { clientKey: string }>(clients: T[], key: string): T | undefined {
  const target = key.replace(/ /g, '');
  let best: T | undefined;
  let bestLen = 0;
  let tie = false;
  for (const c of clients) {
    const k = c.clientKey.replace(/ /g, '');
    if (k.length < 4 || !target.startsWith(k)) continue;
    if (k.length > bestLen) {
      best = c;
      bestLen = k.length;
      tie = false;
    } else if (k.length === bestLen) tie = true;
  }
  return tie ? undefined : best;
}
