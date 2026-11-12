import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { engagementChangedAt } from '@/components/staff/today/today-rows';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import { internCompanyPhaseProgress } from '@/lib/intern/intern-work';
import {
  HEALTH_RANK,
  STAGE_WORD,
  clientRowFacts,
  nextScheduleDate,
  windowEndsThisWeek,
  type ClientRowFacts,
} from '@/lib/projects/client-row-facts';
import { deriveStuckReason, type StuckReason } from '@/lib/projects/project-stuck';

/**
 * The admin's firm-wide project list (`FirmProjectsPanel`: Work › Projects and the home card).
 * The page and the GL-06 Excel export on the server build the rows here, so the file has the
 * same rows, in the same order, with the same columns as the grid.
 */

export type FirmProjectPhase = 'all' | 'Pre-Incorporation' | 'Post-Incorporation';

export interface FirmProjectFilters {
  phase: FirmProjectPhase;
  stuck: StuckReason | '';
  /** A manager id, or "unassigned". Empty means every manager. */
  manager: string;
  show: string;
  scope: string;
  health: string;
}

export const NO_FIRM_PROJECT_FILTERS: FirmProjectFilters = { phase: 'all', stuck: '', manager: '', show: '', scope: '', health: '' };

export interface FirmProjectRow {
  eng: Engagement;
  reason: StuckReason;
  step: string;
  phaseDone: number[];
  phaseTotals: number[];
  phaseNames: string[];
  pct: number;
  leadNames: string[];
  changedAt?: string;
  facts: ClientRowFacts;
}

/** The engagements the filters keep, as rows, worst health first and then by name. */
export function firmProjectRows(
  engagements: readonly Engagement[],
  stateOf: (e: Engagement) => Record<string, ChecklistItemStateSlice>,
  leadName: (id: string) => string | undefined,
  f: FirmProjectFilters,
  now: Date = new Date(),
): FirmProjectRow[] {
  // Every client shows, incorporating and compliance (prototype admin Clients).
  return engagements
    .filter((e) => (f.phase === 'all' ? true : e.stage === f.phase))
    .filter((e) => (!f.manager ? true : (e.managerId ?? e.adminId ?? 'unassigned') === f.manager))
    .filter((e) => (!f.scope ? true : isIncorporated(e, stateOf(e)) === (f.scope === 'compliance')))
    .map((e) => {
      const state = stateOf(e);
      const progress = internCompanyPhaseProgress(e, state, now);
      const leadIds = [...new Set([e.internId, ...(e.leadIds ?? [])].filter((id): id is string => Boolean(id)))];
      const done = progress.phases.reduce((n, p) => n + p.done, 0);
      const total = progress.phases.reduce((n, p) => n + p.total, 0);
      return {
        eng: e,
        reason: deriveStuckReason(e, state),
        step: progress.currentLabel.split(' · ').slice(0, 2).join(' · '),
        phaseDone: progress.phases.map((p) => p.done),
        phaseTotals: progress.phases.map((p) => p.total),
        phaseNames: progress.phases.map((p) => p.title),
        pct: total ? Math.round((done / total) * 100) : 0,
        leadNames: leadIds.map((id) => leadName(id)).filter((n): n is string => Boolean(n)),
        changedAt: engagementChangedAt(state),
        facts: clientRowFacts(e, state, now),
      };
    })
    .filter((r) => (!f.stuck ? true : r.reason === f.stuck))
    .filter((r) => (!f.health ? true : r.facts.health === f.health))
    .filter((r) =>
      f.show === 'overdue'
        ? r.eng.health === 'overdue'
        : f.show === 'week'
          ? windowEndsThisWeek(r.eng.schedule, now)
          : f.show === 'waiting'
            ? r.reason === 'waiting_client'
            : f.show === 'stuck'
              ? r.reason !== 'on_track'
              : true,
    )
    .sort((a, b) => HEALTH_RANK[a.facts.health] - HEALTH_RANK[b.facts.health] || a.eng.companyName.localeCompare(b.eng.companyName));
}

/** The manager's name for the Manager column: "Unassigned" without one. */
export function firmManagerName(managers: ReadonlyArray<{ id: string; name: string }> | undefined, id: string | undefined | null): string {
  if (!id) return 'Unassigned';
  return managers?.find((m) => m.id === id)?.name ?? 'Project manager';
}

export const FIRM_PROJECTS_EXPORT_HEAD = ['Client', 'Now at', 'Project lead', 'Progress', 'Manager', 'Stage', 'Next', 'Health'];

/** One row as export cells, in the order of `FIRM_PROJECTS_EXPORT_HEAD`. */
export function firmProjectExportCells(r: FirmProjectRow, managerName: (id: string | undefined | null) => string, todayIso: string): Array<string | null> {
  return [
    r.eng.companyName,
    r.facts.now ? `${r.facts.now.code} ${r.facts.now.title}` : null,
    r.leadNames[0] ?? null,
    `${r.pct}%`,
    managerName(r.eng.managerId ?? r.eng.adminId),
    STAGE_WORD[r.facts.stage],
    nextScheduleDate(r.eng.schedule, todayIso),
    r.facts.health,
  ];
}
