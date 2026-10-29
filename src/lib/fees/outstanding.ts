/**
 * What is outstanding on an engagement's fee lines (P-100): every billed line not yet paid. The
 * age counts from the oldest unpaid invoice day; the bucket is the usual receivables ageing.
 */
export interface FeeLineForOutstanding {
  amountRupees: number;
  status: string;
  billedOn: string | null;
}

export interface Outstanding {
  amountRupees: number;
  /** Days since the oldest unpaid invoice went out. */
  days: number;
  bucket: string;
}

const DAY_MS = 86_400_000;

export function ageBucket(days: number): string {
  if (days <= 30) return '0 to 30 days';
  if (days <= 60) return '31 to 60 days';
  if (days <= 90) return '61 to 90 days';
  return 'Over 90 days';
}

export function outstandingOf(lines: FeeLineForOutstanding[], today: string): Outstanding | null {
  const unpaid = lines.filter((line) => line.status === 'billed');
  if (unpaid.length === 0) return null;
  const amountRupees = unpaid.reduce((sum, line) => sum + line.amountRupees, 0);
  const todayMs = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  const oldest = unpaid
    .map((line) => (line.billedOn ? Date.parse(`${line.billedOn.slice(0, 10)}T00:00:00Z`) : todayMs))
    .reduce((a, b) => Math.min(a, b), todayMs);
  const days = Math.max(0, Math.round((todayMs - oldest) / DAY_MS));
  return { amountRupees, days, bucket: ageBucket(days) };
}

/** "₹1,25,000" — Indian grouping, whole rupees. */
export function rupees(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}
