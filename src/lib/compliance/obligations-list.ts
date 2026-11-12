import type { FilingRow } from '@/lib/compliance/filings';
import { groupObligations, matchesFilter, type ObligationClientRow, type ObligationFilter, type ObligationGroup } from '@/lib/compliance/obligation-groups';
import { areaLabel } from '@/lib/compliance/spectrum-status';
import type { PortalFiling } from '@/lib/client-portal/compliances';
import { ALL_COMPANIES, rowsForCompany } from '@/views/compliances/compliance-scope';
import { taskRowMatches, tasksByWeek, type Category, type TaskRowLike } from '@/views/compliances/tasks/task-model';

/**
 * Compliance › Obligations (`ObligationsView`). The page and the GL-06 Excel export on the server
 * pick, group and order the rows here, so the file has the rows the grids show, in their order.
 */

export type ObligationGroupBy = 'filing' | 'frequency' | 'law';
export type ObligationWorkType = 'all' | 'task' | 'meeting';

export const OBLIGATION_FREQUENCIES: Array<[string, string]> = [
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['half-yearly', 'Half-yearly'],
  ['annual', 'Annual'],
  ['one-time', 'One-time'],
];

/** One client row with its obligation, for the flat "by frequency" and "by law" lists. */
export interface ObligationFlatRow extends ObligationClientRow {
  group: ObligationGroup;
}

/** One grid group: an obligation (by filing), a law or a frequency. */
export interface ObligationBucket {
  id: string;
  label: string;
  rows: ObligationFlatRow[];
  /** The obligation of a "by filing" group. */
  group?: ObligationGroup;
}

/** This financial year's register and the last one's, without repeats (`useRegister`). */
export function mergeRegisterRows(last: readonly FilingRow[], current: readonly FilingRow[]): FilingRow[] {
  const seen = new Set<string>();
  const out: FilingRow[] = [];
  for (const row of [...last, ...current]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

/** The instance facts by id, the later year winning (`useRegister`). */
export function mergeRegisterDetails(last: readonly PortalFiling[], current: readonly PortalFiling[]): Map<string, PortalFiling> {
  const map = new Map<string, PortalFiling>();
  for (const f of [...last, ...current]) map.set(f.id, f);
  return map;
}

/** Every client row of every obligation, in band order. */
export function obligationFlatRows(groups: readonly ObligationGroup[]): ObligationFlatRow[] {
  return groups.flatMap((g) => g.rows.map((r) => ({ ...r, group: g })));
}

/** The rows the number strip keeps, grouped by filing, by law or by frequency. */
export function obligationBuckets(groups: readonly ObligationGroup[], shown: readonly ObligationFlatRow[], groupBy: ObligationGroupBy): ObligationBucket[] {
  if (groupBy === 'filing') {
    return groups.map((g) => ({ id: g.obligationId, label: g.name, group: g, rows: shown.filter((r) => r.group.obligationId === g.obligationId) }));
  }
  if (groupBy === 'law') {
    return [...new Set(groups.map((g) => g.area))]
      .sort((a, b) => a.localeCompare(b))
      .map((a) => ({ id: a, label: areaLabel(a), rows: shown.filter((r) => r.group.area === a) }));
  }
  return OBLIGATION_FREQUENCIES.map(([key, label]) => ({
    id: key,
    label,
    rows: shown.filter((r) => r.group.frequency.trim().toLowerCase() === key),
  }));
}

type TaskRow = TaskRowLike & { boardMeetingId?: string | null; companyName: string; owner: { name: string } | null; hidden?: boolean };

/** The non-statutory rows of the type tab and the number strip. Not-applicable rows stay hidden. */
export function shownObligationTasks<T extends TaskRow>(tasks: readonly T[], workType: ObligationWorkType, filter: ObligationFilter): T[] {
  return tasks
    .filter((t) => !t.hidden)
    .filter((t) => (workType === 'all' ? true : workType === 'meeting' ? Boolean(t.boardMeetingId) : !t.boardMeetingId))
    .filter((t) => taskRowMatches(t, filter));
}

export const OBLIGATIONS_EXPORT_HEAD = ['Obligation', 'Client', 'Law', 'Lead', 'Last filed', 'Status', 'Next due'];

/**
 * The export rows, in the order the grids show them: the statutory rows group by group, then (in
 * "All", or alone in "Non-statutory") the tasks week by week. A task has no law or last filed
 * date, so those cells stay empty.
 */
export function obligationsExportRows(buckets: readonly ObligationBucket[], shownTasks: readonly TaskRow[], cat: Category): Array<Array<string | null>> {
  const hasStat = cat !== 'ns';
  const hasNs = cat !== 'stat';
  return [
    ...(hasStat
      ? buckets.flatMap((g) =>
          g.rows.map((r) => [
            r.group.name,
            r.row.companyName,
            areaLabel(r.group.area),
            r.detail?.ownerName ?? null,
            r.lastFiled ?? null,
            r.word,
            r.nextDue ?? r.row.dueDate,
          ]),
        )
      : []),
    ...(hasNs
      ? tasksByWeek(shownTasks).flatMap((g) =>
          g.rows.map((t) => [t.title, t.companyName, 'Non-statutory', t.owner?.name ?? null, null, t.word, t.dueDate]),
        )
      : []),
  ];
}

/** The whole list from the scoped reads, as the page builds it (the server export uses this). */
export function obligationsListExport(input: {
  registerRows: FilingRow[];
  details: ReadonlyMap<string, PortalFiling>;
  tasks: readonly TaskRow[];
  companyId: string;
  groupBy: ObligationGroupBy;
  state: ObligationFilter;
  cat: Category;
  workType: ObligationWorkType;
  now: Date;
}): Array<Array<string | null>> {
  const rows = rowsForCompany(input.registerRows, input.companyId || ALL_COMPANIES);
  const groups = groupObligations(rows, input.details, input.now);
  const shown = obligationFlatRows(groups).filter((r) => matchesFilter(r, input.state, input.now));
  const buckets = obligationBuckets(groups, shown, input.groupBy);
  return obligationsExportRows(buckets, shownObligationTasks(input.tasks, input.workType, input.state), input.cat);
}
