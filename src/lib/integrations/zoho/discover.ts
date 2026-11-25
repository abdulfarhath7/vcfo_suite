import type { ZohoApp } from '@/db/schema-integrations';
import { discoverBooks } from './books';
import { discoverCrm } from './crm';
import { discoverPayroll } from './payroll';
import { discoverPeople } from './people';
import { autoMap, type FirmTarget, type MapItem, type MapTarget } from './automap';
import type { AppDiscovery, ZohoConn } from './types';

/**
 * Discovery (PLAN D3 steps 2 to 5): ask each app for its organisations, count what is there, read
 * one sample record per app for the field check, then auto map every org, customer and CRM account.
 * Pure apart from the Zoho calls; the job saves the result through the repository.
 */
const READERS: Record<ZohoApp, (conn: ZohoConn) => Promise<AppDiscovery>> = {
  books: (c) => discoverBooks(c, 'books'),
  invoice: (c) => discoverBooks(c, 'invoice'),
  crm: discoverCrm,
  payroll: discoverPayroll,
  people: discoverPeople,
};

export type AppSummary = { app: ZohoApp; used: boolean; error?: string; orgs: number; counts: Record<string, number> };

export async function discoverAll(conn: ZohoConn, apps: ZohoApp[], onStep?: (app: ZohoApp, done: AppSummary[]) => Promise<void> | void): Promise<{ results: AppDiscovery[]; summary: AppSummary[] }> {
  const results: AppDiscovery[] = [];
  const summary: AppSummary[] = [];
  for (const app of apps) {
    await onStep?.(app, summary);
    let r: AppDiscovery;
    try {
      r = await READERS[app](conn);
    } catch (err) {
      r = { app, used: false, error: err instanceof Error ? err.message : 'read failed', orgs: [], entities: [] };
    }
    results.push(r);
    const counts: Record<string, number> = {};
    for (const o of r.orgs) for (const [k, v] of Object.entries(o.counts)) counts[k] = (counts[k] ?? 0) + v;
    summary.push({ app, used: r.used, ...(r.error ? { error: r.error } : {}), orgs: r.orgs.length, counts });
  }
  return { results, summary };
}

/**
 * Every org, customer and CRM account found, matched to VCFO records. Customers are matched only
 * inside the firm's own Books or Invoice organisation (SBC's receivables): a client's own Books
 * holds that client's customers, who are not VCFO clients. `firmOrgIds` are organisations a
 * person already set to the firm on an earlier run.
 */
export function mapDiscovery(results: AppDiscovery[], targets: MapTarget[], firm: FirmTarget | null, firmOrgIds: string[] = []) {
  const orgItems: Array<MapItem & { externalOrgId: string | null }> = [];
  for (const r of results) {
    for (const o of r.orgs) {
      // The People account is one org with no ids to match; it is still listed for a manual pick.
      orgItems.push({ app: o.app, externalType: 'org', externalId: o.externalOrgId, name: o.name, gstin: o.gstin, pan: o.pan, externalOrgId: null });
    }
  }
  const firmPinned: FirmTarget | null = firm ? { ...firm, orgIds: [...(firm.orgIds ?? []), ...firmOrgIds] } : firmOrgIds.length ? { name: 'Firm', orgIds: firmOrgIds } : null;
  const orgs = autoMap(orgItems, targets, firmPinned).map((m, i) => ({ ...m, externalOrgId: orgItems[i]!.externalOrgId }));
  const firmOrgs = new Set(orgs.filter((o) => o.vcfoType === 'firm' && (o.app === 'books' || o.app === 'invoice')).map((o) => o.externalId));

  const entityItems: Array<MapItem & { externalOrgId: string | null }> = [];
  for (const r of results) {
    for (const e of r.entities) {
      if (e.externalType === 'customer' && !(e.externalOrgId && firmOrgs.has(e.externalOrgId))) continue;
      entityItems.push({ app: e.app, externalType: e.externalType, externalId: e.externalId, name: e.name, gstin: e.gstin, pan: e.pan, externalOrgId: e.externalOrgId });
    }
  }
  const entities = autoMap(entityItems, targets, null).map((m, i) => ({ ...m, externalOrgId: entityItems[i]!.externalOrgId }));
  return [...orgs, ...entities];
}
