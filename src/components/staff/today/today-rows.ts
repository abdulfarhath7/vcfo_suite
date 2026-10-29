import { getItem, type Bucket } from '@/data/checklist';
import type { ComplianceFiling } from '@/data/compliance';
import type { StatusCode } from '@/data/checklist';
import type { DocRequest, Engagement, TaskInstance } from '@/data/engagements';
import type { ChipTone } from '@/components/ui/spectrum-chip';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import { sep } from '@/lib/date-format';
import {
  buildInternWorkItems,
  buildTaskWorkItem,
  internCompanyPhaseProgress,
  stepOwnerLead,
  parseIstNoon,
  ymdFromIsoInIst,
  ymdInIst,
  type InternWorkItem,
} from '@/lib/intern/intern-work';
import { adminProjectPath, adminProjectStepPath } from '@/lib/projects/project-step-path';

/* Shared data shaping for the three staff Today screens (VCFO Spectrum TodayScreen). Every row
   comes from real engagements, checklist state, filings and document requests; nothing here
   invents a number. */

/** The six status words (R-13), in chart order (R-25). */
export type TodayStatus = 'Overdue' | 'Due soon' | 'In progress' | 'Waiting' | 'Not started' | 'Done';

export const TODAY_STATUS_ORDER: Array<{ status: TodayStatus; tone: ChipTone; bar: string; stroke: string }> = [
  { status: 'Overdue', tone: 'bad', bar: 'bg-danger-mid', stroke: 'oklch(var(--danger-mid))' },
  { status: 'Due soon', tone: 'warn', bar: 'bg-warning-mid', stroke: 'oklch(var(--warning-mid))' },
  { status: 'In progress', tone: 'prog', bar: 'bg-brand', stroke: 'oklch(var(--brand))' },
  { status: 'Waiting', tone: 'teal', bar: 'bg-waiting-mid', stroke: 'oklch(var(--waiting-mid))' },
  { status: 'Not started', tone: 'idle', bar: 'bg-upcoming-mid', stroke: 'oklch(var(--upcoming-mid))' },
  { status: 'Done', tone: 'ok', bar: 'bg-positive-mid', stroke: 'oklch(var(--positive-mid))' },
];

export function todayStatusTone(status: TodayStatus): ChipTone {
  return TODAY_STATUS_ORDER.find((s) => s.status === status)?.tone ?? 'idle';
}

/** Whole days from today (IST) to an ISO date; negative when it has passed. */
export function daysFromToday(iso: string | undefined | null, now: Date): number | null {
  const ymd = ymdFromIsoInIst(iso);
  if (!ymd) return null;
  const ms = parseIstNoon(ymd).getTime() - parseIstNoon(ymdInIst(now)).getTime();
  return Math.round(ms / 86_400_000);
}

/** Due date cell: red when late, amber when due soon, plain otherwise. */
export function dueClass(status: TodayStatus): string | undefined {
  if (status === 'Overdue') return 'font-medium text-danger';
  if (status === 'Due soon') return 'font-medium text-warning';
  return undefined;
}

/** A plain date for screens: "14 Oct" (R-29). */
export function dayMonth(iso: string | undefined | null): string {
  const ymd = ymdFromIsoInIst(iso);
  if (!ymd) return '';
  return sep(
    parseIstNoon(ymd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }),
  );
}

/**
 * One status word for a work item. Overdue wins, then waiting on someone else, then a due date
 * inside seven days, then a step nobody has started, then in progress.
 */
export function todayStatusOf(
  item: InternWorkItem,
  slice: ChecklistItemStateSlice | undefined,
  now: Date,
): TodayStatus {
  if (item.kind === 'done') return 'Done';
  if (item.isOverdue || item.kind === 'overdue') return 'Overdue';
  if (item.kind === 'waiting-client' || item.kind === 'waiting-manager' || item.kind === 'waiting-request') {
    return 'Waiting';
  }
  const days = daysFromToday(item.dueAt, now);
  if (days !== null && days >= 0 && days <= 7) return 'Due soon';
  if (
    item.source === 'step' &&
    item.kind === 'in-progress' &&
    (!slice || slice.status === 'not-started') &&
    !slice?.clientSubmittedAt
  ) {
    return 'Not started';
  }
  return 'In progress';
}

const BUCKET_AREA: Record<Bucket, string> = {
  'pre-inc': 'Incorporation',
  'post-inc': 'ROC',
  statutory: 'Registrations',
  fema: 'FEMA',
};

/** The area word for the area pill (R-43): the checklist bucket for a step, the authority for a filing. */
export function todayAreaOf(item: InternWorkItem, filingById: Map<string, ComplianceFiling>): string {
  if (item.source === 'filing' && item.filingId) return filingById.get(item.filingId)?.authority ?? 'Filing';
  if (item.source === 'request') return 'Documents';
  if (item.source === 'task') return 'Tasks';
  const def = item.catalogId ? getItem(item.catalogId) : undefined;
  return def ? BUCKET_AREA[def.bucket] : 'Incorporation';
}

export type TodayScope = 'all' | 'incorporating' | 'compliance';

/** Scope test for the greeting switch: incorporating until the certificate of incorporation. */
export function engagementInScope(
  scope: TodayScope,
  engagement: Engagement,
  state: Record<string, ChecklistItemStateSlice> | undefined,
): boolean {
  if (scope === 'all') return true;
  const inc = isIncorporated(engagement, state ?? null);
  return scope === 'compliance' ? inc : !inc;
}

export interface TeamTaskRow {
  id: string;
  /** The work item key (`step:…`, `filing:…`, `request:…`, `task:…`), for Reassign. */
  itemId?: string;
  source?: InternWorkItem['source'];
  engagementId: string;
  companyName: string;
  title: string;
  leadId: string;
  leadName: string;
  area: string;
  dueAt?: string;
  status: TodayStatus;
  /** The client still owes this one (status Waiting and held by the client). */
  withClient: boolean;
  href: string;
  /** Ids for the row's own routes (Mark done, the drawer key). */
  catalogId?: string;
  requestId?: string;
  taskId?: string;
  /** The task row's stored status, so a status change from the chip can be undone. */
  taskStatus?: StatusCode;
  /** E-08: when the row last changed, from the checklist state, the task or the item's own dates. */
  changedAt?: string;
}

/**
 * When a work item last changed (E-08), from real stamps only: the step's last edit, client
 * submit, review and delivery times, the item's start and finish, and a task's `updatedAt`.
 */
export function workItemChangedAt(
  item: Pick<InternWorkItem, 'startedAt' | 'completedAt'>,
  slice: ChecklistItemStateSlice | undefined,
  taskUpdatedAt?: string,
): string | undefined {
  const stamps = [
    slice?.lastEditedAt,
    slice?.clientSubmittedAt,
    slice?.reviewedAt,
    slice?.deliveredToClientAt,
    item.completedAt,
    item.startedAt,
    taskUpdatedAt,
  ];
  let best: string | undefined;
  let bestMs = -Infinity;
  for (const s of stamps) {
    if (!s) continue;
    const ms = Date.parse(s);
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms;
      best = s;
    }
  }
  return best;
}

/**
 * Team tasks for a manager or admin: the same work items each lead sees on their own Work page
 * (checklist steps, filings due, document requests), one lead per project (its primary lead),
 * with links that open the staff project screens.
 */
export function buildTeamTaskRows(opts: {
  engagements: Engagement[];
  getState: (engagement: Engagement) => Record<string, ChecklistItemStateSlice>;
  filings: ComplianceFiling[];
  requests: DocRequest[];
  /** Task rows from `/api/tasks`; the ones assigned to a lead become task rows (G-12). */
  tasks?: TaskInstance[];
  /** Leads by `intern_id` key; `profileId` (sent by `/api/admin/interns`) maps task owners. */
  leads: Array<{ id: string; name: string; profileId?: string }>;
  projectBase: '/app/admin' | '/app/manager';
  now: Date;
}): TeamTaskRow[] {
  const byLead = new Map<string, Engagement[]>();
  // Co-leads who own a reassigned step (G-18) list only those steps.
  const ownersOnly = new Map<string, Engagement[]>();
  const push = (map: Map<string, Engagement[]>, key: string, eng: Engagement) => {
    const list = map.get(key);
    if (list) list.push(eng);
    else map.set(key, [eng]);
  };
  for (const eng of opts.engagements) {
    if (!eng.internId || eng.stage === 'Operational Readiness') continue;
    push(byLead, eng.internId, eng);
    const owners = new Set<string>();
    for (const slice of Object.values(opts.getState(eng))) {
      const owner = stepOwnerLead(eng, slice);
      if (owner && owner !== eng.internId) owners.add(owner);
    }
    for (const owner of owners) push(ownersOnly, owner, eng);
  }
  const filingById = new Map(opts.filings.map((f) => [f.id, f]));
  const engById = new Map(opts.engagements.map((e) => [e.id, e]));
  const nameOf = (id: string) => opts.leads.find((l) => l.id === id)?.name ?? 'Project lead';
  const rows: TeamTaskRow[] = [];

  const addRow = (leadId: string, item: InternWorkItem, task?: TaskInstance) => {
    const eng = engById.get(item.engagementId);
    if (!eng) return;
    const slice = item.catalogId ? opts.getState(eng)[item.catalogId] : undefined;
    const status = todayStatusOf(item, slice, opts.now);
    const href =
      item.source === 'filing'
        ? `${opts.projectBase}/compliances/calendar`
        : item.source === 'step' && item.catalogId
          ? adminProjectStepPath(eng, item.catalogId, opts.projectBase)
          : adminProjectPath(eng, opts.projectBase);
    rows.push({
      id: `${leadId}:${item.id}`,
      itemId: item.id,
      source: item.source,
      engagementId: eng.id,
      companyName: eng.companyName,
      title: item.title,
      leadId,
      leadName: nameOf(leadId),
      area: todayAreaOf(item, filingById),
      dueAt: item.dueAt,
      status,
      withClient: status === 'Waiting' && (item.kind === 'waiting-client' || item.kind === 'waiting-request'),
      href,
      catalogId: item.catalogId,
      requestId: item.requestId,
      taskId: item.taskId,
      taskStatus: task?.status,
      changedAt: workItemChangedAt(item, slice, task?.updatedAt),
    });
  };

  for (const [leadId, engagements] of byLead) {
    const ids = new Set(engagements.map((e) => e.id));
    const items = buildInternWorkItems({
      engagements,
      getChecklistState: opts.getState,
      internId: leadId,
      filings: opts.filings.filter((f) => ids.has(f.engagementId)),
      requests: opts.requests.filter((r) => ids.has(r.engagementId)),
      now: opts.now,
    });
    for (const item of items) addRow(leadId, item);
  }

  for (const [leadId, engagements] of ownersOnly) {
    const items = buildInternWorkItems({
      engagements,
      getChecklistState: opts.getState,
      internId: leadId,
      ownedStepsOnly: true,
      now: opts.now,
    });
    for (const item of items) addRow(leadId, item);
  }

  const leadKeyByProfile = new Map(
    opts.leads.filter((l) => l.profileId).map((l) => [l.profileId as string, l.id]),
  );
  for (const task of opts.tasks ?? []) {
    const eng = engById.get(task.engagementId);
    const leadId = task.assigneeId ? leadKeyByProfile.get(task.assigneeId) : undefined;
    if (!eng || !leadId || eng.stage === 'Operational Readiness') continue;
    const item = buildTaskWorkItem(task, eng, opts.now);
    if (item) addRow(leadId, item, task);
  }

  return rows.sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
}

/** Count rows per status word, in chart order. */
export function countByStatus(rows: Array<{ status: TodayStatus }>): Record<TodayStatus, number> {
  const out = Object.fromEntries(TODAY_STATUS_ORDER.map((s) => [s.status, 0])) as Record<TodayStatus, number>;
  for (const r of rows) out[r.status] += 1;
  return out;
}

export interface PhaseProgressRow {
  engagementId: string;
  companyName: string;
  href: string;
  currentLabel: string;
  stuck: boolean;
  done: number[];
  totals: number[];
  names: string[];
  stepsDone: number;
  stepsTotal: number;
  /** Days to the manager-set incorporation window end, when one is set. */
  daysToCoi: number | null;
  incorporated: boolean;
  managerId?: string;
  leadId?: string;
}

/** Phase progress rows (ST5 phase track) for a set of projects. `href` maps a project to its screen. */
export function buildPhaseProgressRows(opts: {
  engagements: Engagement[];
  getState: (engagement: Engagement) => Record<string, ChecklistItemStateSlice>;
  href?: (engagement: Engagement) => string;
  now: Date;
}): PhaseProgressRow[] {
  return opts.engagements
    .filter((e) => e.stage !== 'Operational Readiness')
    .map((eng) => {
      const state = opts.getState(eng);
      const p = internCompanyPhaseProgress(eng, state, opts.now);
      const incorporated = isIncorporated(eng, state);
      return {
        engagementId: eng.id,
        companyName: eng.companyName,
        href: opts.href ? opts.href(eng) : p.href,
        currentLabel: p.currentLabel,
        stuck: p.stuck,
        done: p.phases.map((x) => x.done),
        totals: p.phases.map((x) => x.total),
        names: p.phases.map((x) => x.title),
        stepsDone: p.phases.reduce((n, x) => n + x.done, 0),
        stepsTotal: p.phases.reduce((n, x) => n + x.total, 0),
        daysToCoi: incorporated ? null : daysFromToday(eng.schedule?.incorporation?.to, opts.now),
        incorporated,
        managerId: eng.managerId ?? eng.adminId,
        leadId: eng.internId,
      };
    });
}

/** The latest step edit, submit, review or delivery time on a client (E-08), or undefined. */
export function engagementChangedAt(state: Record<string, ChecklistItemStateSlice> | undefined): string | undefined {
  let best: string | undefined;
  let bestMs = -Infinity;
  for (const slice of Object.values(state ?? {})) {
    for (const s of [slice?.lastEditedAt, slice?.clientSubmittedAt, slice?.reviewedAt, slice?.deliveredToClientAt]) {
      if (!s) continue;
      const ms = Date.parse(s);
      if (Number.isFinite(ms) && ms > bestMs) {
        bestMs = ms;
        best = s;
      }
    }
  }
  return best;
}

/**
 * What the clients still owe on these engagements, as reminder targets: steps the client has to
 * fill and document requests they have to upload. Each item appears once.
 */
export function clientRemindTargets(opts: {
  engagements: Engagement[];
  getState: (engagement: Engagement) => Record<string, ChecklistItemStateSlice>;
  requests: DocRequest[];
  now?: Date;
}): Array<{ engagementId: string; itemKey: string; title: string }> {
  const rows = buildTeamTaskRows({
    engagements: opts.engagements,
    getState: opts.getState,
    filings: [],
    requests: opts.requests,
    leads: [],
    projectBase: '/app/manager',
    now: opts.now ?? new Date(),
  });
  const seen = new Set<string>();
  const out: Array<{ engagementId: string; itemKey: string; title: string }> = [];
  for (const r of rows) {
    if (!r.withClient || !r.itemId || !/^(step|request):/.test(r.itemId)) continue;
    const k = `${r.engagementId}|${r.itemId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ engagementId: r.engagementId, itemKey: r.itemId, title: r.title });
  }
  return out;
}
