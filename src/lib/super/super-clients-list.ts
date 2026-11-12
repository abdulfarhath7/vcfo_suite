import { stepCode, superAreaOf, superStageWord, superStateChip } from '@/components/super/overview/super-overview-format';
import { needsAttention, type SuperEngagementSummary, type SuperOverview } from '@/lib/super/super-overview';
import type { SuperInsights } from '@/lib/super/super-insights-model';

/**
 * The super admin's Clients list (`SuperProjects`). The page and the GL-06 Excel export on the
 * server filter the rows and work out the Admin and Next columns here, so the file matches the
 * screen. Rows stay in the server's urgency order.
 */

export type SuperClientsSlice = 'all' | 'attention' | 'firm' | 'client';

export interface SuperClientsFilters {
  filter: SuperClientsSlice;
  stage: string;
  area: string;
  admin: string;
  manager: string;
}

function matchesSlice(summary: SuperEngagementSummary, filter: SuperClientsSlice): boolean {
  if (filter === 'attention') return needsAttention(summary);
  if (filter === 'firm') return summary.currentStep?.owner === 'firm';
  if (filter === 'client') return summary.currentStep?.owner === 'client';
  return true;
}

/** The admin a manager reports to, by the manager's profile id (G-20). */
export type AdminOf = (managerId: string | null | undefined) => string | null;

/** `AdminOf` from the people roster and the reporting lines, as `useSuperStaff` builds it. */
export function adminNameResolver(
  people: ReadonlyArray<{ id: string; name: string; status?: string | null }>,
  lines: ReadonlyArray<{ managerId: string; adminId: string | null }>,
): AdminOf {
  const byId = new Map(people.filter((p) => p.status !== 'removed').map((p) => [p.id, p]));
  const adminOfManager = new Map<string, string>();
  for (const line of lines) {
    const admin = line.adminId ? byId.get(line.adminId) : undefined;
    if (admin) adminOfManager.set(line.managerId, admin.name);
  }
  return (managerId) => (managerId ? adminOfManager.get(managerId) : undefined) ?? null;
}

/** The clients the chips and the `?filter=` slice keep, in the server's order. */
export function filterSuperClients(
  engagements: readonly SuperEngagementSummary[],
  f: SuperClientsFilters,
  adminOf: AdminOf,
): SuperEngagementSummary[] {
  return engagements.filter(
    (summary) =>
      matchesSlice(summary, f.filter) &&
      (!f.stage || superStageWord(summary) === f.stage) &&
      (!f.area || superAreaOf(summary) === f.area) &&
      (!f.admin || (adminOf(summary.managerId) ?? 'Unassigned') === f.admin) &&
      (!f.manager || (summary.managerName ?? 'Unassigned') === f.manager),
  );
}

/**
 * The client's next date: the end of the current step's window (insights), else the earliest
 * open filing, from the insights read or the overview's 90-day filing window.
 */
export function superNextDue(overview: Pick<SuperOverview, 'filings'> | undefined, insights: Pick<SuperInsights, 'clients'> | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of insights?.clients ?? []) {
    const due = c.currentStepDue ?? c.nextDueDate;
    if (due) out.set(c.summary.id, due.slice(0, 10));
  }
  for (const filing of overview?.filings ?? []) {
    if (filing.status === 'filed') continue;
    if (insights?.clients.some((c) => c.summary.id === filing.engagementId)) continue;
    const current = out.get(filing.engagementId);
    if (!current || filing.dueDate < current) out.set(filing.engagementId, filing.dueDate);
  }
  return out;
}

export const SUPER_CLIENTS_EXPORT_HEAD = ['Client', 'Now at', 'Project lead', 'Progress', 'Admin', 'Manager', 'Stage', 'Next', 'Health'];

/** One client as export cells, in the order of `SUPER_CLIENTS_EXPORT_HEAD`. */
export function superClientExportCells(row: SuperEngagementSummary, nextDue: Map<string, string>, adminOf: AdminOf): Array<string | null> {
  return [
    row.companyName,
    [stepCode(row.currentStep?.id), row.currentStep?.title ?? 'Every step is done'].filter(Boolean).join(' '),
    row.leadName ?? null,
    `${row.progress.pct}%`,
    adminOf(row.managerId),
    row.managerName ?? 'Unassigned',
    superStageWord(row),
    nextDue.get(row.id) ?? null,
    superStateChip(row).word,
  ];
}
