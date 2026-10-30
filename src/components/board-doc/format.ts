const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The India calendar day of a timestamp; a plain 'YYYY-MM-DD' stays as it is. */
function indiaDay(iso?: string | null): Date | null {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T00:00:00Z`);
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t + 330 * 60_000);
}

/** "14 Oct" on the India date (R-05 plain dates). Empty or bad input gives ''. */
export function docDay(iso?: string | null): string {
  const d = indiaDay(iso);
  return d ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` : '';
}

/** "14 Oct 2026" on the India date. */
export function docDate(iso?: string | null): string {
  const d = indiaDay(iso);
  return d ? `${docDay(iso)} ${d.getUTCFullYear()}` : '';
}
