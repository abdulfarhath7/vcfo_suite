/**
 * RECEIVABLES STAFF ROLES — who may open the manager area at all.
 *
 * A role in this list only gets past the door. Which sheet a person may read and edit is decided
 * in `src/db/repositories/receivables/shared.ts`: firm-wide admins see every sheet, a sheet's own
 * manager sees that sheet, and so does anyone named in `receivable_sheet_editors`. A project lead
 * (`intern`) is in the list so that a lead can be added to a sheet as an editor; a lead who is on
 * no sheet sees the "no sheet is assigned to you" notice and nothing else.
 */
export const RECEIVABLES_STAFF_ROLES = ['super_admin', 'admin', 'manager', 'intern'] as const;

const SET = new Set<string>(RECEIVABLES_STAFF_ROLES);

export function isReceivablesStaffRole(role: string | null | undefined): boolean {
  return Boolean(role) && SET.has(role as string);
}
