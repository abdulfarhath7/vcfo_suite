import 'server-only';
import type { AuthContext } from '@/auth/guards';
import type { Engagement } from '@/data/engagements';
import { listDocumentRequests } from '@/db/repositories/document-requests';
import { listEmailDirectory } from '@/db/repositories/email-directory';
import { listChecklistIndex, listEngagements, toAppEngagementsWithLeads } from '@/db/repositories/engagements';
import { listReportingLines } from '@/db/repositories/firm-org';
import { getFilings } from '@/db/repositories/filings';
import { getPracticeMetrics } from '@/db/repositories/metrics';
import { listPracticeIncorporation } from '@/db/repositories/practice-incorporation';
import { listInternOptions, listManagerOptions, listStaffPeople } from '@/db/repositories/profiles';
import { listCalendarChanges } from '@/db/repositories/reg-proposals';
import { getSuperAdminOverview, getSuperFirmInsights } from '@/db/repositories/super-overview';
import { listTasks } from '@/db/repositories/tasks';
import { askFlags } from '@/lib/ask/config';
import { isAdminOrManager } from '@/lib/auth';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import type { ExportTable } from '@/lib/exports/table-xlsx';
import { ExportForbiddenError, type ListSource } from '@/lib/exports/list-source-schema';
import { LEAD_CLIENTS_EXPORT_HEAD, filterLeadClients, leadClientExportCells, leadClientRows } from '@/lib/intern/lead-client-rows';
import { leadComplianceFilings, leadEngagements, leadFilingWindows, leadWorkItems } from '@/lib/intern/lead-portfolio';
import {
  PRACTICE_INCORPORATION_EXPORT_HEAD,
  incorporatingClients,
  practiceIncorporationExportCells,
  practiceIncorporationRows,
} from '@/lib/practice/practice-incorporation-list';
import { FIRM_PROJECTS_EXPORT_HEAD, firmManagerName, firmProjectExportCells, firmProjectRows } from '@/lib/projects/firm-project-rows';
import { PROJECTS_EXPORT_HEAD, filterProjectList, projectExportCells, projectListItems } from '@/lib/projects/project-list-rows';
import {
  SUPER_CLIENTS_EXPORT_HEAD,
  adminNameResolver,
  filterSuperClients,
  superClientExportCells,
  superNextDue,
} from '@/lib/super/super-clients-list';

/**
 * GL-06: the server side of the staff client and project lists. Each one reads what its page
 * reads, through the same repositories with the caller's `AuthContext`, and builds the rows with
 * the page's own pure functions, so the file has the rows and columns of the screen and never
 * a client the role cannot see.
 */

type Table = Omit<ExportTable, 'sheet'>;
type SourceOf<S extends ListSource['source']> = Extract<ListSource, { source: S }>;

/** The engagements and step state the browser holds (`/api/engagements`, `/api/checklist-index`). */
async function loadAppEngagements(ctx: AuthContext): Promise<{ engagements: Engagement[]; stateOf: (e: Engagement) => Record<string, ChecklistItemStateSlice> }> {
  const [rows, index] = await Promise.all([listEngagements(ctx), listChecklistIndex(ctx)]);
  const engagements = await toAppEngagementsWithLeads(rows);
  return { engagements, stateOf: (e) => index[e.id] ?? {} };
}

/** The project-lead roster the pages read (`/api/admin/interns`); only admins and managers have it. */
async function loadLeadOptions(ctx: AuthContext): Promise<Array<{ id: string; name: string; initials?: string }>> {
  if (!isAdminOrManager(ctx.role)) return [];
  return listInternOptions(ctx).catch(() => []);
}

/** Admin Work › Projects. */
export async function firmProjectsTable(ctx: AuthContext, f: SourceOf<'firm-projects'>, now = new Date()): Promise<Table> {
  const [{ engagements, stateOf }, leads, managers] = await Promise.all([
    loadAppEngagements(ctx),
    loadLeadOptions(ctx),
    isAdminOrManager(ctx.role) ? listManagerOptions(ctx).catch(() => []) : Promise.resolve([]),
  ]);
  const leadName = (id: string) => leads.find((l) => l.id === id)?.name;
  const rows = firmProjectRows(engagements, stateOf, leadName, f, now);
  const todayIso = now.toISOString().slice(0, 10);
  return {
    columns: FIRM_PROJECTS_EXPORT_HEAD,
    rows: rows.map((r) => firmProjectExportCells(r, (id) => firmManagerName(managers, id), todayIso)),
  };
}

/** The manager's Projects: the table's filters, or every project when the board is in view. */
export async function managerProjectsTable(ctx: AuthContext, f: SourceOf<'manager-projects'>, now = new Date()): Promise<Table> {
  const [{ engagements, stateOf }, tasks, leads] = await Promise.all([loadAppEngagements(ctx), listTasks(ctx), loadLeadOptions(ctx)]);
  const items = projectListItems(engagements, tasks, leads, leads, stateOf, now);
  const shown = f.view === 'board' ? items : filterProjectList(items, f, now);
  return { columns: PROJECTS_EXPORT_HEAD, rows: shown.map(projectExportCells) };
}

/** The lead's Clients, with the lead's own work items for the saved views. */
export async function leadClientsTable(ctx: AuthContext, f: SourceOf<'lead-clients'>, now = new Date()): Promise<Table> {
  const internId = ctx.internId ?? '';
  const [{ engagements, stateOf }, requests, tasks, register, directory, changes] = await Promise.all([
    loadAppEngagements(ctx),
    listDocumentRequests(ctx),
    listTasks(ctx),
    getFilings(ctx),
    listEmailDirectory(ctx).catch(() => []),
    askFlags().watch ? listCalendarChanges(ctx).catch(() => []) : Promise.resolve([]),
  ]);
  const myEngagements = leadEngagements(engagements, internId);
  const workItems = leadWorkItems({
    myEngagements,
    stateOf,
    internId,
    userId: ctx.userId,
    filings: leadComplianceFilings(myEngagements, stateOf, changes),
    filingWindows: leadFilingWindows(register.rows),
    requests,
    tasks,
  });
  const all = leadClientRows({ myEngagements, stateOf, workItems, directory, now });
  return { columns: LEAD_CLIENTS_EXPORT_HEAD, rows: filterLeadClients(all, f, now).map(leadClientExportCells) };
}

/** The super admin's Clients. Like `/api/super/overview`, only a super admin may read it. */
export async function superClientsTable(ctx: AuthContext, f: SourceOf<'super-clients'>, now = new Date()): Promise<Table> {
  if (ctx.role !== 'super_admin') throw new ExportForbiddenError();
  const [overview, insights, people, lines] = await Promise.all([
    getSuperAdminOverview(ctx, now),
    getSuperFirmInsights(ctx, now),
    listStaffPeople(ctx),
    listReportingLines(ctx),
  ]);
  const adminOf = adminNameResolver(people, lines);
  const nextDue = superNextDue(overview, insights);
  return {
    columns: SUPER_CLIENTS_EXPORT_HEAD,
    rows: filterSuperClients(overview.engagements, f, adminOf).map((row) => superClientExportCells(row, nextDue, adminOf)),
  };
}

/** Incorporation on the staff shells, with the days in step from the practice metrics. */
export async function practiceIncorporationTable(ctx: AuthContext, f: SourceOf<'practice-incorporation'>, now = new Date()): Promise<Table> {
  const [clients, metrics] = await Promise.all([listPracticeIncorporation(ctx, now), getPracticeMetrics(ctx, now)]);
  const rows = practiceIncorporationRows(incorporatingClients(clients), f.view, f.withWho);
  return { columns: PRACTICE_INCORPORATION_EXPORT_HEAD, rows: rows.map((c) => practiceIncorporationExportCells(c, metrics?.currentStep)) };
}
