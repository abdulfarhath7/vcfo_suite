import { statutoryStatus } from '@/components/admin/statutory-calendar-utils';
import { ACT_META, type StatutoryDeadline } from '@/data/statutory-calendar-fy2627';
import { rowsInMonth, sortByDueDate, type FilingRow } from '@/lib/compliance/filings';
import { areaLabel, FILING_WORD, filingWord } from '@/lib/compliance/spectrum-status';
import { daysLeftLabel, openExpiryItems } from '@/lib/expiries/model';
import { deadlineTagLabel, statutoryArea } from '@/lib/statutory-calendar/acts';
import { rowsForCompany } from '@/views/compliances/compliance-scope';
import { fyRange } from '@/views/compliances/tasks/task-calendar';
import { showStat, showTasks, type CatFilter } from '@/views/compliances/tasks/task-model';

/**
 * What the compliance calendar (`ComplianceCalendarView`) shows for one company, category, area
 * pick and month. The page and the GL-06 Excel export on the server both select through here,
 * so the file holds what the calendar shows.
 */

export type CalendarViewKey = 'month' | 'year' | 'timeline' | 'statutory';

type CalendarTask = { dueDate: string; title: string; companyName: string; periodLabel: string | null; word: string };
type CalendarExpiry = {
  expiresOn: string;
  renewedAt: string | null;
  daysLeft: number;
  kindLabel: string;
  subjectName: string;
  companyName: string;
  referenceLabel: string | null;
};

export type SbcDeadline = StatutoryDeadline & { area: string };

/** The short act tag of an SBC statutory calendar deadline: "GST", "IT", "APRERA". */
export function sbcTag(d: Pick<StatutoryDeadline, 'act' | 'actLabel'>): string {
  return deadlineTagLabel(d, ACT_META[d.act].label);
}

/** "DSC expires · Asha Rao". */
export function expiryLabel(x: Pick<CalendarExpiry, 'kindLabel' | 'subjectName'>): string {
  return `${x.kindLabel} expires · ${x.subjectName}`;
}

export function calendarSelection<T extends CalendarTask, X extends CalendarExpiry>(input: {
  /** The scoped register of the financial year in view. */
  scopedRows: FilingRow[];
  companyId: string;
  cat: CatFilter;
  view: CalendarViewKey;
  monthKey: string;
  /** The areas picked; none picked means all. */
  areaPick: readonly string[];
  /** The non-statutory tasks of the year in view, without the not-applicable ones. */
  allTasks: readonly T[];
  /** The expiry register (already narrowed to a company picked by hand). */
  expiryItems: readonly X[] | undefined;
  /** The SBC statutory calendar of the year in view. */
  deadlines: readonly StatutoryDeadline[];
}) {
  const { companyId, cat, view, monthKey } = input;
  const allRows = rowsForCompany(input.scopedRows, companyId);
  const rows = showStat(cat) ? allRows : [];
  const monthRows = sortByDueDate(rowsInMonth(rows, monthKey));
  // Every role sees every deadline of the SBC statutory calendar; it counts as statutory.
  const sbcAll: SbcDeadline[] = showStat(cat) ? input.deadlines.map((d) => ({ ...d, area: statutoryArea(d) })) : [];
  const sbcMonth = sbcAll.filter((d) => d.date.startsWith(monthKey));
  // Area chips count what the view shows: this month in month view, the year otherwise.
  const counted = view === 'month' ? monthRows : rows;
  const countedSbc = view === 'month' ? sbcMonth : sbcAll;
  const areas = [...new Set([...counted.map((row) => row.compliance), ...countedSbc.map((d) => d.area)])].sort((a, b) => a.localeCompare(b));
  const areasOn = input.areaPick.filter((a) => areas.includes(a));
  const allAreas = areasOn.length === 0;
  const sbcShown = sbcAll.filter((d) => allAreas || areasOn.includes(d.area));
  const sbcMonthShown = sbcShown.filter((d) => d.date.startsWith(monthKey));
  const inArea = (row: FilingRow) => allAreas || areasOn.includes(row.compliance);
  // Tasks have no regulator: they show under the All area only.
  const tasks = showTasks(cat) && allAreas ? [...input.allTasks] : [];
  const monthTasks = tasks.filter((t) => t.dueDate.startsWith(monthKey));
  // Expiries have no area either, so an area pick hides them; the Non-statutory filter does too.
  const expiries = cat !== 'non-statutory' && allAreas ? openExpiryItems(input.expiryItems, Number.POSITIVE_INFINITY) : [];
  const monthExpiries = expiries.filter((x) => x.expiresOn.startsWith(monthKey));
  const listRows = monthRows.filter(inArea);
  return {
    allRows,
    rows,
    monthRows,
    sbcAll,
    sbcMonth,
    counted,
    countedSbc,
    areas,
    areasOn,
    allAreas,
    sbcShown,
    sbcMonthShown,
    inArea,
    tasks,
    monthTasks,
    expiries,
    monthExpiries,
    listRows,
  };
}

export type CalendarSelection = ReturnType<typeof calendarSelection>;

export const CALENDAR_EXPORT_HEAD = ['Due date', 'Filing', 'Client', 'Period', 'Law', 'Status'];

/**
 * What the calendar shows, by due date. The month view exports the month in view; the year and
 * timeline views export the financial year. Both keep the company, category and area filters.
 * Tasks have no law, so that cell reads "Non-statutory".
 */
export function calendarExportRows(
  sel: {
    listRows: FilingRow[];
    rows: FilingRow[];
    inArea: (row: FilingRow) => boolean;
    monthTasks: readonly CalendarTask[];
    tasks: readonly CalendarTask[];
    monthExpiries: readonly CalendarExpiry[];
    expiries: readonly CalendarExpiry[];
    sbcMonthShown: readonly SbcDeadline[];
    sbcShown: readonly SbcDeadline[];
  },
  view: CalendarViewKey,
  fyStartYear: number,
  todayIso: string,
  now: Date,
): Array<Array<string | null>> {
  const range = fyRange(fyStartYear);
  const filings = view === 'month' ? sel.listRows : sortByDueDate(sel.rows.filter(sel.inArea));
  const taskList = view === 'month' ? sel.monthTasks : sel.tasks;
  const expiryList = view === 'month' ? sel.monthExpiries : sel.expiries.filter((x) => x.expiresOn >= range.from && x.expiresOn <= range.to);
  const sbcList = view === 'month' ? sel.sbcMonthShown : sel.sbcShown;
  return [
    ...sbcList.map((d) => ({
      due: d.date,
      cells: [d.date, d.title, 'SBC statutory calendar', d.note ?? null, sbcTag(d), FILING_WORD[statutoryStatus(d.date, todayIso)]],
    })),
    ...filings.map((row) => ({
      due: row.dueDate.slice(0, 10),
      cells: [row.dueDate.slice(0, 10), row.particular, row.companyName, row.periodLabel ?? null, areaLabel(row.compliance), filingWord(row, now)],
    })),
    ...taskList.map((t) => ({
      due: t.dueDate.slice(0, 10),
      cells: [t.dueDate.slice(0, 10), t.title, t.companyName, t.periodLabel ?? null, 'Non-statutory', t.word],
    })),
    ...expiryList.map((x) => ({
      due: x.expiresOn,
      cells: [x.expiresOn, expiryLabel(x), x.companyName, x.referenceLabel, 'Expiry', daysLeftLabel(x.daysLeft)],
    })),
  ]
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((x) => x.cells as Array<string | null>);
}
