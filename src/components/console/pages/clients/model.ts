/**
 * Clients chain (manager console) — pure read model between the real checklist
 * state and the prototype's client vocabulary (a59q_mgr_pages.js MX_CL /
 * mxStepState / MX_HEALTH, inventory "Clients, client overview, step page").
 *
 * Built on the client portal's step model (`buildIncorporationModel`, the same
 * 4 phases × 48 steps the client sees, gated with the client viewer exactly as
 * the live project page does) — nothing here is sample data:
 *
 *   step state  done / cur / stuck / up   the prototype `.mx-si2` / `.mx-step` classes
 *   holder      You / Client / <lead> / MCA, with the days the step has been there
 *   health      On track / At risk / Stuck / New, with the reason (tooltip)
 *   stage       inc (Pre-Incorporation) / cmp (Post-Incorporation, Operational Readiness)
 */
import type { Engagement } from '@/data/engagements';
import { getIncorporationPhases } from '@/data/checklist';
import { buildIncorporationModel, type PortalIncorporationModel, type PortalStep } from '@/lib/client-portal/step-model';
import type { ChecklistItemStateSlice } from '@/lib/checklist/checklist-state-key';
import { listPendingApprovals, pendingApprovalKind } from '@/lib/projects/pending-approvals';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import { stepSlugForItemId } from '@/lib/slug';

/* ---------------------------------------------------------------- stage scope */

/**
 * The console's Stage filter (`useConsole().scope`). A client is "incorporating"
 * until the Certificate of Incorporation, then in compliance (prototype:
 * Brightwave at Post-3 and Kestrel at Reg-1 are Compliance). The domain rule
 * `isIncorporated` decides (incorporation date, a start stage after
 * Pre-Incorporation, or the COI step done) — the same rule the Today page reads.
 */
export type ClientStage = 'inc' | 'cmp';
export function stageOf(
  e: Pick<Engagement, 'stage' | 'incorporationDate'>,
  state?: Record<string, ChecklistItemStateSlice | undefined> | null,
): ClientStage {
  return isIncorporated(e, state ?? null) ? 'cmp' : 'inc';
}

/**
 * The live Projects page (src/views/admin/Projects.tsx) lists every engagement
 * except the Operational Readiness ones. Kept as it is (owner: bring live
 * behaviour across unchanged); the console names the hidden ones instead of
 * dropping them silently.
 */
export function isListedOnClients(e: Pick<Engagement, 'stage'>): boolean {
  return e.stage !== 'Operational Readiness';
}

/* ---------------------------------------------------------------- step codes */

const PHASES = getIncorporationPhases();
const CODE: Record<string, string> = {};
const PHASE_NO: Record<string, number> = {};
{
  let pre = 0;
  PHASES.forEach((phase, pi) => {
    phase.items.forEach((item, i) => {
      PHASE_NO[item.id] = pi + 1;
      if (pi <= 1) CODE[item.id] = `Pre-${++pre}`;
      else CODE[item.id] = `${pi === 2 ? 'Post' : 'Reg'}-${i + 1}`;
    });
  });
}

/**
 * The prototype's step code, from the step's place in the real catalog:
 * Pre-1 … Pre-14 (Name, Incorporation), Post-1 … Post-11, Reg-1 … Reg-23.
 * "Pre-7" is the 7th pre-incorporation step (Registered Office Address), not
 * the catalog id `pre-7`.
 */
export function stepCode(itemId: string): string {
  return CODE[itemId] ?? itemId;
}

export function phaseNoOf(itemId: string): number | undefined {
  return PHASE_NO[itemId];
}

/** Short phase names (prototype MX_PHN), from the real phase titles. */
export const PHASE_SHORT = ['Name', 'Incorporation', 'Post-incorporation', 'Registrations'];

/* ---------------------------------------------------------------- step state */

/** Prototype step states: done (tick), cur (current ring), stuck (late, red), up (upcoming), na (not needed). */
export type StepState = 'done' | 'cur' | 'stuck' | 'up' | 'na';

export function stepStateOf(s: PortalStep): StepState {
  if (s.kind === 'done') return s.slice?.status === 'not-applicable' ? 'na' : 'done';
  if (s.late) return 'stuck';
  if (s.kind === 'you' || s.kind === 'prog' || s.kind === 'with') return 'cur';
  return 'up';
}

export const STEP_STATE_LABEL: Record<StepState, string> = {
  done: 'Done',
  cur: 'In progress',
  stuck: 'Overdue',
  up: 'Not started',
  na: 'Not needed',
};

export const STEP_STATE_COLOR: Record<StepState, string> = {
  done: 'var(--mx-ok)',
  cur: 'var(--mx-run)',
  stuck: 'var(--over)',
  up: 'var(--mx-none)',
  na: 'var(--line)',
};

/* ---------------------------------------------------------------- dates */

const DAY = 86_400_000;
export function ymd(v?: string | null): string | undefined {
  if (!v) return undefined;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}
export function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/* ---------------------------------------------------------------- one client */

export type HolderWho = 'you' | 'client' | 'lead' | 'manager' | 'mca' | 'none';

/** Whose console the page is in: the manager's or the project lead's (`useConsole().seat`). */
export type ClientSeat = 'mgr' | 'lead';

export interface Holder {
  who: HolderWho;
  /** "You", "Client", the lead's first name, "Manager", "MCA" */
  label: string;
  /** "Waiting on the client", "With Arjun", "Needs you", "Your step", "With the manager", "With MCA", "All steps done" */
  long: string;
  /** ISO day the current step became current (previous step done, or the project start). */
  since?: string;
  days?: number;
}

export type HealthKey = 'ok' | 'risk' | 'stuck' | 'new';
export interface Health {
  key: HealthKey;
  label: 'On track' | 'At risk' | 'Stuck' | 'New';
  color: string;
  /** Why, in a sentence (tooltip). */
  why: string;
}

export const HEALTH_COLOR: Record<HealthKey, string> = {
  ok: 'var(--mx-ok)',
  risk: 'var(--due)',
  stuck: 'var(--over)',
  new: 'var(--ink-3)',
};

export interface ClientView {
  e: Engagement;
  model: PortalIncorporationModel;
  stage: ClientStage;
  /** The step the project is on (the client portal's "current": the client's move first, then SBC's). */
  current?: PortalStep;
  holder: Holder;
  health: Health;
  /** Steps waiting on the manager's decision (Approvals rule, src/lib/pending-approvals.ts). */
  approvals: { itemId: string; kind: string }[];
  /** Day N of the project (from its creation). */
  day: number;
  leads: { id: string; name: string }[];
  seat: ClientSeat;
}

function firstName(name?: string | null): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/** When each step became current: the previous step's done date, or the project start for the first. */
export function startedOn(model: PortalIncorporationModel, stepId: string, projectStart?: string): string | undefined {
  let prev: string | undefined = projectStart;
  for (const s of model.steps) {
    if (s.id === stepId) return prev;
    if (s.kind === 'done' && s.doneOn) prev = s.doneOn;
  }
  return undefined;
}

/**
 * Who holds a step, from the seat's point of view (README: You, Client,
 * Manager, MCA, with the days it has been there). The manager sees "Needs you"
 * on a step waiting on their decision and "With Arjun" while the lead works
 * it; the lead sees "With the manager" and "Your step".
 */
export function holderOf(
  model: PortalIncorporationModel,
  current: PortalStep | undefined,
  opts: { awaitingYou: boolean; leadName?: string; projectStart?: string; today: string; seat?: ClientSeat },
): Holder {
  const lead = opts.seat === 'lead';
  if (!current) return { who: 'none', label: '—', long: model.all.done === model.all.total ? 'All steps done' : 'Nothing open' };
  const since = startedOn(model, current.id, opts.projectStart);
  const days = since ? Math.max(0, dayDiff(since, opts.today)) : undefined;
  const base = { since, days };
  if (opts.awaitingYou) return lead ? { ...base, who: 'manager', label: 'Manager', long: 'With the manager' } : { ...base, who: 'you', label: 'You', long: 'Needs you' };
  if (current.owner === 'mca') return { ...base, who: 'mca', label: 'MCA', long: 'With MCA' };
  if (current.kind === 'you') return { ...base, who: 'client', label: 'Client', long: 'Waiting on the client' };
  if (lead) return { ...base, who: 'you', label: 'You', long: 'Your step' };
  const first = firstName(opts.leadName);
  return { ...base, who: 'lead', label: first || 'Lead', long: first ? `With ${first}` : 'With the project lead' };
}

export function healthOf(
  e: Pick<Engagement, 'health'>,
  model: PortalIncorporationModel,
  current: PortalStep | undefined,
  today: string,
  /** overdue register filings of this client (README: Stuck if a step is late or a filing is overdue) */
  overdueFilings = 0,
): Health {
  const late = model.steps.filter((s) => s.late);
  if (e.health === 'overdue') return { key: 'stuck', label: 'Stuck', color: HEALTH_COLOR.stuck, why: 'The project is marked past due' };
  if (late.length) {
    const worst = late.reduce((a, b) => (b.lateDays > a.lateDays ? b : a));
    const more = late.length > 1 ? ` (and ${late.length - 1} more)` : '';
    return { key: 'stuck', label: 'Stuck', color: HEALTH_COLOR.stuck, why: `${worst.title} is ${worst.lateDays} day${worst.lateDays === 1 ? '' : 's'} late${more}` };
  }
  if (overdueFilings > 0) return { key: 'stuck', label: 'Stuck', color: HEALTH_COLOR.stuck, why: `${plural(overdueFilings, 'filing')} overdue` };
  if (e.health === 'at-risk') return { key: 'risk', label: 'At risk', color: HEALTH_COLOR.risk, why: 'The project is marked for review' };
  if (current?.due) {
    const d = dayDiff(today, current.due);
    if (d >= 0 && d <= 3) return { key: 'risk', label: 'At risk', color: HEALTH_COLOR.risk, why: `${current.title} is due ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}` };
  }
  if (model.all.done === 0) return { key: 'new', label: 'New', color: HEALTH_COLOR.new, why: 'No step is done yet' };
  return { key: 'ok', label: 'On track', color: HEALTH_COLOR.ok, why: 'Nothing is late' };
}

export function buildClientView(
  e: Engagement,
  state: Record<string, ChecklistItemStateSlice | undefined>,
  people: { id: string; name: string }[],
  today: string,
  seat: ClientSeat = 'mgr',
  /** overdue register filings of this client (from the shared Today model), counted in health */
  overdueFilings = 0,
): ClientView {
  const model = buildIncorporationModel(state, e.schedule ?? null, today);
  const current = model.current;
  const approvals = listPendingApprovals([e], () => state).map((r) => ({ itemId: r.itemId, kind: pendingApprovalKind(r) }));
  const leadIds = e.leadIds?.length ? e.leadIds : e.internId?.trim() ? [e.internId] : [];
  const leads = leadIds.map((id) => ({ id, name: people.find((p) => p.id === id)?.name ?? '' })).filter((l) => l.name);
  const start = ymd(e.createdAt);
  const holder = holderOf(model, current, {
    awaitingYou: Boolean(current && approvals.some((a) => a.itemId === current.id)),
    leadName: leads[0]?.name,
    projectStart: start,
    today,
    seat,
  });
  return {
    e,
    model,
    stage: stageOf(e, state),
    current,
    holder,
    health: healthOf(e, model, current, today, overdueFilings),
    approvals,
    day: start ? Math.max(1, dayDiff(start, today) + 1) : 1,
    leads,
    seat,
  };
}

/* ---------------------------------------------------------------- holder pill */

/**
 * `.pill` class for a holder (README colour rules): amber when it waits on the
 * client or on you, accent while the lead works it (current), neutral with the
 * manager, MCA or when nothing is open. Green stays for "done".
 */
export function holderPillKind(who: HolderWho): 'due' | 'up' | 'mut' {
  if (who === 'client' || who === 'you') return 'due';
  if (who === 'lead') return 'up';
  return 'mut';
}

/** "Waiting on the client · 5d" */
export function holderText(h: Holder): string {
  return h.days !== undefined && h.who !== 'none' ? `${h.long} · ${h.days}d` : h.long;
}

/* ---------------------------------------------------------------- routes per seat */

/**
 * The Clients chain's links for one seat. The manager's pages live under
 * /app/manager/projects, the lead's under /app/intern/projects (list at
 * /app/intern/clients); `base` is `useConsole().base`.
 */
export function clientPaths(base: string) {
  const isLead = base === '/app/intern';
  const project = (e: { slug?: string | null; id: string }) => `${base}/projects/${e.slug || e.id}`;
  /** `step` is a catalog id ('pre-14') or an item; links use the step's slug, as the live helpers do. */
  const step = (e: { slug?: string | null; id: string }, item: string | { slug: string }, tabId?: string) =>
    `${project(e)}/step/${typeof item === 'string' ? stepSlugForItemId(item) : item.slug}${tabId ? `?tab=${encodeURIComponent(tabId)}` : ''}`;
  return {
    isLead,
    list: isLead ? `${base}/clients` : `${base}/projects`,
    newProject: `${base}/projects/new`,
    calendar: `${base}/compliances/calendar`,
    project,
    step,
    docs: (e: { slug?: string | null; id: string }, part?: 'part-a' | 'part-b' | null) => `${project(e)}/documents${part ? `?part=${part}` : ''}`,
    edit: (e: { slug?: string | null; id: string }) => `${project(e)}/edit`,
    boardResolution: (e: { slug?: string | null; id: string }) => `${project(e)}/board-resolution`,
  };
}
export type ClientPaths = ReturnType<typeof clientPaths>;

/* ---------------------------------------------------------------- plural + names */

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Two-letter tile for a company ("Northwind Analytics India" → "NA"). */
export function companyInitials(name: string): string {
  const words = name
    .replace(/\b(india|private|limited|pvt|ltd|llp|inc|the)\b\.?/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const src = words.length ? words : name.trim().split(/\s+/);
  if (src.length === 1) return (src[0] ?? '?').slice(0, 2).toUpperCase();
  return ((src[0]?.[0] ?? '') + (src[1]?.[0] ?? '')).toUpperCase() || '?';
}
