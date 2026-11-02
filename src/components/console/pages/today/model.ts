/**
 * MANAGER TODAY — the item lists every Today panel and the manager's sidebar
 * extras count from. Pure: no React, no fetch. `useToday` feeds it what the app
 * already loads for the signed-in manager (the book, each engagement's checklist
 * state, team tasks, document requests, the filings register, the approvals
 * inbox and the book's project leads).
 *
 * The prototype's rule holds — every number is a count of one of these lists,
 * so the numbers on the page always agree:
 *
 *   clients  one per engagement: stage, current step, who holds it and since
 *            when, its filings, health, next date
 *   queue    what needs you or your team next (Focus, Who holds the ball, the
 *            Act now / Overdue / Waiting tiles): approvals, each client's
 *            current step, unfiled filings overdue or due within 14 days, open
 *            document requests
 *   team     the leads' work (Team tasks, the lead bars, the sidebar lead
 *            counts, the orbit key): team tasks, each client's current step,
 *            filings, and what closed this week
 *   week     Mon–Sun of this week (This week, the This week tile): filings,
 *            step deadlines, team tasks due, and what closed each day
 *
 * The Stage filter (all / incorporating / compliance) is applied here, before
 * anything is counted. Steps come from the client portal's step model (the
 * same sequential gate the whole tool uses); filings from the register
 * (`/api/filings`, the rows the Filings register and Calendar show).
 */
import type { DocRequest, Engagement, TaskInstance } from '@/data/engagements';
import { buildIncorporationModel, type PortalIncorporationModel, type PortalPhase, type PortalStep } from '@/lib/client-portal/step-model';
import { companyShortName } from '@/lib/client-portal/company';
import { areaOf, AREA_LABEL, type AreaCode } from '@/lib/client-portal/compliances';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import type { FilingRow } from '@/lib/filings';
import { MANAGER_APPROVAL_STEP_ID } from '@/lib/pre-inc-direct-flow';
import type { PendingApprovalRow } from '@/lib/pending-approvals';
import { stepSlugForItemId } from '@/lib/slug';
import { stepCode as clientsStepCode } from '../clients/model';

/* ================================================================ days */

const DAY_MS = 864e5;
const IST_MS = 5.5 * 3600e3;
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const at = (s: string): number => Date.parse(`${s.slice(0, 10)}T00:00:00Z`);
export const addDays = (s: string, n: number): string => new Date(at(s) + n * DAY_MS).toISOString().slice(0, 10);
/** Whole days from `a` to `b` (negative when `b` is earlier). */
export const daysBetween = (a: string, b: string): number => Math.round((at(b) - at(a)) / DAY_MS);

/** A date (`YYYY-MM-DD`) or timestamp → the day it falls on in India. */
export function istDay(v?: string | null): string | undefined {
  const s = v?.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
  return new Date(t + IST_MS).toISOString().slice(0, 10);
}

/** Monday … Sunday of the week holding `today`. */
export function weekOf(today: string): string[] {
  const wd = new Date(at(today)).getUTCDay();
  const monday = addDays(today, -((wd + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const weekday = (s: string): string => WD[new Date(at(s)).getUTCDay()]!;
/** "30 Oct" this year, "30 Oct 2025" otherwise (README date rule). */
export function dShort(s: string, today: string): string {
  const d = new Date(at(s));
  const base = `${d.getUTCDate()} ${MON_SHORT[d.getUTCMonth()]}`;
  return s.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${d.getUTCFullYear()}`;
}
/** "Fri 30 Oct" (this year) — where the weekday matters. */
export const dDay = (s: string, today: string): string => `${weekday(s)} ${dShort(s, today)}`;
export const monthLabel = (s: string): string => MON_LONG[new Date(at(s)).getUTCMonth()]!;
/** "3d" style age. */
export const age = (n: number): string => `${Math.max(0, n)}d`;
/** "1 day late" / "5 days late". */
export const late = (n: number): string => `${n} day${n === 1 ? '' : 's'} late`;
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/* ================================================================ vocabulary (README: one vocabulary everywhere) */

export type Stage = 'inc' | 'cmp';
export type Scope = 'all' | Stage;

/** Who acts next on an item. "You" is your side of the firm (you and your leads). */
export type Holder = 'you' | 'client' | 'mca' | 'mgr';
export const HOLDER_LABEL: Record<Holder, string> = { you: 'You', client: 'Client', mca: 'MCA', mgr: 'Manager' };

/** Focus / heat-map states, in rank order. */
export type QState = 'over' | 'due' | 'you' | 'wait' | 'up';
export const Q_ORDER: QState[] = ['over', 'due', 'you', 'wait', 'up'];
export const Q_LABEL: Record<QState, string> = { over: 'Overdue', due: 'Due this week', you: 'With you', wait: 'Waiting', up: 'Upcoming' };
export const Q_COLOR: Record<QState, string> = { over: 'var(--over)', due: 'var(--due)', you: 'var(--mx-run)', wait: 'var(--mx-wait)', up: 'var(--mx-none2)' };
export const Q_TIP: Record<QState, string> = {
  over: 'Past its date: late steps and overdue filings',
  due: 'Due in the next 7 days',
  you: 'You or your leads act next',
  wait: 'Waiting on the client or MCA',
  up: 'Filings due in 8 to 14 days',
};

/** Steps and tasks (README vocabulary). */
export type TSt = 'over' | 'due' | 'run' | 'wait' | 'none' | 'done';
export const T_ORDER: TSt[] = ['over', 'due', 'run', 'wait', 'none', 'done'];
export const T_LABEL: Record<TSt, string> = { over: 'Overdue', due: 'Due this week', run: 'In progress', wait: 'Waiting on client', none: 'Not started', done: 'Done' };
export const T_COLOR: Record<TSt, string> = { over: 'var(--over)', due: 'var(--due)', run: 'var(--mx-run)', wait: 'var(--mx-wait)', none: 'var(--mx-none)', done: 'var(--mx-ok)' };
export const T_PILL: Record<TSt, string> = { over: 'over', due: 'due', run: 'up', wait: 'mut', none: 'na', done: 'ok' };

/** Filings (README vocabulary). */
export type FSt = 'f' | 'l' | 'o' | 'd' | 'u';
export const F_ORDER: FSt[] = ['f', 'l', 'o', 'd', 'u'];
export const F_LABEL: Record<FSt, string> = { f: 'Filed on time', l: 'Filed late', o: 'Overdue', d: 'Due this week', u: 'Upcoming' };
/** README colours: green done (late filings a muted green), red overdue, amber due soon, grey upcoming. */
export const F_COLOR: Record<FSt, string> = {
  f: 'var(--mx-ok)',
  l: 'color-mix(in srgb, var(--mx-ok) 50%, var(--ink-3))',
  o: 'var(--over)',
  d: 'var(--due)',
  u: 'var(--mx-none)',
};
export const F_PILL: Record<FSt, string> = { f: 'ok', l: 'ok', o: 'over', d: 'due', u: 'na' };

/** Client health (README vocabulary). */
export type Health = 'ok' | 'risk' | 'stuck' | 'new';
export const HEALTH_ORDER: Health[] = ['ok', 'risk', 'stuck', 'new'];
export const HEALTH_LABEL: Record<Health, string> = { ok: 'On track', risk: 'At risk', stuck: 'Stuck', new: 'New' };
export const HEALTH_COLOR: Record<Health, string> = { ok: 'var(--mx-ok)', risk: 'var(--due)', stuck: 'var(--over)', new: 'var(--mx-wait)' };
export const HEALTH_RANK: Record<Health, number> = { stuck: 0, risk: 1, new: 2, ok: 3 };

/** "Pre-13", "Post-3" — the step codes the lead cockpit prints; registration steps carry no code. */
export function stepCode(id: string): string {
  const code = clientsStepCode(id);
  return code && code !== id ? code : '';
}

/** Seat-aware links (`useConsole().base`: /app/manager, /app/intern). */
export const clientPath = (base: string, e: Pick<Engagement, 'slug' | 'id'>): string => `${base}/projects/${e.slug ?? e.id}`;
export const stepPath = (base: string, e: Pick<Engagement, 'slug' | 'id'>, stepId: string): string =>
  `${clientPath(base, e)}/step/${stepSlugForItemId(stepId)}`;

/* ================================================================ shapes */

/** A project lead (from `/api/engagements/leads`) or a roster person. */
export interface LeadPerson {
  internId?: string;
  profileId?: string | null;
  name: string;
}

export interface FView {
  id: string;
  row: FilingRow;
  clientId: string;
  /** Particular plus the period ("GSTR-3B · Sep 2026"). */
  name: string;
  area: AreaCode;
  areaLabel: string;
  due: string;
  filedOn?: string;
  st: FSt;
  /** due − today, in days. */
  days: number;
}

export interface TClient {
  id: string;
  slug?: string;
  e: Engagement;
  name: string;
  short: string;
  initials: string;
  stage: Stage;
  inScope: boolean;
  href: string;
  leadKey?: string;
  leadName?: string;
  model: PortalIncorporationModel;
  /** The open step the gate is on; undefined once all 48 are done. */
  current?: PortalStep;
  /** 0–3 (phase index of the current step); 4 when all steps are done. */
  phaseIdx: number;
  done: number;
  total: number;
  holder?: Holder;
  /** The manager's own decision is pending on this client. */
  mine: boolean;
  since?: string;
  heldDays?: number;
  late: boolean;
  lateDays: number;
  approvals: PendingApprovalRow[];
  filings: FView[];
  overdue: number;
  health: Health;
  healthWhy: string;
  next?: { iso: string; what: string; overdue: boolean };
  /** Manager-set incorporation window end (expected COI). */
  coi?: string;
  coiDays?: number;
  /** When the certificate came (incorporation date, else the Pre-12 done date). */
  coiOn?: string;
}

export type QSource = 'approval' | 'step' | 'filing' | 'request';
export interface QItem {
  id: string;
  clientId: string;
  source: QSource;
  code: string;
  title: string;
  why: string;
  state: QState;
  holder: Holder;
  mine: boolean;
  status: string;
  pill: string;
  /** `nudge` (lead seat): send the approval request to the manager again, as live's "Email manager again". */
  cta: { label: string; to: 'step' | 'filings' | 'client' | 'mail' | 'nudge'; href: string };
  due?: string;
  since?: string;
  days?: number;
  pri: boolean;
  stepId?: string;
}

export type TKind = 'task' | 'step' | 'filing';
export interface TItem {
  id: string;
  kind: TKind;
  title: string;
  sub: string;
  clientId: string;
  /** Book lead key (`internId`) or a pseudo key: '@me', '@none', '@other'. */
  leadKey: string;
  leadName: string;
  st: TSt;
  due?: string;
  /** "Overdue 8d" · "Today" · "Fri 30 Oct" · "Done" */
  dueLabel: string;
  taskId?: string;
  stepId?: string;
  filingId?: string;
  /** Dates set by the manager (a schedule window) — the lead can only ask to change them. */
  locked?: boolean;
}

export type WLane = 'filing' | 'step' | 'task' | 'done';
export interface WItem {
  id: string;
  lane: WLane;
  day: string;
  title: string;
  clientId: string;
  open: boolean;
  /** What a click opens. */
  ref: { kind: 'filing' | 'step' | 'task'; stepId?: string; taskId?: string; filingId?: string };
}

export interface DoneItem {
  id: string;
  kind: 'step' | 'filing';
  title: string;
  clientId: string;
  on: string;
  stepId?: string;
}

export interface LeadSum {
  key: string;
  name: string;
  initials: string;
  profileId?: string;
  /** Every book client this person leads (primary), in or out of scope — the orbit ring. */
  clientIds: string[];
  /** Open team items (in scope) — the sidebar count, the orbit key, the lead bar. */
  open: TItem[];
  overdue: number;
}

export interface Practice {
  pipeline: Array<{ key: 'name' | 'spice' | 'mca' | 'coi'; label: string; clients: TClient[] }>;
  /** Average days from project start to the certificate, over companies incorporated here. */
  avgDaysToCoi: number | null;
  coiCount: number;
  regs: { done: number; run: number; wait: number; top: Array<{ title: string; n: number }>; mostWaiting?: { title: string; n: number } };
  monthCounts: Record<FSt, number>;
  worstArea?: { area: AreaCode; label: string; n: number };
}

export interface TodayInput {
  today: string;
  /** Link base of the seat (default the manager's). */
  base?: string;
  /** 'lead': approvals wait on the manager instead of needing you. */
  seat?: 'mgr' | 'lead';
  meId: string;
  scope: Scope;
  engagements: Engagement[];
  stateFor: (e: Engagement) => Record<string, ChecklistItemStateSlice | undefined> | undefined;
  tasks: TaskInstance[];
  requests: DocRequest[];
  filings: FilingRow[];
  approvals: PendingApprovalRow[];
  leads: LeadPerson[];
  /** Extra names (the intern roster), matched by profile id or intern key. */
  people?: LeadPerson[];
}

export interface TodayModel {
  today: string;
  week: string[];
  monthKey: string;
  month: string;
  scope: Scope;
  /** Every client in the book (the orbit dims those out of scope). */
  all: TClient[];
  /** Clients in scope. */
  clients: TClient[];
  byId: Record<string, TClient>;
  /** Book counts per stage (unscoped) — the scope switch. */
  counts: { all: number; inc: number; cmp: number };
  queue: QItem[];
  team: TItem[];
  week7: WItem[];
  done: DoneItem[];
  leads: LeadSum[];
  /** In-scope filings, every month; `monthRows` is this month's. */
  filings: FView[];
  monthRows: FView[];
  kpi: { act: QItem[]; over: QItem[]; wait: QItem[]; weekOpen: WItem[]; doneToday: DoneItem[] };
  approvals: PendingApprovalRow[];
  practice: Practice;
}

/* ================================================================ helpers */

export function initialsOf(name: string): string {
  const words = companyShortName(name).split(/\s+/).filter(Boolean);
  const full = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  if (full.length >= 2) return (full[0]![0]! + full[1]![0]!).toUpperCase();
  return (full[0] ?? '?').slice(0, 2).toUpperCase();
}

export function personInitials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** The tool's one answer to "is it incorporated yet?" — compliance once it is. */
export function stageOf(e: Engagement, state: Record<string, ChecklistItemStateSlice | undefined> | undefined): Stage {
  return isIncorporated(e, state ?? null) ? 'cmp' : 'inc';
}

export const inScope = (stage: Stage, scope: Scope): boolean => scope === 'all' || scope === stage;

/** Filing status in the README vocabulary: on time / late / overdue / due within 7 days / upcoming. */
export function filingSt(row: Pick<FilingRow, 'dueDate' | 'filedOn'>, today: string): FSt {
  const due = row.dueDate.slice(0, 10);
  const filed = istDay(row.filedOn);
  if (filed) return filed <= due ? 'f' : 'l';
  const d = daysBetween(today, due);
  if (d < 0) return 'o';
  if (d <= 6) return 'd';
  return 'u';
}

/**
 * The register's period label usually repeats the particular with its period
 * ("Advance Tax Payment Q3 2025"); use it whole then, else add the period part.
 */
export function filingName(row: Pick<FilingRow, 'particular' | 'periodLabel'>): string {
  const p = row.particular.trim();
  const pl = row.periodLabel?.trim();
  if (!pl) return p;
  if (pl.toLowerCase().startsWith(p.toLowerCase())) return pl;
  const tail = /(FY\s*\d{4}-\d{2}|Q[1-4]\s*\d{4}|\b\d{4}\b)/i.exec(pl)?.[1];
  return tail ? `${p} ${tail}` : p;
}

/** The day this person last finished a step before `idx`, else the project start. */
function previousDone(steps: PortalStep[], idx: number, fallback: string): string {
  for (let i = idx - 1; i >= 0; i--) {
    const d = steps[i]?.doneOn;
    if (d) return d;
  }
  return fallback;
}

/** When the current holder got the step (best effort, from stamps the state keeps). */
function heldSince(step: PortalStep, steps: PortalStep[], createdAt: string): string {
  const s = step.slice;
  const idx = steps.indexOf(step);
  const prev = previousDone(steps, idx, createdAt);
  if (step.kind === 'with') return istDay(s?.clientSubmittedAt) ?? istDay(s?.lastEditedAt) ?? step.since ?? prev;
  const fill = s?.clientFillRequest;
  return (
    istDay(fill?.sentToClientAt) ??
    istDay(fill?.decidedAt) ??
    istDay(s?.approval?.managerApprovedAt) ??
    (s?.reviewStatus === 'rejected' ? istDay(s?.reviewedAt) : undefined) ??
    prev
  );
}

function holderOf(step: PortalStep): Holder {
  if (step.kind === 'you' || step.kind === 'prog') return 'client';
  return step.owner === 'mca' ? 'mca' : 'you';
}

const PIPE: Array<{ key: Practice['pipeline'][number]['key']; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'spice', label: 'SPICe+' },
  { key: 'mca', label: 'MCA review' },
  { key: 'coi', label: 'Certificate' },
];
function pipeKey(c: TClient): Practice['pipeline'][number]['key'] {
  const cur = c.current;
  if (!cur || cur.phaseNo === 1) return 'name';
  if (cur.id === 'pre-11') return 'mca';
  if (cur.id === 'pre-12') return 'coi';
  return 'spice';
}

/* ================================================================ build */

export function buildToday(input: TodayInput): TodayModel {
  const { today, scope } = input;
  const base = input.base ?? '/app/manager';
  const lead = input.seat === 'lead';
  const week = weekOf(today);
  const weekSet = new Set(week);
  const monthKey = today.slice(0, 7);

  /* ---------- people: book leads first, then the roster */
  const byKey = new Map<string, LeadPerson>();
  const byProfile = new Map<string, LeadPerson>();
  for (const p of [...input.leads, ...(input.people ?? [])]) {
    if (p.internId && !byKey.has(p.internId)) byKey.set(p.internId, p);
    if (p.profileId && !byProfile.has(p.profileId)) byProfile.set(p.profileId, p);
  }
  const leadName = (key?: string): string | undefined => (key ? byKey.get(key)?.name ?? key : undefined);

  /* ---------- approvals by client */
  const apprBy = new Map<string, PendingApprovalRow[]>();
  for (const a of input.approvals) {
    const list = apprBy.get(a.engagementId) ?? [];
    list.push(a);
    apprBy.set(a.engagementId, list);
  }

  /* ---------- filings by client */
  const filBy = new Map<string, FView[]>();
  for (const row of input.filings) {
    const area = areaOf(row.authority, row.compliance);
    const fv: FView = {
      id: row.id,
      row,
      clientId: row.engagementId,
      name: filingName(row),
      area,
      areaLabel: AREA_LABEL[area],
      due: row.dueDate.slice(0, 10),
      filedOn: istDay(row.filedOn),
      st: filingSt(row, today),
      days: daysBetween(today, row.dueDate.slice(0, 10)),
    };
    const list = filBy.get(row.engagementId) ?? [];
    list.push(fv);
    filBy.set(row.engagementId, list);
  }

  /* ---------- clients */
  const all: TClient[] = input.engagements.map((e) => {
    const state = input.stateFor(e) ?? {};
    const model = buildIncorporationModel(state, e.schedule ?? null, today);
    const stage = stageOf(e, state);
    const current = model.steps.find((s) => s.kind !== 'done' && s.kind !== 'up' && s.kind !== 'next');
    const approvals = apprBy.get(e.id) ?? [];
    const filings = (filBy.get(e.id) ?? []).sort((a, b) => a.due.localeCompare(b.due));
    const overdue = filings.filter((f) => f.st === 'o').length;
    const leadKey = e.internId?.trim() || e.leadIds?.[0] || undefined;
    const created = istDay(e.createdAt) ?? today;
    const since = current ? heldSince(current, model.steps, created) : undefined;
    const mine = approvals.length > 0;
    const holder: Holder | undefined = mine ? (lead ? 'mgr' : 'you') : current ? holderOf(current) : undefined;
    const isLate = !!current?.late;
    const lateDays = current?.lateDays ?? 0;
    let health: Health;
    let healthWhy: string;
    if (isLate || overdue > 0 || e.health === 'overdue') {
      health = 'stuck';
      healthWhy = isLate
        ? `${current!.title} is ${late(lateDays)}`
        : overdue > 0
          ? `${plural(overdue, 'filing')} overdue`
          : 'Marked overdue by the team';
    } else if (e.health === 'at-risk') {
      health = 'risk';
      healthWhy = 'Marked at risk by the team';
    } else if (current?.due && daysBetween(today, current.due) >= 0 && daysBetween(today, current.due) <= 3) {
      // same rule as the Clients chain (healthOf): the current step is due within 3 days
      const d = daysBetween(today, current.due);
      health = 'risk';
      healthWhy = `${current.title} is due ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}`;
    } else if (stage === 'inc' && model.all.done === 0) {
      health = 'new';
      healthWhy = 'No step done yet';
    } else {
      health = 'ok';
      healthWhy = 'Nothing is late';
    }
    const overdueDates = [
      ...(isLate && current?.due ? [current.due] : []),
      ...filings.filter((f) => f.st === 'o').map((f) => f.due),
    ].sort();
    const upcoming = [
      ...(current?.due && !isLate ? [{ iso: current.due, what: current.title }] : []),
      ...filings.filter((f) => f.st === 'd' || f.st === 'u').map((f) => ({ iso: f.due, what: f.name })),
    ].sort((a, b) => a.iso.localeCompare(b.iso));
    const next = overdueDates.length
      ? { iso: overdueDates[0]!, what: 'Overdue', overdue: true }
      : upcoming[0]
        ? { ...upcoming[0], overdue: false }
        : undefined;
    const coi = model.coiExpected;
    return {
      id: e.id,
      slug: e.slug,
      e,
      name: e.companyName,
      short: companyShortName(e.companyName) || e.companyName,
      initials: initialsOf(e.companyName),
      stage,
      inScope: inScope(stage, scope),
      href: clientPath(base, e),
      leadKey,
      leadName: leadName(leadKey),
      model,
      current,
      phaseIdx: current ? current.phaseNo - 1 : 4,
      done: model.all.done,
      total: model.all.total,
      holder,
      mine,
      since,
      heldDays: since ? Math.max(0, daysBetween(since, today)) : undefined,
      late: isLate,
      lateDays,
      approvals,
      filings,
      overdue,
      health,
      healthWhy,
      next,
      coi,
      coiDays: coi ? daysBetween(today, coi) : undefined,
      coiOn: istDay(e.incorporationDate) ?? model.byId['pre-12']?.doneOn,
    };
  });
  const byId = Object.fromEntries(all.map((c) => [c.id, c]));
  const clients = all.filter((c) => c.inScope);
  const scoped = new Set(clients.map((c) => c.id));
  const counts = { all: all.length, inc: all.filter((c) => c.stage === 'inc').length, cmp: all.filter((c) => c.stage === 'cmp').length };

  /* ---------- queue */
  const queue: QItem[] = [];
  for (const c of clients) {
    const stepHref = (id: string) => stepPath(base, c.e, id);
    const covered = new Set<string>();
    for (const a of c.approvals) {
      const step = c.model.byId[a.itemId];
      covered.add(a.itemId);
      const approve = !!a.clientFill || a.reviewSource === 'lead_manager_request' || a.itemId === MANAGER_APPROVAL_STEP_ID;
      const since =
        istDay(step?.slice?.clientFillRequest?.requestedAt) ??
        istDay(step?.slice?.clientSubmittedAt) ??
        istDay(step?.slice?.lastEditedAt) ??
        (step ? heldSince(step, c.model.steps, istDay(c.e.createdAt) ?? today) : undefined);
      const days = since ? Math.max(0, daysBetween(since, today)) : undefined;
      const isLate = !!step?.late;
      queue.push({
        id: `a:${c.id}:${a.itemId}:${a.clientFill ? 'fill' : 'review'}`,
        clientId: c.id,
        source: 'approval',
        code: stepCode(a.itemId),
        title: step?.title ?? a.itemId,
        why: lead
          ? a.clientFill
            ? 'Your manager decides whether it goes to the client'
            : a.reviewSource === 'lead_manager_request' || a.itemId === MANAGER_APPROVAL_STEP_ID
              ? 'Waiting on your manager’s approval'
              : 'Waiting on your manager’s review of the client’s submission'
          : a.clientFill
          ? `${a.clientFill.requestedByName ?? 'Your lead'} asks to send it to the client`
          : a.reviewSource === 'lead_manager_request' || a.itemId === MANAGER_APPROVAL_STEP_ID
            ? 'Your lead asks for your approval'
            : 'The client submitted it for your review',
        state: isLate ? 'over' : lead ? 'wait' : 'you',
        holder: lead ? 'mgr' : 'you',
        mine: !lead,
        status: isLate ? late(step!.lateDays) : lead ? `Manager · ${age(days ?? 0)}` : 'Needs you',
        pill: isLate ? 'over' : lead ? 'mut' : 'due',
        cta: lead
          ? a.reviewSource === 'lead_manager_request' && !a.clientFill
            ? { label: 'Email manager again', to: 'nudge', href: '' }
            : { label: 'Open step', to: 'step', href: stepHref(a.itemId) }
          : { label: approve ? 'Approve' : 'Review', to: 'step', href: stepHref(a.itemId) },
        due: step?.due,
        since,
        days,
        pri: !lead,
        stepId: a.itemId,
      });
    }
    const cur = c.current;
    if (cur && !covered.has(cur.id)) {
      const holder = holderOf(cur);
      const dueIn = cur.due ? daysBetween(today, cur.due) : undefined;
      const state: QState = cur.late ? 'over' : dueIn !== undefined && dueIn <= 6 ? 'due' : holder === 'you' ? 'you' : 'wait';
      const days = c.heldDays;
      const status =
        state === 'over'
          ? late(cur.lateDays)
          : state === 'due'
            ? `Due ${dueIn === 0 ? 'today' : dDay(cur.due!, today)}`
            : `${HOLDER_LABEL[holder]} · ${age(days ?? 0)}`;
      const why =
        holder === 'client'
          ? cur.slice?.reviewStatus === 'rejected'
            ? 'Sent back to the client'
            : 'Waiting on the client'
          : holder === 'mca'
            ? 'With MCA'
            : cur.slice?.reviewStatus === 'accepted'
              ? 'Accepted · deliver'
              : 'Your lead is on it';
      queue.push({
        id: `s:${c.id}:${cur.id}`,
        clientId: c.id,
        source: 'step',
        code: stepCode(cur.id),
        title: cur.title,
        why,
        state,
        holder,
        mine: false,
        status,
        pill: state === 'over' ? 'over' : state === 'due' ? 'due' : holder === 'you' ? 'up' : 'mut',
        cta:
          holder === 'client'
            ? {
                label: 'Send reminder',
                to: 'mail',
                href: mailDraft(c, cur.title, base),
              }
            : { label: 'Open step', to: 'step', href: stepHref(cur.id) },
        due: cur.due,
        since: c.since,
        days,
        pri: state === 'over',
        stepId: cur.id,
      });
    }
    for (const f of c.filings) {
      if (f.st === 'f' || f.st === 'l' || f.days > 14) continue;
      const state: QState = f.st === 'o' ? 'over' : f.st === 'd' ? 'due' : 'up';
      queue.push({
        id: `f:${f.id}`,
        clientId: c.id,
        source: 'filing',
        code: f.area,
        title: f.name,
        why: `${f.areaLabel} filing`,
        state,
        holder: 'you',
        mine: false,
        status: state === 'over' ? late(-f.days) : `Due ${f.days === 0 ? 'today' : f.days <= 6 ? dDay(f.due, today) : dShort(f.due, today)}`,
        pill: state === 'over' ? 'over' : state === 'due' ? 'due' : 'na',
        cta: { label: 'Open filing', to: 'filings', href: `${base}/compliances/filings` },
        due: f.due,
        days: f.days,
        pri: state === 'over',
      });
    }
  }
  for (const r of input.requests) {
    if (r.status !== 'pending' || !scoped.has(r.engagementId)) continue;
    const c = byId[r.engagementId]!;
    const since = istDay(r.uploadedAt) ?? undefined;
    const due = istDay(r.dueAt);
    queue.push({
      id: `r:${r.id}`,
      clientId: c.id,
      source: 'request',
      code: 'Doc',
      title: r.label,
      why: 'Document request',
      state: due && daysBetween(today, due) < 0 ? 'over' : 'wait',
      holder: 'client',
      mine: false,
      status: due && daysBetween(today, due) < 0 ? late(-daysBetween(today, due)) : 'Client',
      pill: due && daysBetween(today, due) < 0 ? 'over' : 'mut',
      cta: { label: 'Open client', to: 'client', href: c.href },
      due,
      since,
      days: since ? daysBetween(since, today) : undefined,
      pri: false,
    });
  }
  queue.sort(
    (a, b) =>
      Q_ORDER.indexOf(a.state) - Q_ORDER.indexOf(b.state) ||
      Number(b.pri) - Number(a.pri) ||
      (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
      (b.days ?? 0) - (a.days ?? 0) ||
      byId[a.clientId]!.short.localeCompare(byId[b.clientId]!.short),
  );

  /* ---------- team work */
  const team: TItem[] = [];
  const personFor = (profileId?: string): { key: string; name: string } => {
    if (!profileId) return { key: '@none', name: 'Unassigned' };
    if (profileId === input.meId) return { key: '@me', name: 'You' };
    const p = byProfile.get(profileId);
    if (p?.internId) return { key: p.internId, name: byKey.get(p.internId)?.name ?? p.name };
    if (p) return { key: `@other`, name: p.name };
    return { key: '@other', name: 'Team member' };
  };
  const dueLabel = (st: TSt, due: string | undefined): string => {
    if (st === 'done') return 'Done';
    if (!due) return 'No date';
    const d = daysBetween(today, due);
    if (d < 0) return `Overdue ${age(-d)}`;
    if (d === 0) return 'Today';
    if (d <= 6) return dDay(due, today);
    return dShort(due, today);
  };
  for (const t of input.tasks) {
    if (!scoped.has(t.engagementId)) continue;
    const due = istDay(t.dueAt);
    const d = due ? daysBetween(today, due) : undefined;
    const st: TSt =
      t.status === 'completed' || t.status === 'not-applicable'
        ? 'done'
        : d !== undefined && d < 0
          ? 'over'
          : d !== undefined && d <= 6
            ? 'due'
            : t.status === 'in-progress'
              ? 'run'
              : t.status === 'awaiting-client'
                ? 'wait'
                : t.status === 'overdue'
                  ? 'over'
                  : 'none';
    const who = personFor(t.assigneeId);
    team.push({
      id: `t:${t.id}`,
      kind: 'task',
      title: t.title?.trim() || 'Task',
      sub: 'Team task',
      clientId: t.engagementId,
      leadKey: who.key,
      leadName: who.name,
      st,
      due,
      dueLabel: dueLabel(st, due),
      taskId: t.id,
    });
  }
  for (const c of clients) {
    const lead = { key: c.leadKey ?? '@none', name: c.leadName ?? 'No lead' };
    const cur = c.current;
    if (cur) {
      const holder = holderOf(cur);
      const dueIn = cur.due ? daysBetween(today, cur.due) : undefined;
      const st: TSt = cur.late ? 'over' : dueIn !== undefined && dueIn <= 6 ? 'due' : holder === 'client' ? 'wait' : 'run';
      const approval = c.approvals.find((a) => a.itemId === cur.id);
      team.push({
        id: `s:${c.id}:${cur.id}`,
        kind: 'step',
        title: cur.title,
        sub: [stepCode(cur.id), approval ? 'Waiting on your approval' : holder === 'mca' ? 'With MCA' : `Phase ${cur.phaseNo}`].filter(Boolean).join(' · '),
        clientId: c.id,
        leadKey: lead.key,
        leadName: lead.name,
        st,
        due: cur.due,
        dueLabel: dueLabel(st, cur.due),
        stepId: cur.id,
        locked: !!cur.ownWindow,
      });
    }
    for (const s of c.model.steps) {
      if (s.kind !== 'done' || !s.doneOn || !weekSet.has(s.doneOn)) continue;
      team.push({
        id: `d:${c.id}:${s.id}`,
        kind: 'step',
        title: s.title,
        sub: [stepCode(s.id), `Phase ${s.phaseNo}`].filter(Boolean).join(' · '),
        clientId: c.id,
        leadKey: lead.key,
        leadName: lead.name,
        st: 'done',
        due: s.doneOn,
        dueLabel: 'Done',
        stepId: s.id,
      });
    }
    for (const f of c.filings) {
      const filedThisWeek = (f.st === 'f' || f.st === 'l') && !!f.filedOn && weekSet.has(f.filedOn);
      const open = f.st === 'o' || f.st === 'd' || (f.st === 'u' && f.days <= 14);
      if (!filedThisWeek && !open) continue;
      const st: TSt = filedThisWeek ? 'done' : f.st === 'o' ? 'over' : f.st === 'd' ? 'due' : 'none';
      team.push({
        id: `f:${f.id}`,
        kind: 'filing',
        title: f.name,
        sub: `${f.areaLabel} · Filing`,
        clientId: c.id,
        leadKey: lead.key,
        leadName: lead.name,
        st,
        due: f.due,
        dueLabel: dueLabel(st, f.due),
        filingId: f.id,
      });
    }
  }
  team.sort(
    (a, b) =>
      T_ORDER.indexOf(a.st) - T_ORDER.indexOf(b.st) ||
      (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
      a.title.localeCompare(b.title),
  );

  /* ---------- week (Mon–Sun) */
  const week7: WItem[] = [];
  const done: DoneItem[] = [];
  for (const c of clients) {
    for (const f of c.filings) {
      if ((f.st === 'f' || f.st === 'l') && f.filedOn && weekSet.has(f.filedOn)) {
        week7.push({ id: `wf:${f.id}`, lane: 'done', day: f.filedOn, title: `${f.name} · ${c.short}`, clientId: c.id, open: false, ref: { kind: 'filing', filingId: f.id } });
        done.push({ id: `df:${f.id}`, kind: 'filing', title: f.name, clientId: c.id, on: f.filedOn });
      } else if (f.st !== 'f' && f.st !== 'l' && weekSet.has(f.due)) {
        week7.push({ id: `wf:${f.id}`, lane: 'filing', day: f.due, title: `${f.name} · ${c.short}`, clientId: c.id, open: true, ref: { kind: 'filing', filingId: f.id } });
      }
    }
    for (const s of c.model.steps) {
      if (s.kind === 'done') {
        if (s.doneOn && weekSet.has(s.doneOn)) {
          week7.push({ id: `wd:${c.id}:${s.id}`, lane: 'done', day: s.doneOn, title: `${s.title} · ${c.short}`, clientId: c.id, open: false, ref: { kind: 'step', stepId: s.id } });
          done.push({ id: `ds:${c.id}:${s.id}`, kind: 'step', title: s.title, clientId: c.id, on: s.doneOn, stepId: s.id });
        }
        continue;
      }
      if (s.due && weekSet.has(s.due)) {
        week7.push({ id: `ws:${c.id}:${s.id}`, lane: 'step', day: s.due, title: `${s.title} · ${c.short}`, clientId: c.id, open: true, ref: { kind: 'step', stepId: s.id } });
      }
    }
  }
  for (const t of team) {
    if (t.kind !== 'task' || t.st === 'done' || !t.due || !weekSet.has(t.due)) continue;
    week7.push({ id: `wt:${t.taskId}`, lane: 'task', day: t.due, title: `${t.title} · ${byId[t.clientId]?.short ?? ''}`, clientId: t.clientId, open: true, ref: { kind: 'task', taskId: t.taskId } });
  }

  /* ---------- leads */
  const leadKeys = new Set<string>();
  for (const c of all) {
    for (const k of [c.e.internId, ...(c.e.leadIds ?? [])]) if (k?.trim()) leadKeys.add(k.trim());
  }
  const leads: LeadSum[] = [...leadKeys]
    .map((key) => {
      const name = leadName(key) ?? key;
      const open = team.filter((t) => t.leadKey === key && t.st !== 'done');
      return {
        key,
        name,
        initials: personInitials(name),
        profileId: byKey.get(key)?.profileId ?? undefined,
        clientIds: all.filter((c) => c.leadKey === key).map((c) => c.id),
        open,
        overdue: open.filter((t) => t.st === 'over').length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  /* ---------- filings in scope */
  const filings = clients.flatMap((c) => c.filings).sort((a, b) => a.due.localeCompare(b.due));
  const monthRows = filings.filter((f) => f.due.slice(0, 7) === monthKey);

  /* ---------- practice areas */
  const incClients = clients.filter((c) => c.stage === 'inc');
  const pipeline = PIPE.map((p) => ({ ...p, clients: incClients.filter((c) => pipeKey(c) === p.key) }));
  const coiDays = all
    .filter((c) => c.e.stage === 'Pre-Incorporation' && c.coiOn)
    .map((c) => daysBetween(istDay(c.e.createdAt) ?? c.coiOn!, c.coiOn!))
    .filter((n) => n >= 0);
  const regSteps = clients.filter((c) => c.stage === 'cmp').flatMap((c) => c.model.steps.filter((s) => s.phaseNo === 4));
  const regOpen = regSteps.filter((s) => s.kind === 'you' || s.kind === 'prog' || s.kind === 'with');
  const tally = (list: PortalStep[]) => {
    const m = new Map<string, number>();
    for (const s of list) m.set(s.title, (m.get(s.title) ?? 0) + 1);
    return [...m.entries()].map(([title, n]) => ({ title, n })).sort((a, b) => b.n - a.n || a.title.localeCompare(b.title));
  };
  const waiting = tally(regOpen.filter((s) => s.kind === 'you' || s.kind === 'prog'));
  const monthCounts = Object.fromEntries(F_ORDER.map((s) => [s, monthRows.filter((f) => f.st === s).length])) as Record<FSt, number>;
  const overdueByArea = new Map<AreaCode, number>();
  for (const f of filings) if (f.st === 'o') overdueByArea.set(f.area, (overdueByArea.get(f.area) ?? 0) + 1);
  const worst = [...overdueByArea.entries()].sort((a, b) => b[1] - a[1])[0];
  const practice: Practice = {
    pipeline,
    avgDaysToCoi: coiDays.length ? Math.round(coiDays.reduce((s, n) => s + n, 0) / coiDays.length) : null,
    coiCount: coiDays.length,
    regs: {
      done: regSteps.filter((s) => s.kind === 'done').length,
      run: regOpen.filter((s) => s.kind === 'with').length,
      wait: regOpen.filter((s) => s.kind === 'you' || s.kind === 'prog').length,
      top: tally(regOpen).slice(0, 3),
      mostWaiting: waiting[0],
    },
    monthCounts,
    worstArea: worst ? { area: worst[0], label: AREA_LABEL[worst[0]], n: worst[1] } : undefined,
  };

  const approvals = input.approvals.filter((a) => scoped.has(a.engagementId));

  return {
    today,
    week,
    monthKey,
    month: monthLabel(today),
    scope,
    all,
    clients,
    byId,
    counts,
    queue,
    team,
    week7,
    done,
    leads,
    filings,
    monthRows,
    kpi: {
      act: queue.filter((q) => q.holder === 'you'),
      over: queue.filter((q) => q.state === 'over'),
      wait: queue.filter((q) => q.holder !== 'you'),
      weekOpen: week7.filter((w) => w.open),
      doneToday: done.filter((d) => d.on === today),
    },
    approvals,
    practice,
  };
}

/** A drafted reminder in the Email page (nothing is sent until the manager presses Send). */
export function mailDraft(c: Pick<TClient, 'e' | 'short' | 'name'>, what: string, base = '/app/manager'): string {
  const q = new URLSearchParams();
  if (c.e.clientEmail) q.set('to', c.e.clientEmail);
  q.set('subject', `Reminder: ${what} · ${c.short}`);
  q.set(
    'body',
    `Hello,\n\nA quick reminder that we are waiting on you for ${what} for ${c.name}. You can complete it in your VCFO Suite portal; once it is in, we move to the next step the same day.\n\nRegards`,
  );
  return `${base}/mail?${q.toString()}`;
}

/* ================================================================ runway: real dates only */

export interface PhaseSpan {
  start: string;
  end: string;
  /** planned = the manager's schedule windows; actual = from steps done. */
  kind: 'planned' | 'actual';
  open: boolean;
}

/**
 * A phase's bar on the runway, from real dates only: the manager's schedule
 * windows when set, else the days its steps were actually done (an open phase
 * runs to today). A phase with neither has no bar — nothing is invented.
 */
export function phaseSpan(phase: PortalPhase, prevEnd: string | undefined, createdAt: string, today: string): PhaseSpan | undefined {
  if (phase.start && phase.end) return { start: phase.start, end: phase.end, kind: 'planned', open: phase.state !== 'done' };
  if (phase.state === 'up') return undefined;
  const dones = phase.steps.map((s) => s.doneOn).filter((d): d is string => !!d).sort();
  const start = prevEnd ?? dones[0] ?? createdAt;
  if (phase.state === 'done') {
    const end = dones[dones.length - 1] ?? start;
    return { start: start <= end ? start : end, end, kind: 'actual', open: false };
  }
  return { start: start <= today ? start : today, end: today, kind: 'actual', open: true };
}

/** ISO week number (W1–W53) of a day. */
export function isoWeek(s: string): number {
  const thursday = new Date(at(s));
  thursday.setUTCDate(thursday.getUTCDate() - ((thursday.getUTCDay() + 6) % 7) + 3);
  const first = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((thursday.getTime() - first.getTime()) / (7 * DAY_MS));
}

/** Every dated item in a range (the mini calendar's month): filings, step deadlines, team tasks. */
export function datedItems(m: TodayModel, from: string, to: string): WItem[] {
  const inRange = (d?: string) => !!d && d >= from && d <= to;
  const out: WItem[] = [];
  for (const c of m.clients) {
    for (const f of c.filings) {
      if (inRange(f.due)) out.push({ id: `mf:${f.id}`, lane: 'filing', day: f.due, title: `${f.name} · ${c.short}`, clientId: c.id, open: f.st !== 'f' && f.st !== 'l', ref: { kind: 'filing', filingId: f.id } });
    }
    for (const s of c.model.steps) {
      if (s.kind !== 'done' && inRange(s.due)) out.push({ id: `ms:${c.id}:${s.id}`, lane: 'step', day: s.due!, title: `${s.title} · ${c.short}`, clientId: c.id, open: true, ref: { kind: 'step', stepId: s.id } });
    }
  }
  for (const t of m.team) {
    if (t.kind === 'task' && t.st !== 'done' && inRange(t.due)) out.push({ id: `mt:${t.taskId}`, lane: 'task', day: t.due!, title: `${t.title} · ${m.byId[t.clientId]?.short ?? ''}`, clientId: t.clientId, open: true, ref: { kind: 'task', taskId: t.taskId } });
  }
  return out;
}
