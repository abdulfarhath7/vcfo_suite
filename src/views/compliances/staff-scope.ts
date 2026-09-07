import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import { filingStatus, type FilingRow, type FilingStatus } from '@/lib/filings';

/**
 * STAFF (FIRM-SCOPE) AUDIENCE for the shared compliance module.
 *
 * The shared Calendar / Filings views are built once and rendered by scope.
 * `audience: 'client'` (the default) is one engagement with no picker;
 * `audience: 'staff'` is the portfolio the caller's `AuthContext` already
 * scoped, plus the company picker, the statutory grid and the status filter
 * that the firm's old tracker had.
 *
 * Everything here is derived from lists already in hand — the engagement
 * roster from `useApp()` and the register rows from `/api/filings` — so no
 * new query and no second access rule. `isIncorporated` stays the only source
 * of the pre-COI flag.
 */

export type ComplianceAudience = 'client' | 'staff';

export const ALL_COMPANIES = 'all';

export interface ComplianceStaffScope {
  engagements: Engagement[];
  /** Ids of the engagements that fail `isIncorporated` — derived once by the caller. */
  preIncorporationIds: ReadonlySet<string>;
}

export type FilingStatusFilter = 'all' | FilingStatus;

export const FILING_STATUS_FILTERS: readonly FilingStatusFilter[] = [
  'all',
  'due-soon',
  'upcoming',
  'overdue',
  'filed',
];

export function isFilingStatusFilter(value: string | null | undefined): value is FilingStatusFilter {
  return FILING_STATUS_FILTERS.includes(value as FilingStatusFilter);
}

/** Pre-COI ids off the roster in hand — the one place the staff wrapper asks. */
export function preIncorporationIdsOf(
  engagements: readonly Engagement[],
  stateFor: (engagement: Engagement) => Record<string, ChecklistItemStateSlice> | undefined,
): ReadonlySet<string> {
  return new Set(
    engagements.filter((e) => !isIncorporated(e, stateFor(e) ?? null)).map((e) => e.id),
  );
}

/** Narrow the scoped register to one company; `'all'` leaves it whole. */
export function rowsForCompany(rows: FilingRow[], companyId: string): FilingRow[] {
  if (companyId === ALL_COMPANIES) return rows;
  return rows.filter((row) => row.engagementId === companyId);
}

/** Keep only rows whose derived status matches; `'all'` leaves them whole. */
export function rowsForStatus(
  rows: FilingRow[],
  status: FilingStatusFilter,
  now: Date,
): FilingRow[] {
  if (status === 'all') return rows;
  return rows.filter((row) => filingStatus(row, now) === status);
}

/** The engagement the picker is narrowed to, or null on "All companies". */
export function pickedCompany(
  engagements: readonly Engagement[],
  companyId: string,
): Engagement | null {
  if (companyId === ALL_COMPANIES) return null;
  return engagements.find((e) => e.id === companyId) ?? null;
}

/** A company id that is not in the roster falls back to the whole portfolio. */
export function normaliseCompanyParam(
  value: string | null | undefined,
  engagements: readonly Engagement[],
): string {
  if (!value || value === ALL_COMPANIES) return ALL_COMPANIES;
  return engagements.some((e) => e.id === value) ? value : ALL_COMPANIES;
}
