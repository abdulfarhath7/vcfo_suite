import type { Role } from '@/lib/auth';

/**
 * Only the firm admin imports a financial year's statutory calendar. The owner chose this on
 * 11 Nov 2026: a super admin, a manager and a lead read the calendar but cannot replace it.
 */
export function canImportStatutoryCalendar(role: Role | string | undefined): boolean {
  return role === 'admin';
}
