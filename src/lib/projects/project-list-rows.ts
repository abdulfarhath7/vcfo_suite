import type { Engagement, TaskInstance } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { engagementChangedAt } from '@/components/staff/today/today-rows';
import { internCompanyPhaseProgress } from '@/lib/intern/intern-work';
import { STAGE_WORD, clientRowFacts, nextInWeek, windowEndsThisWeek, type ClientRowFacts } from '@/lib/projects/client-row-facts';
import { deriveStuckReason, type StuckReason } from '@/lib/projects/project-stuck';

/**
 * The manager's Projects list (`Projects` and `ProjectsView`). The page and the GL-06 Excel
 * export on the server build the items and apply the filters here, so the file matches the
 * screen.
 */

export type ProjectPerson = { id: string; name: string; initials?: string };

export interface ProjectListItem {
  e: Engagement;
  pct: number;
  done: number;
  total: number;
  intern: ProjectPerson | undefined;
  leads?: ProjectPerson[];
  stuck: StuckReason;
  /** ST5 phase track (four bars sized by step count). */
  phases?: Array<{ done: number; total: number; title: string }>;
  /** E-08: the latest step edit, submit, review or delivery time. */
  changedAt?: string;
  /** Stage, Now, next date and health from the step state (`clientRowFacts`). */
  facts: ClientRowFacts;
}

/** Every project, incorporating and compliance, with its tasks, leads and step facts. */
export function projectListItems(
  engagements: readonly Engagement[],
  tasks: readonly TaskInstance[],
  owners: readonly ProjectPerson[],
  teamMembers: readonly ProjectPerson[],
  stateOf: (e: Engagement) => Record<string, ChecklistItemStateSlice>,
  now: Date = new Date(),
): ProjectListItem[] {
  return engagements.map((e) => {
    const eTasks = tasks.filter((t) => t.engagementId === e.id);
    const done = eTasks.filter((t) => t.status === 'completed').length;
    const pct = eTasks.length ? Math.round((done / eTasks.length) * 100) : 0;
    const leadIds = e.leadIds && e.leadIds.length > 0 ? e.leadIds : e.internId?.trim() ? [e.internId] : [];
    const leads = leadIds
      .map((id) => owners.find((t) => t.id === id) ?? teamMembers.find((t) => t.id === id))
      .filter(Boolean) as ProjectPerson[];
    const state = stateOf(e);
    const progress = internCompanyPhaseProgress(e, state, now);
    return {
      e,
      pct,
      phases: progress.phases.map((p) => ({ done: p.done, total: p.total, title: p.title })),
      changedAt: engagementChangedAt(state),
      done,
      total: eTasks.length,
      intern: leads[0],
      leads,
      stuck: deriveStuckReason(e, state),
      facts: clientRowFacts(e, state, now),
    };
  });
}

export interface ProjectListFilters {
  show: string;
  stage: string;
  health: string;
  nextWin: string;
}

/** Which saved-view filter a project passes (E-06). */
function inShow(show: string, item: ProjectListItem, now: Date): boolean {
  if (show === 'overdue') return item.e.health === 'overdue';
  if (show === 'week') return windowEndsThisWeek(item.e.schedule, now);
  if (show === 'waiting') return item.stuck === 'waiting_client';
  return true;
}

/** The items the table's filters keep, in the list's order. */
export function filterProjectList(items: readonly ProjectListItem[], f: ProjectListFilters, now: Date = new Date()): ProjectListItem[] {
  const todayIso = now.toISOString().slice(0, 10);
  return items.filter(
    (item) =>
      inShow(f.show, item, now) &&
      (!f.stage || item.facts.stage === f.stage) &&
      (!f.health || item.facts.health === f.health) &&
      nextInWeek(item.facts.next, todayIso, f.nextWin),
  );
}

export function leadLabelOf(item: ProjectListItem): string {
  return item.leads && item.leads.length > 0 ? item.leads.map((l) => l.name).join(', ') : (item.intern?.name ?? 'Unassigned');
}

export const PROJECTS_EXPORT_HEAD = ['Client', 'Contact', 'Stage', 'Now', 'Project leads', 'All steps', 'Status'];

/** One project as export cells, in the order of `PROJECTS_EXPORT_HEAD`. */
export function projectExportCells(item: ProjectListItem): Array<string | null> {
  return [
    item.e.companyName,
    item.e.clientDisplayName ?? null,
    STAGE_WORD[item.facts.stage],
    item.facts.now ? `${item.facts.now.code} ${item.facts.now.title}` : null,
    leadLabelOf(item),
    `${item.facts.done}/${item.facts.total}`,
    item.facts.health,
  ];
}
