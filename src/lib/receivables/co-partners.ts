/**
 * Second partners on a client (owner, 18 Nov 2026). The lead partner sits on the invoice
 * (`partnerId`); a second partner shares every invoice of the client. Pure, so the emails, the
 * summary and the privacy checks all ask the same question the same way.
 */

export type CoPartnerLink = { clientId: string; partnerId: string };

/** Every partner of an invoice: its lead, then the client's second partners. */
export function invoicePartnerIds(inv: { partnerId: string | null; clientId: string | null }, links: CoPartnerLink[]): string[] {
  const ids = inv.partnerId ? [inv.partnerId] : [];
  if (inv.clientId) for (const l of links) if (l.clientId === inv.clientId && !ids.includes(l.partnerId)) ids.push(l.partnerId);
  return ids;
}

/** True when the partner leads the invoice or is a second partner on its client. */
export function partnerOwns(partnerId: string, inv: { partnerId: string | null; clientId: string | null }, links: CoPartnerLink[]): boolean {
  return invoicePartnerIds(inv, links).includes(partnerId);
}
