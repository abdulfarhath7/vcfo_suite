import type { FieldCheck, LinkExternalType, LinkMatch, LinkStatus, LinkVcfoType, OrgCounts, ZohoApp } from '@/db/schema-integrations';

/** What the Firm settings > Integrations > Zoho card reads (no tokens, no secrets). */
export type ZohoAppSummaryDto = { app: ZohoApp; used: boolean; error?: string; orgs: number; counts: Record<string, number> };

export type ZohoJobDto = {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  step: string | null;
  apps: ZohoAppSummaryDto[];
  links: { mapped: number; suggested: number; unmapped: number; ignored: number } | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type ZohoOrgDto = { id: string; app: ZohoApp; externalOrgId: string; name: string; gstin: string | null; counts: OrgCounts; fieldCheck: FieldCheck | null };

export type ZohoLinkDto = {
  id: string;
  app: ZohoApp;
  externalType: LinkExternalType;
  externalId: string;
  externalName: string;
  externalGstin: string | null;
  vcfoType: LinkVcfoType | null;
  vcfoId: string | null;
  vcfoName: string | null;
  match: LinkMatch | null;
  status: LinkStatus;
};

export type ZohoStatusDto = {
  configured: boolean;
  connection: null | {
    id: string;
    status: 'active' | 'error' | 'revoked';
    location: string;
    apiDomain: string;
    connectedAt: string;
    lastUsedAt: string | null;
    lastError: string | null;
    apps: ZohoApp[];
  };
  job: ZohoJobDto | null;
  orgs: ZohoOrgDto[];
  links: ZohoLinkDto[];
};

export const ZOHO_APP_LABEL: Record<ZohoApp, string> = {
  books: 'Books',
  invoice: 'Invoice',
  crm: 'CRM',
  payroll: 'Payroll',
  people: 'People',
};

/** A receivable sheet's source and its Zoho state, for the Sheet tab's Sync button. */
export type SheetSource = 'excel' | 'tally' | 'zoho';

export type ZohoSheetStatusDto = {
  source: SheetSource;
  zohoApp: 'books' | 'invoice' | null;
  zohoOrgId: string | null;
  zohoOrgName: string | null;
  /** The firm has a live Zoho connection. */
  connected: boolean;
  /** The caller may pick the source and the Zoho organisation (firm-wide admins). */
  canChoose: boolean;
  /** Books and Invoice organisations found at discovery; only for firm-wide admins. */
  orgs: Array<{ app: 'books' | 'invoice'; externalOrgId: string; name: string; isFirm: boolean }>;
  /** Shaped like a Tally job so one Sync button serves both. */
  activeJob: import('@/lib/receivables/tally-live/wire').TallyJobDto | null;
};
