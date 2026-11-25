import type { FieldCheckItem } from '@/db/schema-integrations';
import { isNotLicensed } from './books';
import { PAYROLL_DCS } from './dc';
import { pickGstin, pickPan } from './ids';
import { clientFor, type AppDiscovery, type DiscoveredOrg, type ZohoConn } from './types';

/**
 * Zoho Payroll reader (/payroll/v1, India, US, UAE and KSA datacenters only). Types are
 * hand-written from Zoho's official Payroll OpenAPI document.
 */
export interface PayrollOrg {
  organization_id: string;
  name: string;
  tax_id_value?: string;
  company_id_value?: string;
  [k: string]: unknown;
}

export interface PayrollEmployee {
  employee_id: string;
  first_name?: string;
  last_name?: string;
  employee_number?: string;
  employee_status?: string;
}

export interface PayrollRun {
  payroll_run_id: string;
  status: string;
  type?: string;
  pay_date?: string;
  pay_period_start_date?: string;
  pay_period_end_date?: string;
}

export interface PayrollStatutory {
  is_eligible_for_pf?: boolean;
  is_eligible_for_esi?: boolean;
  is_eligible_for_pt?: boolean;
  is_pt_applicable?: boolean;
  is_eligible_for_lwf?: boolean;
  is_lwf_applicable?: boolean;
  pf_account_number?: string;
  esi_number?: string;
}

export async function listPayrollOrgs(conn: ZohoConn): Promise<PayrollOrg[]> {
  const body = await clientFor('payroll', conn).get<{ organizations?: PayrollOrg[] }>('/organizations');
  return body.organizations ?? [];
}

export async function listEmployees(conn: ZohoConn, orgId: string, maxPages = 20): Promise<PayrollEmployee[]> {
  return clientFor('payroll', conn, orgId).all<PayrollEmployee>('/employees', 'employees', {}, maxPages);
}

export async function listPayRuns(conn: ZohoConn, orgId: string, maxPages = 5): Promise<PayrollRun[]> {
  return clientFor('payroll', conn, orgId).all<PayrollRun>('/payrollruns', 'payroll_runs', {}, maxPages);
}

/** Basic, PF, ESI, PT and LWF on one sample employee. */
export async function fieldCheckPayroll(conn: ZohoConn, orgId: string, sample: PayrollEmployee | undefined): Promise<FieldCheckItem[]> {
  if (!sample) return [{ key: 'employees', label: 'Employees', present: false, note: 'No employee yet' }];
  const client = clientFor('payroll', conn, orgId);
  const items: FieldCheckItem[] = [];
  try {
    const salary = await client.get<Record<string, unknown>>(`/employees/${encodeURIComponent(sample.employee_id)}/salary`);
    items.push({ key: 'basic', label: 'Basic pay', present: /basic/i.test(JSON.stringify(salary.employee ?? salary)) });
  } catch (err) {
    items.push({ key: 'basic', label: 'Basic pay', present: null, note: err instanceof Error ? err.message : 'read failed' });
  }
  try {
    const st = await client.get<{ employee?: PayrollStatutory } & PayrollStatutory>(`/employees/${encodeURIComponent(sample.employee_id)}/statutory`);
    const s: PayrollStatutory = st.employee ?? st;
    const flag = (v: unknown) => (typeof v === 'boolean' ? v : null);
    items.push({ key: 'pf', label: 'PF', present: flag(s.is_eligible_for_pf) });
    items.push({ key: 'esi', label: 'ESI', present: flag(s.is_eligible_for_esi) });
    items.push({ key: 'pt', label: 'Professional tax', present: flag(s.is_eligible_for_pt ?? s.is_pt_applicable) });
    items.push({ key: 'lwf', label: 'Labour welfare fund', present: flag(s.is_eligible_for_lwf ?? s.is_lwf_applicable) });
  } catch (err) {
    items.push({ key: 'statutory', label: 'PF, ESI, PT, LWF', present: null, note: err instanceof Error ? err.message : 'read failed' });
  }
  return items;
}

export async function discoverPayroll(conn: ZohoConn): Promise<AppDiscovery> {
  if (!PAYROLL_DCS.includes(conn.dc)) return { app: 'payroll', used: false, orgs: [], entities: [] };
  let orgs: PayrollOrg[];
  try {
    orgs = await listPayrollOrgs(conn);
  } catch (err) {
    if (isNotLicensed(err)) return { app: 'payroll', used: false, orgs: [], entities: [] };
    return { app: 'payroll', used: false, error: err instanceof Error ? err.message : 'read failed', orgs: [], entities: [] };
  }
  if (orgs.length === 0) return { app: 'payroll', used: false, orgs: [], entities: [] };
  const out: DiscoveredOrg[] = [];
  for (const o of orgs) {
    const employees = await listEmployees(conn, o.organization_id).catch(() => [] as PayrollEmployee[]);
    const runs = await listPayRuns(conn, o.organization_id).catch(() => [] as PayrollRun[]);
    const items = await fieldCheckPayroll(conn, o.organization_id, employees[0]);
    out.push({
      app: 'payroll',
      externalOrgId: o.organization_id,
      name: o.name,
      gstin: pickGstin(o),
      pan: pickPan(o),
      counts: { employees: employees.length, payRuns: runs.length },
      fieldCheck: { checkedAt: new Date().toISOString(), items },
    });
  }
  return { app: 'payroll', used: true, orgs: out, entities: [] };
}
