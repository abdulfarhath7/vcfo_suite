import type { ComplianceFiling } from '@/data/compliance';
import type { DocRequest, Engagement, TaskInstance } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { computeAllFilings } from '@/lib/compliance/compliance-store';
import { complianceEngagementsForRole } from '@/lib/compliance/incorporation-state';
import { buildInternWorkItems, internAssignedToEngagement, type InternWorkItem } from '@/lib/intern/intern-work';
import type { CalendarChange } from '@/lib/watch/calendar-proposal';

/**
 * A project lead's own work items, as `useInternPortfolio` builds them in the browser and the
 * GL-06 Excel export of the lead's Clients builds them on the server. Keeping the steps here
 * means both see the same overdue, due-this-week and waiting-on-client items.
 */

type StateOf = (engagement: Engagement) => Record<string, ChecklistItemStateSlice>;

/** The engagements a lead is assigned to (none without an intern id). */
export function leadEngagements(engagements: readonly Engagement[], internId: string): Engagement[] {
  return internId ? engagements.filter((e) => internAssignedToEngagement(e, internId)) : [];
}

/**
 * The lead's compliance filings: only incorporated companies have them (`isIncorporated`), with
 * the approved calendar changes applied (`useComplianceFilings` in the browser).
 */
export function leadComplianceFilings(myEngagements: readonly Engagement[], stateOf: StateOf, changes: readonly CalendarChange[]): ComplianceFiling[] {
  const incorporated = complianceEngagementsForRole('intern', myEngagements, stateOf);
  const states: Record<string, Record<string, ChecklistItemStateSlice>> = {};
  for (const e of incorporated) states[e.id] = stateOf(e);
  return computeAllFilings(incorporated, states, changes);
}

/** Manager-set compliance windows on the register rows, keyed by the shared instance key. */
export function leadFilingWindows(
  rows: ReadonlyArray<{ engagementId: string; obligationId: string; dueDate: string; periodLabel?: string | null; windowFrom?: string | null; windowTo?: string | null }>,
): Record<string, { from: string; to: string }> {
  const out: Record<string, { from: string; to: string }> = {};
  for (const row of rows) {
    if (!row.windowFrom || !row.windowTo) continue;
    out[`${row.engagementId}:${row.obligationId}:${row.dueDate}:${row.periodLabel ?? ''}`] = { from: row.windowFrom, to: row.windowTo };
  }
  return out;
}

/** The work items of one lead: steps, filings, client questions and the tasks assigned to them. */
export function leadWorkItems(input: {
  myEngagements: Engagement[];
  stateOf: StateOf;
  internId: string;
  userId: string;
  filings: ComplianceFiling[];
  filingWindows: Record<string, { from: string; to: string }>;
  requests: readonly DocRequest[];
  tasks: readonly TaskInstance[];
  now?: Date;
}): InternWorkItem[] {
  const ids = new Set(input.myEngagements.map((e) => e.id));
  return buildInternWorkItems({
    engagements: input.myEngagements,
    getChecklistState: input.stateOf,
    internId: input.internId,
    filings: input.filings,
    filingWindows: input.filingWindows,
    requests: input.requests.filter((r) => ids.has(r.engagementId)),
    // Tasks a manager assigned to this lead, and client questions handed to them (G-12). Rows
    // with a checklist key mirror a step and are already step items.
    tasks: input.userId ? input.tasks.filter((t) => t.assigneeId === input.userId && !t.checklistKey) : [],
    now: input.now,
  });
}
