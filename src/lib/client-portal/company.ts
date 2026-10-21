/**
 * The short company name the portal prints in chips, tabs, tracks and
 * sentences ("Northwind approves"), as the prototype does. The full legal name
 * stays for headings, documents and briefs.
 *
 *   "Northwind Technologies Pvt Ltd"   → "Northwind"
 *   "Halcyon Payments India Pvt Ltd"   → "Halcyon"
 *   "Pinewood Logistics LLP"           → "Pinewood"
 */
const LEGAL = /\s+(?:India\s+)?(?:(?:Private|Pvt\.?)\s+(?:Limited|Ltd\.?)|Limited|Ltd\.?|LLP|OPC)$/i;
const GENERIC =
  /\s+(?:India|Technologies|Technology|Tech|Solutions|Services|Systems|Labs|Analytics|Payments|Ventures|Industries|Enterprises|Consulting|Software|Digital|Media|Foods|Energy|Health|Healthcare|Logistics|Robotics|Global|International|Group|Holdings|Capital|Networks|Infotech|Infra)$/i;

export function companyShortName(name: string | null | undefined): string {
  const full = (name ?? '').trim();
  if (!full) return '';
  let s = full.replace(LEGAL, '').trim();
  for (let i = 0; i < 4 && /\s/.test(s); i++) {
    const next = s.replace(GENERIC, '').trim();
    if (next === s) break;
    s = next;
  }
  return s || full;
}
