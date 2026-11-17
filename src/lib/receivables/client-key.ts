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
