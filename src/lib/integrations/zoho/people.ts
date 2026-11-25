import type { FieldCheckItem } from '@/db/schema-integrations';
import { ZohoApiError } from './client';
import { isNotLicensed } from './books';
import { clientFor, isoDay, type AppDiscovery, type ZohoConn } from './types';

/**
 * Zoho People reader (people.zoho.<dc>/people/api). A People account is one organisation, so
 * discovery gives one org row; its name is the account's company when the employee form carries
 * one. People answers inside `response`, with `status: 1` on failure.
 */
type PeopleReply<T> = { response?: { status?: number; message?: string; result?: T; errors?: { message?: string } } };

export type PeopleRecord = Record<string, unknown>;

function result<T>(body: PeopleReply<T>): T | undefined {
  const r = body.response;
  if (r && r.status === 1) throw new ZohoApiError(r.errors?.message || r.message || 'people_error', 400);
  return r?.result;
}

/** Employee records, 200 a page (`sIndex` is 1-based). */
export async function listPeopleEmployees(conn: ZohoConn, maxPages = 20): Promise<PeopleRecord[]> {
  const client = clientFor('people', conn);
  const out: PeopleRecord[] = [];
  for (let page = 0; page < maxPages; page++) {
    const body = await client.get<PeopleReply<Array<Record<string, PeopleRecord[]>>>>('/forms/employee/getRecords', { sIndex: page * 200 + 1, limit: 200 });
    const rows = (result(body) ?? []).flatMap((r) => Object.values(r).flat());
    out.push(...rows);
    if (rows.length < 200) break;
  }
  return out;
}

export async function fieldCheckPeople(conn: ZohoConn, sample: PeopleRecord | undefined): Promise<FieldCheckItem[]> {
  if (!sample) return [{ key: 'employees', label: 'Employees', present: false, note: 'No employee yet' }];
  const client = clientFor('people', conn);
  const items: FieldCheckItem[] = [];
  const empId = String(sample.EmployeeID ?? sample.Employee_ID ?? '');
  try {
    const body = await client.get<PeopleReply<unknown>>('/attendance/getUserReport', {
      sdate: isoDay(14),
      edate: isoDay(0),
      dateFormat: 'yyyy-MM-dd',
      ...(empId ? { empId } : {}),
    });
    const r = result(body);
    const days = r && typeof r === 'object' ? Object.keys(r as object).length : 0;
    items.push({ key: 'attendance', label: 'Daily attendance', present: days > 0, note: days ? undefined : 'No attendance in the last 14 days' });
  } catch (err) {
    items.push({ key: 'attendance', label: 'Daily attendance', present: null, note: err instanceof Error ? err.message : 'read failed' });
  }
  try {
    const body = await client.get<PeopleReply<unknown[]>>('/forms/leave/getRecords', { sIndex: 1, limit: 1 });
    const rows = result(body) ?? [];
    items.push({ key: 'leave', label: 'Leave', present: rows.length > 0, note: rows.length ? undefined : 'No leave record yet' });
  } catch (err) {
    items.push({ key: 'leave', label: 'Leave', present: null, note: err instanceof Error ? err.message : 'read failed' });
  }
  return items;
}

export async function discoverPeople(conn: ZohoConn): Promise<AppDiscovery> {
  let employees: PeopleRecord[];
  try {
    employees = await listPeopleEmployees(conn);
  } catch (err) {
    if (isNotLicensed(err) || (err instanceof ZohoApiError && err.status === 400)) return { app: 'people', used: false, orgs: [], entities: [] };
    return { app: 'people', used: false, error: err instanceof Error ? err.message : 'read failed', orgs: [], entities: [] };
  }
  if (employees.length === 0) return { app: 'people', used: false, orgs: [], entities: [] };
  const company = employees.map((e) => e.Company ?? e.Organization ?? e.Entity).find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  const items = await fieldCheckPeople(conn, employees[0]);
  return {
    app: 'people',
    used: true,
    orgs: [{ app: 'people', externalOrgId: 'people', name: company?.trim() || 'Zoho People', gstin: null, pan: null, counts: { employees: employees.length }, fieldCheck: { checkedAt: new Date().toISOString(), items } }],
    entities: [],
  };
}
