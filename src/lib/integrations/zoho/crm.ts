import type { FieldCheckItem } from '@/db/schema-integrations';
import { isNotLicensed } from './books';
import { pickGstin, pickPan } from './ids';
import { clientFor, type AppDiscovery, type DiscoveredEntity, type ZohoConn } from './types';

/**
 * Zoho CRM reader (/crm/v8): the org, the Accounts count, and every Account with its GSTIN or PAN
 * when the firm keeps one in a field whose API name mentions GST or PAN.
 */
export interface CrmOrg {
  id: string;
  company_name?: string;
  [k: string]: unknown;
}

export interface CrmField {
  api_name: string;
  field_label?: string;
  data_type?: string;
}

export interface CrmAccount {
  id: string;
  Account_Name: string;
  [k: string]: unknown;
}

export async function getCrmOrg(conn: ZohoConn): Promise<CrmOrg | null> {
  const body = await clientFor('crm', conn).get<{ org?: CrmOrg[] }>('/org');
  return body.org?.[0] ?? null;
}

export async function countAccounts(conn: ZohoConn): Promise<number> {
  const body = await clientFor('crm', conn).get<{ count?: number }>('/Accounts/actions/count');
  return Number(body.count ?? 0);
}

/** API names of Account fields that may hold a GSTIN or PAN. */
export async function taxFields(conn: ZohoConn): Promise<string[]> {
  try {
    const body = await clientFor('crm', conn).get<{ fields?: CrmField[] }>('/settings/fields', { module: 'Accounts' });
    return (body.fields ?? []).map((f) => f.api_name).filter((n) => /gst|pan\b|pan_|_pan|tax/i.test(n));
  } catch {
    return [];
  }
}

export async function listAccounts(conn: ZohoConn, extraFields: string[] = [], maxPages = 50): Promise<CrmAccount[]> {
  const fields = ['Account_Name', ...extraFields].join(',');
  const out: CrmAccount[] = [];
  for await (const page of clientFor('crm', conn).crmPages<CrmAccount>('/Accounts', { fields }, maxPages)) out.push(...page);
  return out;
}

export async function discoverCrm(conn: ZohoConn): Promise<AppDiscovery> {
  let org: CrmOrg | null;
  try {
    org = await getCrmOrg(conn);
  } catch (err) {
    if (isNotLicensed(err)) return { app: 'crm', used: false, orgs: [], entities: [] };
    return { app: 'crm', used: false, error: err instanceof Error ? err.message : 'read failed', orgs: [], entities: [] };
  }
  if (!org) return { app: 'crm', used: false, orgs: [], entities: [] };
  const fields = await taxFields(conn);
  let accounts: CrmAccount[] = [];
  let error: string | undefined;
  try {
    accounts = await listAccounts(conn, fields);
  } catch (err) {
    error = err instanceof Error ? err.message : 'read failed';
  }
  const count = await countAccounts(conn).catch(() => accounts.length);
  const entities: DiscoveredEntity[] = accounts.map((a) => ({
    app: 'crm',
    externalType: 'crm_account',
    externalId: a.id,
    name: a.Account_Name,
    gstin: pickGstin(a),
    pan: pickPan(a),
    externalOrgId: org!.id,
  }));
  const withId = entities.filter((e) => e.gstin || e.pan).length;
  const items: FieldCheckItem[] = [
    { key: 'accounts', label: 'Accounts', present: count > 0, note: `${count} accounts` },
    { key: 'account_gstin', label: 'GSTIN or PAN on accounts', present: fields.length ? withId > 0 : false, note: fields.length ? `${withId} of ${entities.length}` : 'No GST or PAN field on Accounts' },
  ];
  return {
    app: 'crm',
    used: true,
    orgs: [
      {
        app: 'crm',
        externalOrgId: org.id,
        name: org.company_name || 'Zoho CRM',
        gstin: pickGstin(org),
        pan: pickPan(org),
        counts: { accounts: count },
        fieldCheck: { checkedAt: new Date().toISOString(), items, ...(error ? { error } : {}) },
      },
    ],
    entities,
  };
}
