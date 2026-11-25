import { clientKey } from '@/lib/receivables/client-key';
import type { LinkExternalType, LinkMatch, LinkStatus, LinkVcfoType, ZohoApp } from '@/db/schema-integrations';
import { cleanId, panOfGstin } from './ids';

/**
 * The auto map (docs/specs/integrations/ZOHO.md): each Zoho organisation, customer and CRM account
 * is matched to a VCFO record by GSTIN first, then PAN, then the normalised name
 * (src/lib/receivables/client-key.ts). An exact, single match is mapped; a close or ambiguous
 * one is suggested; none is unmapped. Pure: the repository loads the targets and saves the result.
 */

export interface MapTarget {
  vcfoType: Exclude<LinkVcfoType, 'firm'>;
  vcfoId: string;
  name: string;
  /** Other names the record is known by (legal name, client name). */
  aliases?: string[];
  gstins?: string[];
  pans?: string[];
}

export interface FirmTarget {
  name: string;
  gstins?: string[];
  pans?: string[];
  /** A Zoho organisation id pinned to the firm (ZOHO_FIRM_ORG_ID). */
  orgIds?: string[];
}

export interface MapItem {
  app: ZohoApp;
  externalType: LinkExternalType;
  externalId: string;
  name: string;
  gstin: string | null;
  pan: string | null;
}

export interface MapResult {
  status: Exclude<LinkStatus, 'ignored'>;
  match: LinkMatch | null;
  vcfoType: LinkVcfoType | null;
  vcfoId: string | null;
  vcfoName: string | null;
}

const LEGAL_SUFFIX = /\b(private|pvt|limited|ltd|llp|inc|incorporated|llc|co|company|corp|corporation|opc|the|india)\b/g;

/** The name key with legal words dropped, for close matches ("Acme India Pvt Ltd" ~ "Acme"). */
export function looseKey(name: string): string {
  return clientKey(name).replace(LEGAL_SUFFIX, ' ').replace(/\s+/g, '').trim();
}

const UNMAPPED: MapResult = { status: 'unmapped', match: null, vcfoType: null, vcfoId: null, vcfoName: null };

function panOf(item: { gstin: string | null; pan: string | null }): string | null {
  return cleanId(item.pan) || panOfGstin(item.gstin) || null;
}

function targetPans(t: { gstins?: string[]; pans?: string[] }): string[] {
  return [...(t.pans ?? []).map(cleanId), ...(t.gstins ?? []).map((g) => panOfGstin(g) ?? '')].filter(Boolean);
}

function hit(t: MapTarget, status: 'mapped' | 'suggested', match: LinkMatch): MapResult {
  return { status, match, vcfoType: t.vcfoType, vcfoId: t.vcfoId, vcfoName: t.name };
}

/** Which kinds of VCFO record each Zoho kind may map to, in order of preference. */
function allowedTypes(item: MapItem): MapTarget['vcfoType'][] {
  if (item.externalType === 'customer') return ['receivable_client', 'engagement'];
  return ['engagement'];
}

export function matchOne(item: MapItem, targets: MapTarget[], firm?: FirmTarget | null): MapResult {
  // SBC's own organisation in Books/Invoice is the firm (its receivables), never a client.
  if (firm && item.externalType === 'org') {
    if (firm.orgIds?.includes(item.externalId)) return { status: 'mapped', match: 'manual', vcfoType: 'firm', vcfoId: null, vcfoName: firm.name };
    const g = cleanId(item.gstin);
    if (g && (firm.gstins ?? []).map(cleanId).includes(g)) return { status: 'mapped', match: 'auto_gstin', vcfoType: 'firm', vcfoId: null, vcfoName: firm.name };
    const p = panOf(item);
    if (p && targetPans(firm).includes(p)) return { status: 'mapped', match: 'auto_pan', vcfoType: 'firm', vcfoId: null, vcfoName: firm.name };
    if (firm.name && clientKey(firm.name) === clientKey(item.name)) return { status: 'mapped', match: 'auto_name', vcfoType: 'firm', vcfoId: null, vcfoName: firm.name };
  }

  const kinds = allowedTypes(item);
  for (const kind of kinds) {
    const pool = targets.filter((t) => t.vcfoType === kind);
    if (pool.length === 0) continue;

    const g = cleanId(item.gstin);
    if (g) {
      const byG = pool.filter((t) => (t.gstins ?? []).map(cleanId).includes(g));
      if (byG.length === 1) return hit(byG[0]!, 'mapped', 'auto_gstin');
      if (byG.length > 1) return hit(byG[0]!, 'suggested', 'suggested');
    }
    const p = panOf(item);
    if (p) {
      const byP = pool.filter((t) => targetPans(t).includes(p));
      if (byP.length === 1) return hit(byP[0]!, 'mapped', 'auto_pan');
      if (byP.length > 1) return hit(byP[0]!, 'suggested', 'suggested');
    }
    const key = clientKey(item.name);
    if (key) {
      const byN = pool.filter((t) => [t.name, ...(t.aliases ?? [])].some((n) => clientKey(n) === key));
      if (byN.length === 1) return hit(byN[0]!, 'mapped', 'auto_name');
      if (byN.length > 1) return hit(byN[0]!, 'suggested', 'suggested');
    }
  }

  // Close matches: same name once legal words are dropped, or one name the start of the other.
  for (const kind of kinds) {
    const pool = targets.filter((t) => t.vcfoType === kind);
    const loose = looseKey(item.name);
    if (loose.length < 4) continue;
    const close = pool.filter((t) =>
      [t.name, ...(t.aliases ?? [])].some((n) => {
        const k = looseKey(n);
        return k.length >= 4 && (k === loose || loose.startsWith(k) || k.startsWith(loose));
      }),
    );
    if (close.length >= 1) return hit(close[0]!, 'suggested', 'suggested');
  }
  return UNMAPPED;
}

export function autoMap(items: MapItem[], targets: MapTarget[], firm?: FirmTarget | null): Array<MapItem & MapResult> {
  return items.map((i) => ({ ...i, ...matchOne(i, targets, firm) }));
}

export type MapSummary = { mapped: number; suggested: number; unmapped: number; ignored: number };

export function summarise(rows: Array<{ status: LinkStatus }>): MapSummary {
  const s: MapSummary = { mapped: 0, suggested: 0, unmapped: 0, ignored: 0 };
  for (const r of rows) s[r.status] += 1;
  return s;
}
