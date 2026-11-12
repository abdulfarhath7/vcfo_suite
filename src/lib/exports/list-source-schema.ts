import { z } from 'zod';

/**
 * GL-06: the lists the server exports to Excel itself. The page sends the list's name and the
 * filters and sort on screen (never its rows); the server reads the rows through the
 * repositories with the caller's `AuthContext`, so the file holds every matching row and only
 * what the role may see. Shared by the route (`/api/exports/xlsx`), which parses it, and the
 * export button, which only uses the type.
 */

const word = (max = 40) => z.string().trim().max(max).default('');

const AuditLog = z.object({
  source: z.literal('audit-log'),
  engagementId: z.string().trim().max(80).optional().nullable(),
  filters: z.object({
    search: z.string().max(200).default(''),
    role: z.string().max(40).default('all'),
    category: z.string().max(40).default('all'),
  }),
});

const Approvals = z.object({
  source: z.literal('approvals'),
  scope: z.enum(['firm', 'manager']),
  kind: z.enum(['all', 'client', 'lead', 'send', 'board']),
});

/** Admin Work › Projects (`FirmProjectsPanel`). */
const FirmProjects = z.object({
  source: z.literal('firm-projects'),
  phase: z.enum(['all', 'Pre-Incorporation', 'Post-Incorporation']).default('all'),
  stuck: z.enum(['', 'waiting_client', 'waiting_manager', 'waiting_lead', 'waiting_signed', 'blocked', 'on_track']).default(''),
  manager: word(80),
  show: word(),
  scope: word(),
  health: word(),
});

/** The manager's Projects (`ProjectsView`): the table's filters, or every project on the board. */
const ManagerProjects = z.object({
  source: z.literal('manager-projects'),
  view: z.enum(['table', 'board']).default('table'),
  show: word(),
  stage: word(),
  health: word(),
  nextWin: word(),
});

/** The super admin's Clients (`SuperProjects`). */
const SuperClients = z.object({
  source: z.literal('super-clients'),
  filter: z.enum(['all', 'attention', 'firm', 'client']).default('all'),
  stage: word(),
  area: word(),
  admin: word(160),
  manager: word(160),
});

/** The lead's Clients (`InternClients`). */
const LeadClients = z.object({
  source: z.literal('lead-clients'),
  stage: word(),
  show: word(),
  health: word(),
  nextWin: word(),
});

/** Incorporation on the staff shells (`StaffPracticeIncorporation`). */
const PracticeIncorporation = z.object({
  source: z.literal('practice-incorporation'),
  view: z.enum(['part-a', 'part-b', 'board-resolutions', 'documents']).nullable().default(null),
  withWho: z.enum(['', 'client', 'sbc', 'manager']).default(''),
});

/** Compliance › Obligations (`ObligationsView`). `companyId` "all" means every client in scope. */
const Obligations = z.object({
  source: z.literal('obligations'),
  companyId: z.string().trim().min(1).max(80).default('all'),
  groupBy: z.enum(['filing', 'frequency', 'law']).default('filing'),
  state: z.enum(['', 'overdue', 'soon', 'waiting', 'done', 'none']).default(''),
  cat: z.enum(['stat', 'ns', 'all']).default('stat'),
  workType: z.enum(['all', 'task', 'meeting']).default('all'),
});

/** The compliance calendar (`ComplianceCalendarView`): the month or the financial year in view. */
const ComplianceCalendar = z.object({
  source: z.literal('compliance-calendar'),
  companyId: z.string().trim().min(1).max(80).default('all'),
  /** Set when the company list is the caller's one company: expiries then cover every project. */
  sole: z.boolean().default(false),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  view: z.enum(['month', 'year', 'timeline', 'statutory']).default('month'),
  cat: z.enum(['all', 'statutory', 'non-statutory']).default('all'),
  areas: z.array(z.string().max(80)).max(60).default([]),
});

/** Request lists (`RequestListsPage`), the tab in view. */
const RequestLists = z.object({
  source: z.literal('request-lists'),
  tab: z.enum(['open', 'drafts', 'closed']).default('open'),
});

export const ListSourceSchema = z.discriminatedUnion('source', [
  AuditLog,
  Approvals,
  FirmProjects,
  ManagerProjects,
  SuperClients,
  LeadClients,
  PracticeIncorporation,
  Obligations,
  ComplianceCalendar,
  RequestLists,
]);

/** A list source as the server reads it (defaults filled in). */
export type ListSource = z.infer<typeof ListSourceSchema>;
/** A list source as a page sends it (fields with a default may be left out). */
export type ListSourceInput = z.input<typeof ListSourceSchema>;
export type ListSourceName = ListSource['source'];

/** A list the caller's role may not export at all (the route answers 403). */
export class ExportForbiddenError extends Error {
  constructor() {
    super('forbidden');
    this.name = 'ExportForbiddenError';
  }
}
