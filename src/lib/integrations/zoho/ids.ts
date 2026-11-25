/**
 * Indian tax ids found in Zoho records. Zoho keeps the GSTIN under different keys per app and
 * edition (`gst_no`, `tax_id_value`, `tax_reg_no`, a CRM custom field), so these look at every key
 * whose name mentions GST, tax or PAN and keep the first value of the right shape.
 */
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function cleanId(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, '').toUpperCase() : '';
}

export function isGstin(v: unknown): boolean {
  return GSTIN_RE.test(cleanId(v));
}

export function isPan(v: unknown): boolean {
  return PAN_RE.test(cleanId(v));
}

/** The PAN inside a GSTIN (characters 3 to 12). */
export function panOfGstin(gstin: string | null | undefined): string | null {
  const g = cleanId(gstin);
  return GSTIN_RE.test(g) ? g.slice(2, 12) : null;
}

export function pickGstin(rec: Record<string, unknown> | null | undefined): string | null {
  if (!rec) return null;
  for (const [k, v] of Object.entries(rec)) {
    if (!/gst|tax_id|tax_reg/i.test(k)) continue;
    const c = cleanId(v);
    if (GSTIN_RE.test(c)) return c;
  }
  return null;
}

export function pickPan(rec: Record<string, unknown> | null | undefined): string | null {
  if (!rec) return null;
  for (const [k, v] of Object.entries(rec)) {
    if (!/pan|company_id/i.test(k)) continue;
    const c = cleanId(v);
    if (PAN_RE.test(c)) return c;
  }
  return panOfGstin(pickGstin(rec));
}
