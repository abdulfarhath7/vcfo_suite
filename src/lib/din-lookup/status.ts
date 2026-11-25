/**
 * Reading MCA's status words. The words are free text from the register, so each test is on
 * whole words: "Inactive" holds the letters of "active" and a plain substring match paints a
 * dead DIN green, which is exactly the mistake a live lookup of DIN 00000001 showed.
 *
 * The four kinds line up with the chip tones the UI uses.
 */
export type StatusKind = 'ok' | 'bad' | 'warn' | 'idle';

/** DIN status: Approved, Active, Inactive, Disqualified, Deactivated, Surrendered, Lapsed. */
export function dinStatusKind(status: string): StatusKind {
  const s = status.trim().toLowerCase();
  if (!s) return 'idle';
  // The negatives are tested first: several of them contain a positive word.
  if (/\binactive\b|disqualif|deactivat|surrender|cancel|lapsed|struck|dead|expired/.test(s)) return 'bad';
  if (/\bapproved\b|\bactive\b|\bvalid\b/.test(s)) return 'ok';
  if (/pending|provisional|under/.test(s)) return 'warn';
  return 'idle';
}

/** DIR-3 KYC: "Done" or "Not Done". "Not Done" must never read as done. */
export function kycKind(value: string): StatusKind {
  const s = value.trim().toLowerCase();
  if (!s) return 'idle';
  if (/\bnot\b|pending|due|overdue|\bno\b/.test(s)) return 'warn';
  if (/done|complete|filed|\byes\b/.test(s)) return 'ok';
  return 'idle';
}

/** Company or LLP status on the report: Active, Strike Off, Under liquidation, Amalgamated. */
export function companyStatusKind(status: string): StatusKind {
  const s = status.trim().toLowerCase();
  if (!s) return 'idle';
  if (/\binactive\b|strike|struck|dissolv|liquidat|defunct|dormant|amalgamat|converted|closed/.test(s)) return 'bad';
  if (/\bactive\b/.test(s)) return 'ok';
  return 'idle';
}
