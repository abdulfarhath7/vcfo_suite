import { regOf, type Regulator } from '@/components/ui/spectrum-chip';
import { filingStatus, monthKeyOf, sortByDueDate, type FilingRow, type FilingStatus } from '@/lib/compliance/filings';
import type { PortalFiling } from '@/lib/client-portal/compliances';
import { filingMonths, type FilingRecord } from '@/lib/metrics/filing-metrics';
import { daysUntil, filingWord, plainDate, worstStatus } from '@/views/compliances/spectrum-status';
import { waitingOnClient } from '@/views/compliances/obligation-groups';

/**
 * THE STAFF FILINGS BOARD (prototype C-05 to C-07, C-0118) — pure logic.
 *
 * Every number here is counted from the register rows the page already holds
 * (`/api/filings`, scoped by the caller's `AuthContext`) and, by instance id,
 * the side-table facts from `/api/client/compliances`. Nothing is stored and
 * nothing is invented: a row without facts simply has no note.
 */

/* ------------------------------------------------------------------ tiles */

/** The four KPI tiles over the list (C-06). '' means no tile is picked. */
export type BoardTile = '' | 'month' | 'filed' | 'week' | 'late';

export const BOARD_TILES: readonly Exclude<BoardTile, ''>[] = ['month', 'filed', 'week', 'late'];

export function isBoardTile(value: string | null | undefined): value is Exclude<BoardTile, ''> {
  return BOARD_TILES.includes(value as Exclude<BoardTile, ''>);
}

/** "Due in 7 days" counts unfiled rows due today or in the next seven days. */
export const WEEK_DAYS = 7;

export function matchesTile(row: FilingRow, tile: BoardTile, now: Date): boolean {
  const thisMonth = monthKeyOf(row.dueDate) === monthKeyOf(now.toISOString());
  switch (tile) {
    case '':
      return true;
    case 'month':
      return thisMonth;
    case 'filed':
      return thisMonth && filingStatus(row, now) === 'filed';
    case 'week': {
      if (row.filedOn) return false;
      const d = daysUntil(row.dueDate, now);
      return d !== null && d >= 0 && d <= WEEK_DAYS;
    }
    case 'late':
      return filingStatus(row, now) === 'overdue';
  }
}

export function tileCounts(rows: FilingRow[], now: Date): Record<Exclude<BoardTile, ''>, number> {
  const out = { month: 0, filed: 0, week: 0, late: 0 };
  for (const row of rows) for (const t of BOARD_TILES) if (matchesTile(row, t, now)) out[t] += 1;
  return out;
}

/* ----------------------------------------------------------------- status */

/**
 * The Status filter chip. The register's own four (`overdue`, `due-soon`,
 * `upcoming`, `filed`) keep their old `?status=` values; "Not done" (`open`)
 * and "In progress" (`in-progress`) are the two the board adds.
 */
export type BoardStatus = '' | 'open' | 'overdue' | 'due-soon' | 'in-progress' | 'upcoming' | 'filed';

export const BOARD_STATUS_OPTIONS: Array<{ value: Exclude<BoardStatus, ''>; label: string }> = [
  { value: 'open', label: 'Not done' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-soon', label: 'Due soon' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'upcoming', label: 'Not started' },
  { value: 'filed', label: 'Done' },
];

export function parseBoardStatus(value: string | null | undefined): BoardStatus {
  return BOARD_STATUS_OPTIONS.some((o) => o.value === value) ? (value as BoardStatus) : '';
}

export function matchesStatus(row: FilingRow, status: BoardStatus, now: Date): boolean {
  if (!status) return true;
  if (status === 'open') return filingStatus(row, now) !== 'filed';
  if (status === 'in-progress') return filingWord(row, now) === 'In progress';
  return filingStatus(row, now) === status;
}

/* -------------------------------------------------------------- regulator */

/** The six regulators in the order of the "By regulator" card (C-07). */
export const REGULATORS: ReadonlyArray<{ key: Regulator; label: string }> = [
  { key: 'gst', label: 'GST' },
  { key: 'it', label: 'Income tax' },
  { key: 'mca', label: 'MCA' },
  { key: 'fema', label: 'FEMA' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'labour', label: 'Labour' },
];

/**
 * `?area=` holds a regulator key. An old link that carries an area word
 * ("Income Tax", "GST") still lands on its regulator.
 */
export function parseRegulator(value: string | null | undefined): Regulator | '' {
  const v = value?.trim();
  if (!v || v === 'all') return '';
  if (REGULATORS.some((r) => r.key === v)) return v as Regulator;
  return regOf(v) ?? '';
}

export function regulatorOf(row: Pick<FilingRow, 'compliance'>): Regulator | undefined {
  return regOf(row.compliance);
}

/** Filed and total per regulator; every one of the six is present, at 0 of 0 when there is none. */
export function regulatorCounts(rows: FilingRow[], now: Date): Array<{ key: Regulator; label: string; filed: number; total: number }> {
  return REGULATORS.map((r) => {
    const list = rows.filter((row) => regulatorOf(row) === r.key);
    return { ...r, filed: list.filter((row) => filingStatus(row, now) === 'filed').length, total: list.length };
  });
}

/* ---------------------------------------------------------------- groups */

export interface BoardGroup {
  /** Group key: the obligation and its due date (one filing period), or the engagement id. */
  key: string;
  label: string;
  /** Rows that pass every filter. */
  rows: FilingRow[];
  /** Filed and total of the group before the chip filters, for the "x of y filed" bar. */
  filed: number;
  total: number;
  /** Worst status of the group's rows, for the date tile. */
  status: FilingStatus;
  /** The first row, for the band (name, area, period, due date, company). */
  first: FilingRow;
}

function build(all: FilingRow[], shown: FilingRow[], keyOf: (row: FilingRow) => string, labelOf: (row: FilingRow) => string, now: Date): BoardGroup[] {
  const byKey = new Map<string, FilingRow[]>();
  for (const row of sortByDueDate(all)) {
    const k = keyOf(row);
    const list = byKey.get(k) ?? [];
    list.push(row);
    byKey.set(k, list);
  }
  const shownIds = new Set(shown.map((r) => r.id));
  return [...byKey.entries()].map(([key, list]) => {
    const statuses = list.map((r) => filingStatus(r, now));
    return {
      key,
      label: labelOf(list[0]!),
      rows: list.filter((r) => shownIds.has(r.id)),
      filed: statuses.filter((s) => s === 'filed').length,
      total: list.length,
      status: worstStatus(statuses),
      first: list[0]!,
    };
  });
}

/** "By filing": one band per obligation and due date, its client rows by company name. */
export function groupByFiling(all: FilingRow[], shown: FilingRow[], now: Date): BoardGroup[] {
  return build(all, shown, (r) => `${r.obligationId}|${r.dueDate.slice(0, 10)}`, (r) => r.particular, now)
    .map((g) => ({ ...g, rows: [...g.rows].sort((a, b) => a.companyName.localeCompare(b.companyName)) }))
    .sort((a, b) => a.first.dueDate.localeCompare(b.first.dueDate) || a.label.localeCompare(b.label));
}

/** "By client": one band per company, its filings by due date. */
export function groupByClient(all: FilingRow[], shown: FilingRow[], now: Date): BoardGroup[] {
  return build(all, shown, (r) => r.engagementId, (r) => r.companyName, now).sort((a, b) => a.label.localeCompare(b.label));
}

/* ------------------------------------------------------------------ note */

/**
 * The short note of a client row, from the facts the team records on the
 * filing: the ARN once filed, otherwise how far the work has got. A row
 * waiting on the client's data says so. Empty when nothing is recorded.
 */
export function noteFor(row: FilingRow, detail: PortalFiling | undefined, now: Date): string {
  if (!detail) return '';
  if (row.filedOn) return detail.acknowledgementNo?.trim() ? `ARN ${detail.acknowledgementNo.trim()}` : '';
  if (detail.approvedOn) return `Approved ${plainDate(detail.approvedOn, now)}`;
  if (detail.preparingSince) return `Preparing since ${plainDate(detail.preparingSince, now)}`;
  if (detail.dataReceivedOn) return `Data in ${plainDate(detail.dataReceivedOn, now)}`;
  if (waitingOnClient(row, detail, now)) return 'Waiting on client data';
  return '';
}

/* --------------------------------------------------------------- on time */

export interface OnTimeMonth {
  key: string;
  label: string;
  onTime: number;
  late: number;
}

/**
 * C4 "On time vs late": the filed-on date against the due date, by due month,
 * for the last `months` months to today. The same counting as Analytics
 * (`filingMonths` in `src/lib/metrics/filing-metrics.ts`).
 */
export function onTimeByMonth(rows: FilingRow[], now: Date, months: number): OnTimeMonth[] {
  const records: FilingRecord[] = rows.map((r) => ({
    engagementId: r.engagementId,
    dueDate: r.dueDate.slice(0, 10),
    filedOn: r.filedOn ? r.filedOn.slice(0, 10) : null,
    status: r.rawStatus,
  }));
  return filingMonths(records, now, months).map((m) => ({ key: m.key, label: m.label.split(' ')[0]!, onTime: m.onTime, late: m.late }));
}
