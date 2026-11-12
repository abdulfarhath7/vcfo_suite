import 'server-only';
import type { AuthContext } from '@/auth/guards';
import { getPortalFilings } from '@/db/repositories/client-compliances';
import { listTasks } from '@/db/repositories/compliance-tasks';
import { listExpiryItems } from '@/db/repositories/expiry-items';
import { getFilings } from '@/db/repositories/filings';
import { listRequestLists } from '@/db/repositories/request-lists';
import { getStatutoryCalendar } from '@/db/repositories/statutory-calendar';
import { CALENDAR_EXPORT_HEAD, calendarExportRows, calendarSelection } from '@/lib/compliance/calendar-selection';
import { financialYearForDate, todayIST } from '@/lib/compliance/filings';
import { OBLIGATIONS_EXPORT_HEAD, mergeRegisterDetails, mergeRegisterRows, obligationsListExport } from '@/lib/compliance/obligations-list';
import type { ListSource } from '@/lib/exports/list-source-schema';
import type { ExportTable } from '@/lib/exports/table-xlsx';
import { REQUEST_LISTS_EXPORT_HEAD, requestListExportCells, requestListsInTab } from '@/lib/request-lists/model';
import { fyKeyFromStartYear } from '@/lib/statutory-calendar/fy';
import { ALL_COMPANIES } from '@/views/compliances/compliance-scope';
import { fyRange } from '@/views/compliances/tasks/task-calendar';

/**
 * GL-06: the server side of the compliance lists and Request lists. Each one reads what its page
 * reads, through the same scoped repositories, and selects the rows with the page's own pure
 * functions, so the file holds what the screen shows for the same filters, and never a client
 * the role cannot see.
 */

type Table = Omit<ExportTable, 'sheet'>;
type SourceOf<S extends ListSource['source']> = Extract<ListSource, { source: S }>;

const companyFilter = (companyId: string) => (companyId !== ALL_COMPANIES ? companyId : undefined);

/** Compliance › Obligations: this financial year's register and the last one's, and the tasks. */
export async function obligationsTable(ctx: AuthContext, f: SourceOf<'obligations'>, now = new Date()): Promise<Table> {
  const fy = financialYearForDate(now).startYear;
  const [current, last, currentFacts, lastFacts, tasks] = await Promise.all([
    getFilings(ctx, { fyStartYear: fy }),
    getFilings(ctx, { fyStartYear: fy - 1 }),
    getPortalFilings(ctx, { fyStartYear: fy }),
    getPortalFilings(ctx, { fyStartYear: fy - 1 }),
    f.cat !== 'stat' ? listTasks(ctx, { engagementId: companyFilter(f.companyId) }) : Promise.resolve({ tasks: [] }),
  ]);
  const rows = obligationsListExport({
    registerRows: mergeRegisterRows(last.rows, current.rows),
    details: mergeRegisterDetails(lastFacts, currentFacts),
    tasks: tasks.tasks,
    companyId: f.companyId,
    groupBy: f.groupBy,
    state: f.state,
    cat: f.cat,
    workType: f.workType,
    now,
  });
  return { columns: OBLIGATIONS_EXPORT_HEAD, rows };
}

/** The compliance calendar: the month in view, or the financial year in the year and timeline views. */
export async function complianceCalendarTable(ctx: AuthContext, f: SourceOf<'compliance-calendar'>, now = new Date()): Promise<Table> {
  const fyStartYear = financialYearForDate(new Date(`${f.monthKey}-01T00:00:00Z`)).startYear;
  const range = fyRange(fyStartYear);
  // Only a company picked by hand narrows the expiries (see the page).
  const expiryCompany = !f.sole ? companyFilter(f.companyId) : undefined;
  const [filings, tasks, expiries, calendar] = await Promise.all([
    getFilings(ctx, { fyStartYear }),
    listTasks(ctx, { engagementId: companyFilter(f.companyId), from: range.from, to: range.to }),
    listExpiryItems(ctx, { engagementId: expiryCompany ?? null }).catch(() => []),
    getStatutoryCalendar(ctx, fyKeyFromStartYear(fyStartYear)).catch(() => null),
  ]);
  const sel = calendarSelection({
    scopedRows: filings.rows,
    companyId: f.companyId,
    cat: f.cat,
    view: f.view,
    monthKey: f.monthKey,
    areaPick: f.areas,
    allTasks: tasks.tasks.filter((t) => !t.hidden),
    expiryItems: expiries,
    deadlines: calendar?.deadlines ?? [],
  });
  return { columns: CALENDAR_EXPORT_HEAD, rows: calendarExportRows(sel, f.view, fyStartYear, todayIST(now), now) };
}

/** Request lists: every list of the tab in view (a client gets their own sent lists). */
export async function requestListsTable(ctx: AuthContext, f: SourceOf<'request-lists'>): Promise<Table> {
  const lists = await listRequestLists(ctx);
  const shown = ctx.role === 'client' ? lists : requestListsInTab(lists, f.tab);
  return { columns: REQUEST_LISTS_EXPORT_HEAD, rows: shown.map(requestListExportCells) };
}
