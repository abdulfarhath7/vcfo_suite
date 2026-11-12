import type { Engagement } from '@/data/engagements';
import type { ChipTone } from '@/components/ui/spectrum-chip';
import { workItemChangedAt } from '@/components/staff/today/today-rows';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import type { DirectoryPerson } from '@/lib/email/directory-filter';
import { engagementSetupProgressPercent } from '@/lib/intern/intern-dashboard';
import {
  filterInternWork,
  internCompanyPhaseProgress,
  type InternCompanyPhaseProgress,
  type InternWorkItem,
} from '@/lib/intern/intern-work';
import { STAGE_WORD, clientRowFacts, nextInWeek, type ClientRowFacts } from '@/lib/projects/client-row-facts';

/**
 * The lead's Clients list (`InternClients`). The page and the GL-06 Excel export on the server
 * build the rows and apply the filters here, so the file matches the screen.
 */

export type LeadClientRow = {
  e: Engagement;
  pct: number;
  progress: InternCompanyPhaseProgress;
  /** Stage, Now, next date and health, derived from the step state (`clientRowFacts`). */
  facts: ClientRowFacts;
  /** The lead's work items on this client, for the views, Remind and the change time. */
  items: InternWorkItem[];
  /** People who work on the client (managers and leads), from the staff directory. */
  people: string[];
  changedAt?: string;
};

export interface LeadClientFilters {
  stage: string;
  show: string;
  health: string;
  nextWin: string;
}

/** One row per client of the lead, with the people from the staff directory who work on it. */
export function leadClientRows(input: {
  myEngagements: readonly Engagement[];
  stateOf: (e: Engagement) => Record<string, ChecklistItemStateSlice>;
  workItems: readonly InternWorkItem[];
  directory: readonly DirectoryPerson[];
  now: Date;
}): LeadClientRow[] {
  const firm = input.directory.filter(
    (p) => p.kind === 'firm' && p.status !== 'inactive' && (p.role === 'manager' || p.role === 'intern'),
  );
  return input.myEngagements.map((e) => {
    const state = input.stateOf(e);
    const items = input.workItems.filter((i) => i.engagementId === e.id);
    const people = firm.filter((p) => p.projects.some((pr) => pr.id === e.id || pr.slug === e.slug)).map((p) => p.name);
    const stamps = items.map((i) => workItemChangedAt(i, i.catalogId ? state[i.catalogId] : undefined)).filter(Boolean) as string[];
    return {
      e,
      pct: engagementSetupProgressPercent(state),
      progress: internCompanyPhaseProgress(e, state, input.now),
      facts: clientRowFacts(e, state, input.now),
      items,
      people,
      changedAt: stamps.sort().at(-1),
    };
  });
}

/** Whether a client has work in the view: overdue, due this week, or waiting on the client. */
function inShow(show: string, items: InternWorkItem[], now: Date): boolean {
  if (show === 'overdue') return filterInternWork(items, { focus: 'overdue' }, now).length > 0;
  if (show === 'week') return filterInternWork(items, { focus: 'due' }, now).some((i) => i.kind !== 'done');
  if (show === 'waiting') return filterInternWork(items, { tag: 'client' }, now).length > 0;
  return true;
}

/** The rows the stage tabs, the saved view and the Health and Next chips keep. */
export function filterLeadClients(all: readonly LeadClientRow[], f: LeadClientFilters, now: Date): LeadClientRow[] {
  const todayIso = now.toISOString().slice(0, 10);
  return all.filter(
    (r) =>
      (!f.stage || r.facts.stage === f.stage) &&
      inShow(f.show, r.items, now) &&
      (!f.health || r.facts.health === f.health) &&
      nextInWeek(r.facts.next, todayIso, f.nextWin),
  );
}

/** Lead client status (prototype `clientStatus`): Stuck, Not started, In progress or Done. */
export function leadClientStatus(r: Pick<LeadClientRow, 'progress'>): { word: string; tone: ChipTone } {
  if (r.progress.stuck) return { word: 'Stuck', tone: 'bad' };
  const done = r.progress.phases.reduce((n, p) => n + p.done, 0);
  const total = r.progress.phases.reduce((n, p) => n + p.total, 0);
  if (total > 0 && done >= total) return { word: 'Done', tone: 'ok' };
  if (done === 0) return { word: 'Not started', tone: 'idle' };
  return { word: 'In progress', tone: 'prog' };
}

/** Steps done of phases 1 to 3, "12/25". */
export function leadFirstPhasesSteps(r: Pick<LeadClientRow, 'progress'>): string {
  const first = r.progress.phases.slice(0, 3);
  return `${first.reduce((n, p) => n + p.done, 0)}/${first.reduce((n, p) => n + p.total, 0)}`;
}

export const LEAD_CLIENTS_EXPORT_HEAD = ['Client', 'Contact', 'Stage', 'Now', 'Team', 'Phases 1–3', 'Status'];

/** One client as export cells, in the order of `LEAD_CLIENTS_EXPORT_HEAD`. */
export function leadClientExportCells(r: LeadClientRow): Array<string | null> {
  return [
    r.e.companyName,
    r.e.clientDisplayName ?? null,
    STAGE_WORD[r.facts.stage],
    r.facts.now ? `${r.facts.now.code} ${r.facts.now.title}` : null,
    r.people.join(', '),
    leadFirstPhasesSteps(r),
    leadClientStatus(r).word,
  ];
}
