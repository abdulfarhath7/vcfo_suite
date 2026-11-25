import type { FieldCheckItem } from '@/db/schema-integrations';
import { ZohoApiError } from './client';
import { pickGstin, pickPan } from './ids';
import { clientFor, type AppDiscovery, type DiscoveredEntity, type DiscoveredOrg, type ZohoConn } from './types';

/**
 * Zoho Books reader (also used for Zoho Invoice, which has the same API under /invoice/v3 with the
 * organisation in a header). Types are hand-written from Zoho's official OpenAPI documents; only
 * the fields VCFO reads are listed.
 */
export type BooksEdition = 'books' | 'invoice';

export interface BooksOrg {
  organization_id: string;
  name: string;
  is_org_active?: boolean;
  tax_id_value?: string;
  [k: string]: unknown;
}

export interface BooksContact {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  contact_type?: string;
  gst_no?: string;
  gst_treatment?: string;
  status?: string;
  [k: string]: unknown;
}

export interface BooksInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  date: string;
  due_date?: string;
  status: string;
  total: number;
  balance: number;
  currency_code?: string;
  exchange_rate?: number;
  gst_no?: string;
  reference_number?: string;
  last_modified_time?: string;
}

export interface BooksPaymentInvoice {
  invoice_id: string;
  invoice_number: string;
  date?: string;
  invoice_amount?: number;
  amount_applied: number;
  balance_amount?: number;
}

export interface BooksPayment {
  payment_id: string;
  payment_number?: string;
  customer_id: string;
  customer_name: string;
  date: string;
  amount: number;
  reference_number?: string;
  payment_mode?: string;
  currency_code?: string;
  exchange_rate?: number;
  invoices?: BooksPaymentInvoice[];
}

/** A refusal that means "this product is not on the account", not a fault. */
export function isNotLicensed(err: unknown): boolean {
  if (!(err instanceof ZohoApiError)) return false;
  return err.status === 401 || err.status === 403 || err.status === 404 || err.code === 57 || err.code === 1000;
}

export async function listOrgs(conn: ZohoConn, edition: BooksEdition = 'books'): Promise<BooksOrg[]> {
  const body = await clientFor(edition, conn).get<{ organizations?: BooksOrg[] }>('/organizations');
  return body.organizations ?? [];
}

export async function getOrg(conn: ZohoConn, orgId: string, edition: BooksEdition = 'books'): Promise<BooksOrg | null> {
  const body = await clientFor(edition, conn, orgId).get<{ organization?: BooksOrg }>(`/organizations/${encodeURIComponent(orgId)}`);
  return body.organization ?? null;
}

export async function listCustomers(conn: ZohoConn, orgId: string, edition: BooksEdition = 'books', maxPages = 50): Promise<BooksContact[]> {
  return clientFor(edition, conn, orgId).all<BooksContact>('/contacts', 'contacts', { contact_type: 'customer' }, maxPages);
}

/** Invoices dated in [from, to] (YYYY-MM-DD), drafts and void left to the mapper. */
export async function listInvoices(conn: ZohoConn, orgId: string, from: string, to: string, edition: BooksEdition = 'books'): Promise<BooksInvoice[]> {
  return clientFor(edition, conn, orgId).all<BooksInvoice>('/invoices', 'invoices', { date_start: from, date_end: to, sort_column: 'date' });
}

/**
 * Customer payments dated in [from, to], each with the invoices it was applied to. The list has no
 * date range filter, so it is read newest first and stops at the first page older than `from`;
 * the applied invoices come from one detail call per payment (rate limited per organisation).
 */
export async function listPayments(conn: ZohoConn, orgId: string, from: string, to: string, edition: BooksEdition = 'books'): Promise<BooksPayment[]> {
  const client = clientFor(edition, conn, orgId);
  const picked: BooksPayment[] = [];
  for await (const page of client.pages<BooksPayment>('/customerpayments', 'customerpayments', { sort_column: 'date', sort_order: 'D' })) {
    for (const p of page) if (p.date >= from && p.date <= to) picked.push(p);
    const oldest = page.reduce((m, p) => (p.date < m ? p.date : m), '9999-12-31');
    if (oldest < from) break;
  }
  const out: BooksPayment[] = [];
  for (const p of picked) {
    const detail = await client.get<{ payment?: BooksPayment }>(`/customerpayments/${encodeURIComponent(p.payment_id)}`);
    out.push({ ...p, invoices: detail.payment?.invoices ?? [] });
  }
  return out;
}

function customerEntity(edition: BooksEdition, orgId: string, c: BooksContact): DiscoveredEntity {
  const gstin = pickGstin(c);
  return {
    app: edition,
    externalType: 'customer',
    externalId: c.contact_id,
    name: c.company_name?.trim() || c.contact_name,
    gstin,
    pan: pickPan(c),
    externalOrgId: orgId,
  };
}

/**
 * Field check for one Books organisation: one sample invoice, one sample payment with its applied
 * invoices, and whether customers carry a GSTIN.
 */
export async function fieldCheckOrg(conn: ZohoConn, orgId: string, customers: BooksContact[], edition: BooksEdition = 'books'): Promise<FieldCheckItem[]> {
  const client = clientFor(edition, conn, orgId);
  const items: FieldCheckItem[] = [];
  try {
    const inv = await client.get<{ invoices?: BooksInvoice[] }>('/invoices', { per_page: 1 });
    const one = inv.invoices?.[0];
    items.push({ key: 'invoices', label: 'Invoices', present: Boolean(one), note: one ? undefined : 'No invoice yet' });
    items.push({ key: 'invoice_balance', label: 'Invoice balance due', present: one ? typeof one.balance === 'number' : null });
  } catch (err) {
    items.push({ key: 'invoices', label: 'Invoices', present: null, note: err instanceof Error ? err.message : 'read failed' });
  }
  try {
    const pay = await client.get<{ customerpayments?: BooksPayment[] }>('/customerpayments', { per_page: 1 });
    const one = pay.customerpayments?.[0];
    if (!one) {
      items.push({ key: 'payments_applied', label: 'Payments applied to invoices', present: null, note: 'No payment yet' });
    } else {
      const d = await client.get<{ payment?: BooksPayment }>(`/customerpayments/${encodeURIComponent(one.payment_id)}`);
      const applied = (d.payment?.invoices ?? []).some((i) => Number(i.amount_applied) > 0);
      items.push({ key: 'payments_applied', label: 'Payments applied to invoices', present: applied, note: applied ? undefined : 'Sample payment is not applied to an invoice' });
    }
  } catch (err) {
    items.push({ key: 'payments_applied', label: 'Payments applied to invoices', present: null, note: err instanceof Error ? err.message : 'read failed' });
  }
  const withGstin = customers.filter((c) => pickGstin(c)).length;
  items.push({
    key: 'customer_gstin',
    label: 'Customer GSTIN',
    present: customers.length ? withGstin > 0 : null,
    note: customers.length ? `${withGstin} of ${customers.length} customers` : 'No customers',
  });
  return items;
}

/** Discovery for Books or Invoice: every organisation, its customers, counts and field check. */
export async function discoverBooks(conn: ZohoConn, edition: BooksEdition = 'books'): Promise<AppDiscovery> {
  let orgs: BooksOrg[];
  try {
    orgs = await listOrgs(conn, edition);
  } catch (err) {
    if (isNotLicensed(err)) return { app: edition, used: false, orgs: [], entities: [] };
    return { app: edition, used: false, error: err instanceof Error ? err.message : 'read failed', orgs: [], entities: [] };
  }
  if (orgs.length === 0) return { app: edition, used: false, orgs: [], entities: [] };

  const outOrgs: DiscoveredOrg[] = [];
  const entities: DiscoveredEntity[] = [];
  for (const o of orgs) {
    const detail = await getOrg(conn, o.organization_id, edition).catch(() => null);
    const rec = { ...o, ...(detail ?? {}) };
    let customers: BooksContact[] = [];
    let customerError: string | undefined;
    try {
      customers = await listCustomers(conn, o.organization_id, edition);
    } catch (err) {
      customerError = err instanceof Error ? err.message : 'read failed';
    }
    const items = await fieldCheckOrg(conn, o.organization_id, customers, edition);
    outOrgs.push({
      app: edition,
      externalOrgId: o.organization_id,
      name: o.name,
      gstin: pickGstin(rec),
      pan: pickPan(rec),
      counts: { customers: customers.length },
      fieldCheck: { checkedAt: new Date().toISOString(), items, ...(customerError ? { error: customerError } : {}) },
    });
    for (const c of customers) entities.push(customerEntity(edition, o.organization_id, c));
  }
  return { app: edition, used: true, orgs: outOrgs, entities };
}
