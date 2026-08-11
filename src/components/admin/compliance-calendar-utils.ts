import type { ComplianceFiling } from '@/data/compliance';

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function isSameMonth(iso: string, month: Date): boolean {
  const d = parseIsoDate(iso);
  return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
}

export function isFilingInMonth(iso: string, month: Date): boolean {
  return isSameMonth(iso, month);
}

export function yearRange(filings: ComplianceFiling[]): number[] {
  const years = filings.map((f) => parseIsoDate(f.nextDue).getFullYear());
  const min = Math.min(...years, new Date().getFullYear());
  const max = Math.max(...years, new Date().getFullYear());
  const out: number[] = [];
  for (let y = min - 1; y <= max + 2; y += 1) out.push(y);
  return out;
}

export { parseIsoDate, isSameMonth };
