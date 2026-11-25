/**
 * Field helpers shared by the external-lookup tools (GST on GSTZen, DIN on FalconeBiz).
 * Both providers answer with loosely typed JSON, so every field is coerced here rather
 * than trusted.
 */

/** Coerce any JSON value to a display string. Booleans read as Yes/No, null as empty. */
export function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (v == null) return '';
  return String(v);
}

export function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v ? [v] : [];
  return [];
}

/**
 * Normalise a date to YYYY-MM-DD. Accepts DD/MM/YYYY and DD-MM-YYYY (the MCA and GST
 * portals use both) and leaves anything else, an ISO date included, untouched.
 */
export function parseIndianDate(v: string): string {
  const m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(v.trim());
  if (!m) return v.trim();
  return `${m[3]}-${m[2]}-${m[1]}`;
}
