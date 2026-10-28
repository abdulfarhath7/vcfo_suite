/**
 * SUPER ADMIN INSIGHTS — pure shape builder for the practice, team, risk, growth and report
 * screens.
 *
 * The repository (`src/db/repositories/super-overview.ts`, `getSuperFirmInsights`) gathers the
 * scoped rows and hands them here. Nothing in this module touches `db`, `server-only` or React,
 * so the views can import the types and every derivation stays unit-testable.
 *
 * Every number comes from a stored date or a stored status: engagement `created_at`, the
 * certificate date (`incorporation_date`, or the Pre-12 step), checklist step states read
 * through the same gate the wizard uses, and compliance instances with their `due_date` and
 * `filed_on`. Nothing is estimated, and there is no money anywhere (rule R-37).
 */

import type { SuperEngagementSummary, SuperActivityEntry } from '@/lib/super/super-overview';

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

/** One registration step for one client, as the gate and the stored status say. */
export type SuperRegCell = 'done' | 'progress' | 'waiting' | 'overdue' | 'not-needed' | 'locked';

export interface SuperRegistrationType {
  id: string;
  title: string;
}

export interface SuperOverdueStep {
  id: string;
  title: string;
  href: string;
}

export interface SuperInsightClient {
  summary: SuperEngagementSummary;
  /** True when the engagement started before incorporation, so SBC ran the COI. */
  startedPreInc: boolean;
  /** Certificate of incorporation date (YYYY-MM-DD), when one is recorded. */
  certificateDate: string | null;
  /** Days from the engagement start to the certificate, for engagements SBC incorporated. */
  daysToCoi: number | null;
  /** Primary manager plus co-managers (profile ids). */
  managerIds: string[];
  /** Primary lead plus co-leads (`intern_id` scoping keys). */
  leadIds: string[];
  overdueSteps: SuperOverdueStep[];
  /** Registration step id to its cell. */
  registrations: Record<string, SuperRegCell>;
  /** Staff workspace of the current step, when there is one. */
  currentStepHref: string | null;
  /** Earliest open filing due date (YYYY-MM-DD), when any. */
  nextDueDate: string | null;
}

export interface SuperInsightFiling {
  id: string;
  engagementId: string;
  companyName: string;
  title: string;
  authority: string;
  dueDate: string;
  filedOn: string | null;
  status: string;
  periodLabel?: string;
  href: string;
}

export type SuperFilingOutcome = 'on-time' | 'late' | 'overdue' | 'open';

export interface SuperMonth {
  /** YYYY-MM */
  key: string;
  /** "Oct" */
  label: string;
  /** "October 2026" */
  longLabel: string;
  engagementsStarted: number;
  certificatesIssued: number;
  /** Average days to COI over the certificates issued this month; null without any. */
  avgDaysToCoi: number | null;
  filingsDue: number;
  filedOnTime: number;
  filedLate: number;
  /** Due this month, not filed, and the due date has passed. */
  overdue: number;
  /** Due this month, not filed, and not yet due. */
  open: number;
}

export interface SuperTeamLead {
  id: string;
  name: string;
  email: string;
  internId: string | null;
  status: string;
  lastActiveAt: string | null;
  clients: number;
  openSteps: number;
  overdueSteps: number;
  attention: number;
}

export interface SuperTeamManager {
  id: string;
  name: string;
  email: string;
  status: string;
  lastActiveAt: string | null;
  clients: number;
  incorporating: number;
  openSteps: number;
  overdueSteps: number;
  approvalsPending: number;
  attention: number;
  overdueFilings: number;
  filedOnTime: number;
  filedLate: number;
  /** Average days to COI over this manager's certificates; null without any. */
  avgDaysToCoi: number | null;
  leads: SuperTeamLead[];
}

export interface SuperTeamAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
  lastActiveAt: string | null;
  /** Audit rows this person wrote in the last 30 days (within the recent audit window). */
  actions30d: number;
}

export interface SuperInsights {
  generatedAt: string;
  clients: SuperInsightClient[];
  registrationTypes: SuperRegistrationType[];
  filings: SuperInsightFiling[];
  months: SuperMonth[];
  team: {
    managers: SuperTeamManager[];
    /** Leads with no manager set on their profile. */
    unassignedLeads: SuperTeamLead[];
    admins: SuperTeamAdmin[];
  };
  /** What admins and super admins did recently, newest first. */
  adminFeed: SuperActivityEntry[];
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** YYYY-MM-DD in UTC. */
export function ymdOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The YYYY-MM-DD part of a date or timestamp string; null when it does not parse. */
export function dayOf(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : ymdOf(parsed);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetweenDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The last `count` month keys ending with the month of `now`, oldest first. */
export function monthKeys(now: Date, count = 12): string[] {
  const out: string[] = [];
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** First day (YYYY-MM-DD) of the oldest month in the report window. */
export function windowFloor(now: Date, count = 12): string {
  return `${monthKeys(now, count)[0]}-01`;
}

function monthLabels(key: string): { label: string; longLabel: string } {
  const [y, m] = key.split('-').map(Number);
  const i = (m ?? 1) - 1;
  return { label: MONTH_SHORT[i] ?? key, longLabel: `${MONTH_LONG[i] ?? key} ${y}` };
}

/* ------------------------------------------------------------------ *
 * Filings
 * ------------------------------------------------------------------ */

/** Filed when the status says so or a filing date is recorded. */
export function isFiled(filing: Pick<SuperInsightFiling, 'status' | 'filedOn'>): boolean {
  return filing.status === 'filed' || Boolean(filing.filedOn?.trim());
}

/**
 * On time, late, overdue or still open. A filing without a filing date but marked filed counts
 * as on time, because the stored status is the only evidence there is.
 */
export function filingOutcome(filing: SuperInsightFiling, today: string): SuperFilingOutcome {
  if (isFiled(filing)) {
    const filed = dayOf(filing.filedOn);
    return filed && filed > filing.dueDate ? 'late' : 'on-time';
  }
  return filing.dueDate < today || filing.status === 'overdue' ? 'overdue' : 'open';
}

/* ------------------------------------------------------------------ *
 * Months
 * ------------------------------------------------------------------ */

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function buildMonths(
  clients: SuperInsightClient[],
  filings: SuperInsightFiling[],
  now: Date,
  count = 12,
): SuperMonth[] {
  const today = ymdOf(now);
  const months = new Map<string, SuperMonth & { coi: number[] }>();
  for (const key of monthKeys(now, count)) {
    months.set(key, {
      key,
      ...monthLabels(key),
      engagementsStarted: 0,
      certificatesIssued: 0,
      avgDaysToCoi: null,
      filingsDue: 0,
      filedOnTime: 0,
      filedLate: 0,
      overdue: 0,
      open: 0,
      coi: [],
    });
  }

  for (const client of clients) {
    const started = dayOf(client.summary.createdAt);
    const startMonth = started ? months.get(started.slice(0, 7)) : undefined;
    if (startMonth) startMonth.engagementsStarted += 1;

    if (client.startedPreInc && client.certificateDate) {
      const month = months.get(client.certificateDate.slice(0, 7));
      if (month) {
        month.certificatesIssued += 1;
        if (client.daysToCoi !== null) month.coi.push(client.daysToCoi);
      }
    }
  }

  for (const filing of filings) {
    const month = months.get(filing.dueDate.slice(0, 7));
    if (!month) continue;
    month.filingsDue += 1;
    const outcome = filingOutcome(filing, today);
    if (outcome === 'on-time') month.filedOnTime += 1;
    else if (outcome === 'late') month.filedLate += 1;
    else if (outcome === 'overdue') month.overdue += 1;
    else month.open += 1;
  }

  return [...months.values()].map(({ coi, ...month }) => ({ ...month, avgDaysToCoi: average(coi) }));
}

/* ------------------------------------------------------------------ *
 * Team
 * ------------------------------------------------------------------ */

export interface SuperStaffInput {
  id: string;
  name: string;
  email: string;
  role: string;
  internId: string | null;
  reportsToManagerId: string | null;
  status: string;
}

function openOf(summary: SuperEngagementSummary): number {
  return summary.ballInCourt.firm + summary.ballInCourt.client;
}

export function buildTeam(params: {
  staff: SuperStaffInput[];
  clients: SuperInsightClient[];
  filings: SuperInsightFiling[];
  lastActive: Map<string, string>;
  actions30d: Map<string, number>;
  isAttention: (summary: SuperEngagementSummary) => boolean;
  now: Date;
}): SuperInsights['team'] {
  const { staff, clients, filings, lastActive, actions30d, isAttention, now } = params;
  const today = ymdOf(now);

  const filingsByEngagement = new Map<string, SuperInsightFiling[]>();
  for (const filing of filings) {
    const list = filingsByEngagement.get(filing.engagementId) ?? [];
    list.push(filing);
    filingsByEngagement.set(filing.engagementId, list);
  }

  const leadRow = (person: SuperStaffInput): SuperTeamLead => {
    const mine = person.internId
      ? clients.filter((client) => client.leadIds.includes(person.internId!))
      : [];
    return {
      id: person.id,
      name: person.name,
      email: person.email,
      internId: person.internId,
      status: person.status,
      lastActiveAt: lastActive.get(person.id) ?? null,
      clients: mine.length,
      openSteps: mine.reduce((sum, client) => sum + openOf(client.summary), 0),
      overdueSteps: mine.reduce((sum, client) => sum + client.summary.steps.overdue, 0),
      attention: mine.filter((client) => isAttention(client.summary)).length,
    };
  };

  const leads = staff.filter((person) => person.role === 'intern');
  const managerIds = new Set(staff.filter((p) => p.role === 'manager').map((p) => p.id));

  const managers: SuperTeamManager[] = staff
    .filter((person) => person.role === 'manager')
    .map((person) => {
      const mine = clients.filter((client) => client.managerIds.includes(person.id));
      const myFilings = mine.flatMap((client) => filingsByEngagement.get(client.summary.id) ?? []);
      const outcomes = myFilings.map((filing) => filingOutcome(filing, today));
      return {
        id: person.id,
        name: person.name,
        email: person.email,
        status: person.status,
        lastActiveAt: lastActive.get(person.id) ?? null,
        clients: mine.length,
        incorporating: mine.filter((client) => !client.summary.incorporated).length,
        openSteps: mine.reduce((sum, client) => sum + openOf(client.summary), 0),
        overdueSteps: mine.reduce((sum, client) => sum + client.summary.steps.overdue, 0),
        approvalsPending: mine.reduce((sum, client) => sum + client.summary.approvalsPending, 0),
        attention: mine.filter((client) => isAttention(client.summary)).length,
        overdueFilings: outcomes.filter((o) => o === 'overdue').length,
        filedOnTime: outcomes.filter((o) => o === 'on-time').length,
        filedLate: outcomes.filter((o) => o === 'late').length,
        avgDaysToCoi: average(
          mine.flatMap((client) => (client.daysToCoi === null ? [] : [client.daysToCoi])),
        ),
        leads: leads
          .filter((lead) => lead.reportsToManagerId === person.id)
          .map(leadRow)
          .sort((a, b) => b.openSteps - a.openSteps || a.name.localeCompare(b.name)),
      };
    })
    .sort((a, b) => b.clients - a.clients || a.name.localeCompare(b.name));

  const unassignedLeads = leads
    .filter((lead) => !lead.reportsToManagerId || !managerIds.has(lead.reportsToManagerId))
    .map(leadRow)
    .sort((a, b) => b.openSteps - a.openSteps || a.name.localeCompare(b.name));

  const admins: SuperTeamAdmin[] = staff
    .filter((person) => person.role === 'admin' || person.role === 'super_admin')
    .map((person) => ({
      id: person.id,
      name: person.name,
      email: person.email,
      role: person.role === 'super_admin' ? 'Super admin' : 'Admin',
      lastActiveAt: lastActive.get(person.id) ?? null,
      actions30d: actions30d.get(person.id) ?? 0,
    }));

  return { managers, unassignedLeads, admins };
}

/* ------------------------------------------------------------------ *
 * Risks
 * ------------------------------------------------------------------ */

export type SuperRiskKind = 'step' | 'filing' | 'stuck' | 'owner' | 'lead';

export const SUPER_RISK_LABEL: Record<SuperRiskKind, string> = {
  step: 'Overdue step',
  filing: 'Overdue filing',
  stuck: 'Stuck',
  owner: 'No manager',
  lead: 'No lead',
};

/** A client with open work and no move for this many days is stuck. */
export const SUPER_STUCK_DAYS = 14;

export interface SuperRisk {
  id: string;
  kind: SuperRiskKind;
  title: string;
  engagementId: string;
  companyName: string;
  href: string;
  managerName: string | null;
  leadName: string | null;
  /** Days overdue, idle or unassigned; null when no date says. */
  ageDays: number | null;
  /** 1 to 3, from the kind and the age. */
  severity: 1 | 2 | 3;
}

function severityFor(kind: SuperRiskKind, age: number | null): 1 | 2 | 3 {
  if (kind === 'filing') return age !== null && age > 30 ? 3 : age !== null && age > 7 ? 2 : 1;
  if (kind === 'step') return 3;
  if (kind === 'stuck') return age !== null && age > 30 ? 3 : 2;
  return 2;
}

/** Overdue steps, overdue filings, stuck clients and clients with nobody on them. */
export function buildRisks(insights: Pick<SuperInsights, 'clients' | 'filings'>, now: Date): SuperRisk[] {
  const today = ymdOf(now);
  const out: SuperRisk[] = [];
  const byId = new Map(insights.clients.map((client) => [client.summary.id, client]));

  for (const client of insights.clients) {
    const s = client.summary;
    const base = {
      engagementId: s.id,
      companyName: s.companyName,
      managerName: s.managerName,
      leadName: s.leadName,
    };

    for (const step of client.overdueSteps) {
      out.push({
        ...base,
        id: `step:${s.id}:${step.id}`,
        kind: 'step',
        title: step.title,
        href: step.href,
        ageDays: s.idleDays,
        severity: severityFor('step', s.idleDays),
      });
    }

    const open = s.currentStep !== null;
    if (open && (s.stuckReason === 'blocked' || (s.idleDays ?? 0) >= SUPER_STUCK_DAYS)) {
      out.push({
        ...base,
        id: `stuck:${s.id}`,
        kind: 'stuck',
        title: s.currentStep ? `No move on ${s.currentStep.title}` : 'No move',
        href: s.href,
        ageDays: s.idleDays,
        severity: severityFor('stuck', s.idleDays),
      });
    }

    const createdDay = dayOf(s.createdAt);
    const sinceCreated = createdDay ? Math.max(0, daysBetweenDays(createdDay, today)) : null;
    if (open && client.managerIds.length === 0) {
      out.push({
        ...base,
        id: `owner:${s.id}`,
        kind: 'owner',
        title: 'No manager on this client',
        href: s.href,
        ageDays: sinceCreated,
        severity: severityFor('owner', sinceCreated),
      });
    }
    if (open && client.leadIds.length === 0) {
      out.push({
        ...base,
        id: `lead:${s.id}`,
        kind: 'lead',
        title: 'No project lead on this client',
        href: s.href,
        ageDays: sinceCreated,
        severity: severityFor('lead', sinceCreated),
      });
    }
  }

  for (const filing of insights.filings) {
    if (filingOutcome(filing, today) !== 'overdue') continue;
    const client = byId.get(filing.engagementId);
    const age = Math.max(0, daysBetweenDays(filing.dueDate, today));
    out.push({
      id: `filing:${filing.id}`,
      kind: 'filing',
      title: filing.periodLabel ? `${filing.title} · ${filing.periodLabel}` : filing.title,
      engagementId: filing.engagementId,
      companyName: filing.companyName,
      href: filing.href,
      managerName: client?.summary.managerName ?? null,
      leadName: client?.summary.leadName ?? null,
      ageDays: age,
      severity: severityFor('filing', age),
    });
  }

  return out.sort(
    (a, b) =>
      b.severity - a.severity ||
      (b.ageDays ?? -1) - (a.ageDays ?? -1) ||
      a.companyName.localeCompare(b.companyName),
  );
}

/* ------------------------------------------------------------------ *
 * Registrations
 * ------------------------------------------------------------------ */

export interface SuperRegTypeCounts {
  id: string;
  title: string;
  done: number;
  progress: number;
  waiting: number;
  overdue: number;
  /** Clients for whom this registration applies (not marked not needed). */
  needed: number;
}

/** Per registration type: how many clients are done, working, waiting or overdue. */
export function registrationCounts(insights: Pick<SuperInsights, 'clients' | 'registrationTypes'>): SuperRegTypeCounts[] {
  return insights.registrationTypes.map((type) => {
    const row: SuperRegTypeCounts = { ...type, done: 0, progress: 0, waiting: 0, overdue: 0, needed: 0 };
    for (const client of insights.clients) {
      const cell = client.registrations[type.id];
      if (!cell || cell === 'not-needed') continue;
      row.needed += 1;
      if (cell === 'done') row.done += 1;
      else if (cell === 'progress') row.progress += 1;
      else if (cell === 'waiting') row.waiting += 1;
      else if (cell === 'overdue') row.overdue += 1;
    }
    return row;
  });
}

/** True when the client has reached the registration phase (any step settled or open). */
export function inRegistrations(client: SuperInsightClient): boolean {
  return Object.values(client.registrations).some((cell) => cell !== 'locked' && cell !== 'not-needed');
}
