import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { listChecklistIndex, listEngagements, toAppEngagement } from '@/db/repositories/engagements';
import { getFilings } from '@/db/repositories/filings';
import type { StaffData } from './staff';

/**
 * Firm-wide read for admin / super admin tools, through the same scoped
 * repositories the dashboards use (admin scope is firm-wide by role).
 */
export async function loadStaffData(ctx: AuthContext, now: Date = new Date()): Promise<StaffData> {
  const [rows, index, filings] = await Promise.all([
    listEngagements(ctx),
    listChecklistIndex(ctx),
    getFilings(ctx).catch((error) => {
      console.warn('[ask-vcfo] staff filings unavailable', error);
      return { rows: [], companies: [] };
    }),
  ]);
  const engagements = rows
    .filter((row) => !row.deletedAt)
    .map((row) => {
      const app = toAppEngagement(row);
      return { dbId: row.id, engagement: app, state: index[app.id] ?? {} };
    });
  return { engagements, filings: filings.rows, now };
}
