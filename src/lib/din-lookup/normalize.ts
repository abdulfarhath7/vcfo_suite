import { parseIndianDate, str } from '@/lib/lookup/fields';
import type { DirectorAssociation, NormalizedDinData } from './types';

/** "company" / "llp" when the source says so, inferred from the number when it does not. */
function entityTypeOf(raw: unknown, cin: string): DirectorAssociation['entityType'] {
  const value = str(raw).trim().toLowerCase();
  if (value === 'llp') return 'llp';
  if (value === 'company') return 'company';
  // An LLPIN starts with three letters (AAA-1234); a CIN or FCRN starts with a letter then digits.
  if (/^[A-Z]{3}-?\d/i.test(cin)) return 'llp';
  if (/^[A-Z]\d/i.test(cin)) return 'company';
  return '';
}

/** A dash is how the MCA report writes "nothing here"; it is not a value. */
function cell(v: unknown): string {
  const s = str(v).trim();
  return s === '-' || s === '--' || s === 'NA' || s === 'N/A' ? '' : s;
}

function normalizeAssociation(item: unknown): DirectorAssociation | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const cin = cell(row.cin ?? row.llpin ?? row.cin_llpin ?? row.cin_fcrn ?? '').toUpperCase();
  const companyName = cell(row.com_name ?? row.company_name ?? row.companyName ?? row.llp_name ?? row.name ?? '');
  if (!cin && !companyName) return null;
  return {
    cin,
    companyName,
    designation: cell(row.designation ?? row.desig ?? ''),
    appointmentDate: parseIndianDate(cell(row.appointment ?? row.appointment_date ?? row.original_appointment ?? row.doa ?? '')),
    entityType: entityTypeOf(row.entity_type ?? row.entityType, cin),
    companyStatus: cell(row.company_status ?? row.llp_status ?? row.status ?? ''),
    appointmentCategory: cell(row.appointment_category ?? row.category ?? ''),
    currentDesignationDate: parseIndianDate(cell(row.current_designation_date ?? row.appointment_current_designation ?? '')),
    cessationDate: parseIndianDate(cell(row.cessation ?? row.cessation_date ?? row.date_of_cessation ?? '')),
  };
}

/**
 * Standing appointments first, then the ceased ones. Inside each group the newest appointment
 * leads; an undated row sits last, then alphabetical, so the order never jumps about.
 */
function byAppointmentDesc(a: DirectorAssociation, b: DirectorAssociation): number {
  const ceased = Number(Boolean(a.cessationDate)) - Number(Boolean(b.cessationDate));
  if (ceased !== 0) return ceased;
  // Among the ceased, the one that ended most recently leads: that is the one a lead looks for.
  if (a.cessationDate && b.cessationDate && a.cessationDate !== b.cessationDate) {
    return a.cessationDate < b.cessationDate ? 1 : -1;
  }
  if (a.appointmentDate && b.appointmentDate && a.appointmentDate !== b.appointmentDate) {
    return a.appointmentDate < b.appointmentDate ? 1 : -1;
  }
  if (a.appointmentDate !== b.appointmentDate) return a.appointmentDate ? -1 : 1;
  return a.companyName.localeCompare(b.companyName);
}

/**
 * Turn an answer about one DIN into {@link NormalizedDinData}, whichever source gave it: the
 * FalconeBiz `director_details` API, or a capture of the MCA "View Director / Designated
 * Partner Details" report. The record is unwrapped first when it arrives inside an envelope,
 * and every field is read through a few spellings because neither shape is contractual.
 */
export function normalizeDinResponse(raw: Record<string, unknown>, requestedDin: string): NormalizedDinData {
  const data = (raw.data ?? raw.result ?? raw.director_details ?? raw) as Record<string, unknown>;

  const lists = [data.association, data.associations, data.companies, data.llps].filter(Array.isArray) as unknown[][];
  const associations = lists
    .flat()
    .map(normalizeAssociation)
    .filter((row): row is DirectorAssociation => row !== null);

  // MCA lists a company twice when the person held two designations in it, so the designation
  // and the dates are part of what makes a row distinct; only a true repeat is dropped.
  const seen = new Set<string>();
  const unique = associations.filter((row) => {
    const key = `${row.cin}|${row.designation}|${row.appointmentDate}|${row.cessationDate}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    din: cell(data.din ?? raw.din ?? requestedDin),
    name: cell(data.name ?? data.director_name ?? data.dir_name ?? ''),
    dinStatus: cell(data.din_status ?? data.status ?? ''),
    approveDate: parseIndianDate(cell(data.approve_date ?? data.approval_date ?? data.approvedDate ?? '')),
    dir3Kyc: cell(data.dir3_kyc ?? data.dir_3_kyc ?? data.kyc_status ?? ''),
    providerUpdatedAt: cell(data.updated_at ?? data.updatedAt ?? raw.updated_at ?? ''),
    associations: unique.sort(byAppointmentDesc),
  };
}

/** Does this answer hold a director at all? An unknown DIN comes back as an empty record. */
export function hasDirectorRecord(data: NormalizedDinData): boolean {
  return Boolean(data.name || data.dinStatus || data.associations.length > 0);
}

/** Standing appointments, the ones that matter for a DIR-3 or a new SPICe+ filing. */
export function currentAssociations(data: NormalizedDinData): DirectorAssociation[] {
  return data.associations.filter((a) => !a.cessationDate);
}

export function pastAssociations(data: NormalizedDinData): DirectorAssociation[] {
  return data.associations.filter((a) => a.cessationDate);
}
