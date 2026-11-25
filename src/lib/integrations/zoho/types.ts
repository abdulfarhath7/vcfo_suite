import type { FieldCheck, LinkExternalType, OrgCounts, ZohoApp } from '@/db/schema-integrations';
import { appBaseUrl } from './dc';
import { ZohoClient, type RateLimiter } from './client';

/** What the readers need of a connection: where it lives and a token on demand. */
export interface ZohoConn {
  apiDomain: string;
  dc: string;
  getAccessToken: (force?: boolean) => Promise<string>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  limiter?: RateLimiter;
}

export interface DiscoveredOrg {
  app: ZohoApp;
  externalOrgId: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  counts: OrgCounts;
  fieldCheck?: FieldCheck;
}

/** A customer or CRM account, matched to VCFO clients by the auto map. */
export interface DiscoveredEntity {
  app: ZohoApp;
  externalType: Exclude<LinkExternalType, 'org'>;
  externalId: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  externalOrgId: string | null;
}

export interface AppDiscovery {
  app: ZohoApp;
  /** False when the app answered with no organisation, or refused for want of a licence. */
  used: boolean;
  error?: string;
  orgs: DiscoveredOrg[];
  entities: DiscoveredEntity[];
}

export function clientFor(app: ZohoApp, conn: ZohoConn, orgId?: string | null): ZohoClient {
  return new ZohoClient({
    baseUrl: appBaseUrl(app, conn),
    orgId: orgId ?? null,
    orgParam: app === 'invoice' ? 'header' : app === 'books' || app === 'payroll' ? 'query' : null,
    getAccessToken: conn.getAccessToken,
    fetchImpl: conn.fetchImpl,
    sleep: conn.sleep,
    limiter: conn.limiter,
  });
}

/** A short date of today minus `days`, as Zoho wants it (YYYY-MM-DD). */
export function isoDay(daysAgo = 0, now = new Date()): string {
  const d = new Date(now.getTime() - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
}
