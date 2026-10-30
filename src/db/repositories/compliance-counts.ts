import 'server-only';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceInstanceWorkflow, complianceInstances } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { currentFyRange, statusWord } from '@/lib/compliance-tasks/model';
import { scopeIds, today } from '@/db/repositories/compliance-tasks/shared';
import { taskCounts } from '@/db/repositories/compliance-tasks';
import { statutoryStage } from '@/db/repositories/compliance-statutory';

/**
 * COMPLIANCE COUNTS — the numbers behind the category switch on Obligations, Calendar and
 * Filings (S-1, S-8, C-1, F-1, F-3). Same scope as every other compliance read
 * (`listScopedEngagementIds`, an explicit engagement access-checked); a client counts only its
 * own engagement and only the tasks shared with it. Not-applicable rows are left out.
 */

export interface CategoryCounts {
  total: number;
  open: number;
  done: number;
  overdue: number;
  dueSoon: number;
}

export interface ComplianceCountsDto {
  range: { from: string; to: string };
  all: CategoryCounts;
  statutory: CategoryCounts;
  nonStatutory: CategoryCounts;
}

/** Statutory items count Due soon inside the default lead time of 10 days when no activity says otherwise. */
const STATUTORY_DUE_SOON = 10;

export async function getComplianceCounts(
  ctx: AuthContext,
  q: { engagementId?: string | null; from?: string | null; to?: string | null } = {},
): Promise<ComplianceCountsDto> {
  const day = today();
  const fy = currentFyRange(day);
  const range = { from: q.from || fy.from, to: q.to || fy.to };
  const empty = (): CategoryCounts => ({ total: 0, open: 0, done: 0, overdue: 0, dueSoon: 0 });
  const ids = await scopeIds(ctx, q.engagementId);
  if (ids.length === 0) return { range, all: empty(), statutory: empty(), nonStatutory: empty() };

  const rows = await db
    .select({
      status: complianceInstances.status,
      filedOn: complianceInstances.filedOn,
      dueDate: complianceInstances.dueDate,
      stage: complianceInstanceWorkflow.stage,
    })
    .from(complianceInstances)
    .leftJoin(complianceInstanceWorkflow, eq(complianceInstanceWorkflow.instanceId, complianceInstances.id))
    .where(and(inArray(complianceInstances.engagementId, ids), gte(complianceInstances.dueDate, range.from), lte(complianceInstances.dueDate, range.to)));

  const statutory = empty();
  for (const r of rows) {
    const stage = statutoryStage(r, r.stage ? { stage: r.stage } : null);
    if (stage === 'not-applicable') continue;
    statutory.total += 1;
    if (stage === 'completed') {
      statutory.done += 1;
      continue;
    }
    statutory.open += 1;
    const word = statusWord(stage, r.dueDate, STATUTORY_DUE_SOON, day);
    if (word === 'Overdue') statutory.overdue += 1;
    if (word === 'Due soon') statutory.dueSoon += 1;
  }
  const nonStatutory = await taskCounts(ctx, { engagementId: q.engagementId, from: range.from, to: range.to });
  const all: CategoryCounts = {
    total: statutory.total + nonStatutory.total,
    open: statutory.open + nonStatutory.open,
    done: statutory.done + nonStatutory.done,
    overdue: statutory.overdue + nonStatutory.overdue,
    dueSoon: statutory.dueSoon + nonStatutory.dueSoon,
  };
  return { range, all, statutory, nonStatutory };
}
