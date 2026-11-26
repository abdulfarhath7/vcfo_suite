import { agentNameOf, findSubAgent } from '@/lib/assist-agents/catalog';
import { assistStepPath } from '@/lib/assist-agents/step-link';
import type { Role } from '@/lib/auth';
import { toCsv } from '@/lib/compliance/spectrum-status';
import { manualMinutesFor } from './minutes-saved';

/**
 * CARD AGENT RUNS OVERVIEW — the pure part of "Agents today" (MASTER-PLAN.md screen 1), the
 * control room (screen 9) and the Agent results page (screen 11). No db, no env, no React: the
 * repository (`src/db/repositories/agent-runs-overview.ts`) reads the rows in the viewer's scope
 * and hands them here as plain objects; the views import the types and the CSV builder.
 *
 * One list holds both routes:
 *   - browser: a live browser session (`live_browser_sessions`), joined to the VCFO Assist run it
 *     drives when there is one, and the extension runs that have no session (`assist_agent_runs`);
 *   - api: a GST return filed through the GSP (`gst_return_runs`).
 * The "your turn" requests (`agent_otp_requests`) are attached to the run they belong to.
 *
 * Every run lands in one bucket: your turn (a person must act), running (the agent works),
 * waiting (data is missing), done, failed or cancelled. A filing is a run that came back with an
 * SRN (MCA) or an ARN (GST); nothing else counts as filed.
 */

export type AgentRunRoute = 'browser' | 'api';
export type AgentRunSource = 'session' | 'extension' | 'gst';
export type AgentRunBucket = 'your_turn' | 'running' | 'waiting' | 'done' | 'failed' | 'cancelled';
export type AgentRunAction = 'Open' | 'Watch' | 'Fix';

export const AGENT_RUN_BUCKETS: readonly AgentRunBucket[] = ['your_turn', 'running', 'waiting', 'done', 'failed', 'cancelled'];

export const AGENT_RUN_BUCKET_LABEL: Record<AgentRunBucket, string> = {
  your_turn: 'Your turn',
  running: 'Running',
  waiting: 'Waiting for data',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const OPEN_BUCKETS = new Set<AgentRunBucket>(['your_turn', 'running', 'waiting']);

export function isOpenBucket(bucket: AgentRunBucket): boolean {
  return OPEN_BUCKETS.has(bucket);
}

/* ---------------------------------------------------------------- inputs (from the repository) */

export interface RawEngagement {
  /** The engagement's uuid. */
  dbId: string;
  /** The id the app's URLs use (legacy id or uuid). */
  appId: string;
  slug: string | null;
  companyName: string;
}

export interface RawViewer {
  name: string | null;
  ip: string | null;
  firstAt: string;
  lastAt: string;
}

export interface RawSession {
  id: string;
  engagement: RawEngagement;
  taskId: string;
  runId: string | null;
  startedByName: string | null;
  portalHost: string | null;
  portalLoginLabel: string | null;
  status: string;
  gate: string | null;
  progressText: string | null;
  fieldsTotal: number;
  fieldsDone: number;
  egressIp: string | null;
  viewers: RawViewer[];
  createdAt: string;
  readyAt: string | null;
  lastActivityAt: string;
  endedAt: string | null;
  endReason: string | null;
}

export interface RawAssistRun {
  id: string;
  engagement: RawEngagement;
  subAgent: string;
  status: string;
  state: string;
  fieldsTotal: number;
  fieldsFilled: number;
  heals: Array<{ field: string; tier: string; ok: boolean }>;
  refusals: Array<{ kind: string; target?: string }>;
  blanks: number;
  srn: string | null;
  error: string | null;
  userName: string | null;
  clientIps: Array<{ ip: string; firstAt: string; lastAt: string }>;
  startedAt: string;
  finishedAt: string | null;
  updatedAt: string;
}

export interface RawGstRun {
  id: string;
  engagement: RawEngagement;
  gstin: string;
  form: string;
  period: string;
  status: string;
  arn: string | null;
  error: string | null;
  checks: Array<{ label: string; by: string | null; at: string }>;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  filedAt: string | null;
  /** The compliance occurrence this return files, when one matches (for the card link). */
  instanceId: string | null;
}

export interface RawOtpRequest {
  subjectType: string;
  subjectId: string;
  purpose: string;
  audience: string;
  status: string;
  sentTo: string | null;
  requestedAt: string;
  requestedByName: string | null;
  answeredAt: string | null;
  answeredByName: string | null;
}

/* ---------------------------------------------------------------------------- the list item */

/** One "your turn" on a run and who did it. */
export interface AgentRunTurn {
  what: string;
  /** staff | client */
  audience: string;
  status: string;
  askedAt: string;
  askedBy: string | null;
  doneAt: string | null;
  doneBy: string | null;
}

export interface AgentRunItem {
  /** `<source>:<row id>`, unique across both routes. */
  id: string;
  source: AgentRunSource;
  route: AgentRunRoute;
  /** The row id in its own table. */
  rowId: string;
  /** The VCFO Assist run the session drives, or the extension run itself. */
  assistRunId: string | null;
  taskId: string;
  agentName: string;
  form: string;
  engagementId: string;
  companyName: string;
  bucket: AgentRunBucket;
  /** The state as the control room words it, for example "Your turn: OTP" or "Saving return". */
  stateLabel: string;
  gate: string | null;
  fieldsDone: number;
  fieldsTotal: number;
  progressText: string | null;
  startedAt: string;
  endedAt: string | null;
  /** Minutes from start to finish, or to now while the run is open. */
  minutes: number;
  /** Live browser minutes used: a session's start to its end, or to its last activity while open (0 off the browser). */
  browserMinutes: number;
  /** "SRN AB1234", "ARN AA29…", "3 left blank", "Draft saved". */
  result: string | null;
  /** An SRN or ARN came back. */
  isFiling: boolean;
  startedBy: string | null;
  /** The card page in the viewer's shell. */
  href: string | null;
  action: AgentRunAction;
  heals: number;
  healsFailed: number;
  refusals: Array<{ kind: string; target?: string }>;
  blanks: number;
  viewers: RawViewer[];
  clientIps: string[];
  egressIp: string | null;
  portalHost: string | null;
  portalLogin: string | null;
  turns: AgentRunTurn[];
  checks: Array<{ label: string; by: string | null; at: string }>;
  error: string | null;
  endReason: string | null;
  period: string | null;
}

/* ------------------------------------------------------------------------------ card links */

/** The shell segment that holds a role's registration records and compliance pages. */
export function practiceBase(role: Role | string): string {
  if (role === 'intern') return '/app/lead';
  if (role === 'manager') return '/app/manager';
  return '/app/admin';
}

export interface CardLinkInput {
  role: Role;
  engagement: Pick<RawEngagement, 'appId' | 'slug'>;
  taskId: string;
  /** The compliance occurrence, for a compliance card. */
  instanceId?: string | null;
}

/**
 * The card a run belongs to, in the viewer's shell: a registration record
 * (`/registrations/<engagement>~<step>`), a checklist step page, or a compliance obligation's
 * occurrence page (the obligation's page for the company when no occurrence matches).
 */
export function agentCardHref({ role, engagement, taskId, instanceId }: CardLinkInput): string | null {
  const task = findSubAgent(taskId);
  if (!task) return null;
  const base = practiceBase(role);
  if (task.stepId?.startsWith('reg-')) return `${base}/registrations/${encodeURIComponent(`${engagement.appId}~${task.stepId}`)}`;
  if (task.stepId) return assistStepPath(role, { slug: engagement.slug, id: engagement.appId }, task.stepId);
  const obligationId = task.obligationIds?.[0];
  if (!obligationId) return null;
  const ob = encodeURIComponent(obligationId);
  return instanceId
    ? `${base}/compliances/obligations/${ob}/${encodeURIComponent(instanceId)}`
    : `${base}/compliances/obligations/${ob}?company=${encodeURIComponent(engagement.appId)}`;
}

/* ------------------------------------------------------------------------------- the mapping */

const GATE_LABEL: Record<string, string> = {
  LOGIN: 'login',
  CAPTCHA: 'captcha',
  OTP: 'OTP',
  DSC: 'sign with DSC',
  SUBMIT: 'submit',
  PAY: 'pay',
  EVC: 'EVC OTP',
};

const gateWord = (gate: string) => GATE_LABEL[gate] ?? gate.toLowerCase().replace(/_/g, ' ');

const minutesBetween = (from: string, to: string | null, now: Date): number => {
  const end = to ? new Date(to).getTime() : now.getTime();
  return Math.max(0, Math.round((end - new Date(from).getTime()) / 60_000));
};

/** The catalog task a GST return run files: `gstr3b` → `gstr-3b`. */
export function gstTaskId(form: string): string {
  return form.replace(/^gstr/, 'gstr-');
}

/** A GST `ret_period` (MMYYYY) as `YYYY-MM`, or null when it is not one. */
export function gstPeriodMonth(period: string): string | null {
  const m = /^(0[1-9]|1[0-2])(\d{4})$/.exec(period.trim());
  return m ? `${m[2]}-${m[1]}` : null;
}

function pendingTurn(turns: AgentRunTurn[]): AgentRunTurn | null {
  return turns.find((t) => t.status === 'pending') ?? null;
}

function toTurns(otps: RawOtpRequest[]): AgentRunTurn[] {
  return otps
    .map((o) => ({
      what: o.purpose === 'evc' ? 'EVC OTP' : o.purpose === 'gstn_consent' ? 'Consent OTP' : 'OTP',
      audience: o.audience,
      status: o.status,
      askedAt: o.requestedAt,
      askedBy: o.requestedByName,
      doneAt: o.answeredAt,
      doneBy: o.answeredByName,
    }))
    .sort((a, b) => a.askedAt.localeCompare(b.askedAt));
}

/** The words for a pending OTP request: the client's or the staff member's turn. */
function otpTurnLabel(turn: AgentRunTurn): string {
  // "Consent OTP" starts a list entry; inside a sentence it reads "consent OTP" (EVC stays capitals).
  const what = turn.what.replace(/^Consent/, 'consent');
  return turn.audience === 'client' ? `Client ${what} sent, waiting` : `Your turn: ${what}`;
}

function sessionBucket(status: string, gate: string | null): { bucket: AgentRunBucket; label: string } {
  if (status === 'done') return { bucket: 'done', label: 'Done' };
  if (status === 'failed') return { bucket: 'failed', label: 'Failed' };
  if (status === 'cancelled') return { bucket: 'cancelled', label: 'Cancelled' };
  if (status === 'expired') return { bucket: 'cancelled', label: 'Expired' };
  if (gate) return { bucket: 'your_turn', label: `Your turn: ${gateWord(gate)}` };
  if (status === 'your_turn') return { bucket: 'your_turn', label: 'Your turn' };
  if (status === 'paused') return { bucket: 'your_turn', label: 'Paused' };
  if (status === 'starting') return { bucket: 'running', label: 'Starting' };
  return { bucket: 'running', label: 'Running' };
}

function assistBucket(status: string, state: string): { bucket: AgentRunBucket; label: string; gate: string | null } {
  if (status === 'done') return { bucket: 'done', label: 'Done', gate: null };
  if (status === 'failed') return { bucket: 'failed', label: 'Failed', gate: null };
  if (status === 'cancelled') return { bucket: 'cancelled', label: 'Cancelled', gate: null };
  if (status === 'waiting_user') {
    const gate = state.startsWith('WAIT_') ? state.slice(5) : null;
    return { bucket: 'your_turn', label: gate ? `Your turn: ${gateWord(gate)}` : 'Your turn', gate };
  }
  return { bucket: 'running', label: 'Running', gate: null };
}

const GST_LOOK: Record<string, { bucket: AgentRunBucket; label: string; gate?: string }> = {
  draft: { bucket: 'waiting', label: 'Waiting for data' },
  consent_needed: { bucket: 'your_turn', label: 'Your turn: consent OTP', gate: 'OTP' },
  saving: { bucket: 'running', label: 'Saving return' },
  saved: { bucket: 'your_turn', label: 'Your turn: certifier checks', gate: 'CHECKS' },
  checked: { bucket: 'your_turn', label: 'Your turn: pay and EVC', gate: 'PAY' },
  filing: { bucket: 'running', label: 'Filing' },
  filed: { bucket: 'done', label: 'Filed' },
  failed: { bucket: 'failed', label: 'Failed' },
  cancelled: { bucket: 'cancelled', label: 'Cancelled' },
};

function actionFor(bucket: AgentRunBucket, source: AgentRunSource): AgentRunAction {
  if (bucket === 'waiting') return 'Fix';
  if (bucket === 'running' && source === 'session') return 'Watch';
  return 'Open';
}

function taskFacts(taskId: string): { agentName: string; form: string } {
  const task = findSubAgent(taskId);
  return task ? { agentName: agentNameOf(task), form: task.form } : { agentName: taskId, form: taskId };
}

function assistResult(run: Pick<RawAssistRun, 'srn' | 'blanks'>): string | null {
  if (run.srn) return `SRN ${run.srn}`;
  if (run.blanks > 0) return `${run.blanks} left blank`;
  return null;
}

export interface BuildInput {
  role: Role;
  sessions: RawSession[];
  assistRuns: RawAssistRun[];
  gstRuns: RawGstRun[];
  otps: RawOtpRequest[];
  now: Date;
}

/** Joins the rows of both routes into one list, sorted: your turn, running, waiting, then the newest. */
export function buildAgentRunItems({ role, sessions, assistRuns, gstRuns, otps, now }: BuildInput): AgentRunItem[] {
  const runsById = new Map(assistRuns.map((r) => [r.id, r]));
  const otpsBy = new Map<string, RawOtpRequest[]>();
  for (const o of otps) {
    const key = `${o.subjectType}:${o.subjectId}`;
    otpsBy.set(key, [...(otpsBy.get(key) ?? []), o]);
  }
  const used = new Set<string>();
  const items: AgentRunItem[] = [];

  for (const s of sessions) {
    const run = s.runId ? runsById.get(s.runId) : undefined;
    if (run) used.add(run.id);
    const turns = toTurns(otpsBy.get(`live_browser_session:${s.id}`) ?? []);
    let { bucket, label } = sessionBucket(s.status, s.gate);
    const pending = pendingTurn(turns);
    if (pending && isOpenBucket(bucket)) {
      bucket = 'your_turn';
      label = otpTurnLabel(pending);
    }
    const ended = s.endedAt ?? (isOpenBucket(bucket) ? null : s.lastActivityAt);
    const result = run ? assistResult(run) : null;
    items.push({
      id: `session:${s.id}`,
      source: 'session',
      route: 'browser',
      rowId: s.id,
      assistRunId: run?.id ?? s.runId,
      taskId: s.taskId,
      ...taskFacts(s.taskId),
      engagementId: s.engagement.appId,
      companyName: s.engagement.companyName,
      bucket,
      stateLabel: label,
      gate: pending ? 'OTP' : s.gate,
      fieldsDone: run ? run.fieldsFilled : s.fieldsDone,
      fieldsTotal: run ? run.fieldsTotal : s.fieldsTotal,
      progressText: s.progressText,
      startedAt: s.createdAt,
      endedAt: ended,
      minutes: minutesBetween(s.createdAt, ended, now),
      browserMinutes: minutesBetween(s.createdAt, s.endedAt ?? s.lastActivityAt, now),
      result: result ?? (s.fieldsTotal > 0 && !isOpenBucket(bucket) ? `${s.fieldsDone} of ${s.fieldsTotal} fields` : null),
      isFiling: Boolean(run?.srn),
      startedBy: s.startedByName ?? run?.userName ?? null,
      href: agentCardHref({ role, engagement: s.engagement, taskId: s.taskId }),
      action: actionFor(bucket, 'session'),
      heals: run?.heals.length ?? 0,
      healsFailed: run?.heals.filter((h) => !h.ok).length ?? 0,
      refusals: run?.refusals ?? [],
      blanks: run?.blanks ?? 0,
      viewers: s.viewers,
      clientIps: run ? run.clientIps.map((c) => c.ip) : [],
      egressIp: s.egressIp,
      portalHost: s.portalHost,
      portalLogin: s.portalLoginLabel,
      turns,
      checks: [],
      error: run?.error ?? null,
      endReason: s.endReason,
      period: null,
    });
  }

  for (const r of assistRuns) {
    if (used.has(r.id)) continue;
    const { bucket, label, gate } = assistBucket(r.status, r.state);
    const ended = r.finishedAt ?? (isOpenBucket(bucket) ? null : r.updatedAt);
    items.push({
      id: `extension:${r.id}`,
      source: 'extension',
      route: 'browser',
      rowId: r.id,
      assistRunId: r.id,
      taskId: r.subAgent,
      ...taskFacts(r.subAgent),
      engagementId: r.engagement.appId,
      companyName: r.engagement.companyName,
      bucket,
      stateLabel: label,
      gate,
      fieldsDone: r.fieldsFilled,
      fieldsTotal: r.fieldsTotal,
      progressText: null,
      startedAt: r.startedAt,
      endedAt: ended,
      minutes: minutesBetween(r.startedAt, ended, now),
      browserMinutes: 0,
      result: assistResult(r),
      isFiling: Boolean(r.srn),
      startedBy: r.userName,
      href: agentCardHref({ role, engagement: r.engagement, taskId: r.subAgent }),
      action: actionFor(bucket, 'extension'),
      heals: r.heals.length,
      healsFailed: r.heals.filter((h) => !h.ok).length,
      refusals: r.refusals,
      blanks: r.blanks,
      viewers: [],
      clientIps: r.clientIps.map((c) => c.ip),
      egressIp: null,
      portalHost: null,
      portalLogin: null,
      turns: [],
      checks: [],
      error: r.error,
      endReason: null,
      period: null,
    });
  }

  for (const g of gstRuns) {
    const taskId = gstTaskId(g.form);
    const turns = toTurns(otpsBy.get(`gst_return_run:${g.id}`) ?? []);
    const look = GST_LOOK[g.status] ?? { bucket: 'running' as const, label: g.status };
    let bucket = look.bucket;
    let label = look.label;
    let gate = look.gate ?? null;
    const pending = pendingTurn(turns);
    if (pending && isOpenBucket(bucket)) {
      bucket = 'your_turn';
      label = otpTurnLabel(pending);
      gate = 'OTP';
    }
    const ended = g.filedAt ?? (isOpenBucket(bucket) ? null : g.updatedAt);
    items.push({
      id: `gst:${g.id}`,
      source: 'gst',
      route: 'api',
      rowId: g.id,
      assistRunId: null,
      taskId,
      ...taskFacts(taskId),
      engagementId: g.engagement.appId,
      companyName: g.engagement.companyName,
      bucket,
      stateLabel: label,
      gate,
      fieldsDone: 0,
      fieldsTotal: 0,
      progressText: null,
      startedAt: g.createdAt,
      endedAt: ended,
      minutes: minutesBetween(g.createdAt, ended, now),
      browserMinutes: 0,
      result: g.arn ? `ARN ${g.arn}` : g.status === 'saved' || g.status === 'checked' ? 'Draft saved' : null,
      isFiling: Boolean(g.arn),
      startedBy: g.createdByName,
      href: agentCardHref({ role, engagement: g.engagement, taskId, instanceId: g.instanceId }),
      action: actionFor(bucket, 'gst'),
      heals: 0,
      healsFailed: 0,
      refusals: [],
      blanks: 0,
      viewers: [],
      clientIps: [],
      egressIp: null,
      portalHost: null,
      portalLogin: null,
      turns,
      checks: g.checks,
      error: g.error,
      endReason: null,
      period: g.period,
    });
  }

  const order = (b: AgentRunBucket) => AGENT_RUN_BUCKETS.indexOf(b);
  return items.sort((a, b) => {
    const open = Number(isOpenBucket(b.bucket)) - Number(isOpenBucket(a.bucket));
    if (open !== 0) return open;
    if (isOpenBucket(a.bucket) && a.bucket !== b.bucket) return order(a.bucket) - order(b.bucket);
    return b.startedAt.localeCompare(a.startedAt);
  });
}

/* --------------------------------------------------------------------------------- filters */

export type AgentRunPeriod = 'today' | 'week' | 'month' | 'all';
export type AgentRunStateFilter = 'all' | 'open' | AgentRunBucket;

export const AGENT_RUN_PERIODS: readonly AgentRunPeriod[] = ['today', 'week', 'month', 'all'];
export const AGENT_RUN_STATE_FILTERS: readonly AgentRunStateFilter[] = ['all', 'open', ...AGENT_RUN_BUCKETS];

export interface AgentRunFilters {
  state: AgentRunStateFilter;
  period: AgentRunPeriod;
  agent: string | null;
  search: string;
}

const IST_MS = 330 * 60_000;

/** Midnight in India of the day `now` falls on, as a Date. */
export function istDayStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_MS);
}

/** Where a period starts: today in India, the last 7 days, the last 30 days, or null for all. */
export function periodStart(period: AgentRunPeriod, now: Date): Date | null {
  if (period === 'today') return istDayStart(now);
  if (period === 'week') return new Date(now.getTime() - 7 * 86_400_000);
  if (period === 'month') return new Date(now.getTime() - 30 * 86_400_000);
  return null;
}

/** Reads the query string; anything unknown falls back to the defaults (all states, this week). */
export function parseAgentRunFilters(params: URLSearchParams): AgentRunFilters {
  const state = params.get('state') as AgentRunStateFilter | null;
  const period = params.get('period') as AgentRunPeriod | null;
  const agent = params.get('agent')?.trim() || null;
  return {
    state: state && AGENT_RUN_STATE_FILTERS.includes(state) ? state : 'all',
    period: period && AGENT_RUN_PERIODS.includes(period) ? period : 'week',
    agent: agent && findSubAgent(agent) ? agent : null,
    search: (params.get('search') ?? '').trim().slice(0, 80),
  };
}

/**
 * Filters the list. An open run always shows, whatever the period, so nothing waiting on a
 * person drops out of the control room because it started last month.
 */
export function filterAgentRuns(items: AgentRunItem[], filters: AgentRunFilters, now: Date): AgentRunItem[] {
  const since = periodStart(filters.period, now);
  const q = filters.search.toLowerCase();
  return items.filter((item) => {
    if (since && !isOpenBucket(item.bucket) && new Date(item.startedAt) < since) return false;
    if (filters.state === 'open' && !isOpenBucket(item.bucket)) return false;
    if (filters.state !== 'all' && filters.state !== 'open' && item.bucket !== filters.state) return false;
    if (filters.agent && item.taskId !== filters.agent) return false;
    if (q) {
      const hay = `${item.agentName} ${item.form} ${item.companyName} ${item.result ?? ''} ${item.startedBy ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** The agents in a list with their counts, for the Agent filter. */
export function agentFacets(items: AgentRunItem[]): Array<{ taskId: string; name: string; count: number }> {
  const m = new Map<string, { taskId: string; name: string; count: number }>();
  for (const i of items) {
    const hit = m.get(i.taskId);
    if (hit) hit.count += 1;
    else m.set(i.taskId, { taskId: i.taskId, name: i.agentName, count: 1 });
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* ----------------------------------------------------------------------------- Agents today */

/** One compliance occurrence in the next seven days whose card has an agent. */
export interface DueOccurrence {
  id: string;
  engagementDbId: string;
  obligationId: string;
  dueDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  filedOn: string | null;
  /** The statutory workflow stage, when the occurrence has one. */
  stage: string | null;
}

export interface GstRunKey {
  engagementDbId: string;
  form: string;
  period: string;
  status: string;
}

const GST_READY = new Set(['saved', 'checked', 'filing']);
const STAGE_READY = new Set(['ready', 'review']);

/** The obligation a GST form files (`gstr3b` → `gst-gstr-3b`), from the catalog. */
export function gstObligationId(form: string): string | null {
  return findSubAgent(gstTaskId(form))?.obligationIds?.[0] ?? null;
}

/** True when an occurrence and a GST return run are the same filing (company, form and month). */
export function gstRunMatches(occ: Pick<DueOccurrence, 'engagementDbId' | 'obligationId' | 'periodStart' | 'periodEnd'>, run: Omit<GstRunKey, 'status'>): boolean {
  if (occ.engagementDbId !== run.engagementDbId || gstObligationId(run.form) !== occ.obligationId) return false;
  const month = gstPeriodMonth(run.period);
  if (!month) return false;
  const annual = run.form === 'gstr9' || run.form === 'gstr9c';
  const ref = annual ? occ.periodEnd : occ.periodStart;
  return Boolean(ref && ref.slice(0, 7) === month);
}

/**
 * Ready means a person could file it now: the statutory workflow says Ready to start or
 * Submitted for review, or the GST return agent has saved the return and waits for the checks,
 * the payment or the EVC.
 */
export function occurrenceReady(occ: DueOccurrence, gstRuns: GstRunKey[]): boolean {
  if (occ.stage && STAGE_READY.has(occ.stage)) return true;
  return gstRuns.some((r) => GST_READY.has(r.status) && gstRunMatches(occ, r));
}

export interface AgentsTodaySummary {
  yourTurn: number;
  running: number;
  filedToday: number;
  dueIn7: number;
  dueReady: number;
  yourTurnRuns: AgentRunItem[];
  runningRuns: AgentRunItem[];
}

export const AGENTS_TODAY_LIST_MAX = 8;

/** An occurrence is in the next seven days (today included) and not filed. */
export function dueWithinDays(occ: Pick<DueOccurrence, 'dueDate' | 'status' | 'filedOn'>, today: string, days = 7): boolean {
  if (occ.filedOn || occ.status === 'filed') return false;
  const due = Date.parse(`${occ.dueDate}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  return due >= start && due <= start + days * 86_400_000;
}

export function summarizeAgentsToday(items: AgentRunItem[], due: DueOccurrence[], gstRuns: GstRunKey[], now: Date): AgentsTodaySummary {
  const dayStart = istDayStart(now);
  const today = new Date(dayStart.getTime() + IST_MS).toISOString().slice(0, 10);
  const yourTurn = items.filter((i) => i.bucket === 'your_turn');
  const running = items.filter((i) => i.bucket === 'running');
  const soon = due.filter((d) => dueWithinDays(d, today));
  return {
    yourTurn: yourTurn.length,
    running: running.length,
    filedToday: items.filter((i) => i.isFiling && i.endedAt && new Date(i.endedAt) >= dayStart).length,
    dueIn7: soon.length,
    dueReady: soon.filter((d) => occurrenceReady(d, gstRuns)).length,
    yourTurnRuns: yourTurn.slice(0, AGENTS_TODAY_LIST_MAX),
    runningRuns: running.slice(0, AGENTS_TODAY_LIST_MAX),
  };
}

/* ---------------------------------------------------------------------------- Agent results */

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonth(value: string | null | undefined): value is string {
  return Boolean(value && MONTH.test(value));
}

/** The calendar month in India that `now` falls in, as `YYYY-MM`. */
export function currentMonth(now: Date): string {
  return new Date(now.getTime() + IST_MS).toISOString().slice(0, 7);
}

export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** The first instant of a month in India and of the month after it. */
export function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return { start: new Date(Date.UTC(y, m - 1, 1) - IST_MS), end: new Date(Date.UTC(y, m, 1) - IST_MS) };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export interface PatchFact {
  recipeId: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AgentResultRow {
  filedAt: string;
  agentName: string;
  form: string;
  companyName: string;
  route: AgentRunRoute;
  result: string;
  agentMinutes: number;
  manualMinutes: number;
  savedMinutes: number;
}

export interface AgentResults {
  month: string;
  label: string;
  filings: number;
  filingsPrev: number;
  byAgent: Array<{ taskId: string; name: string; count: number }>;
  minutesSaved: number;
  hoursSaved: number;
  savedPerFiling: number | null;
  fieldsFilled: number;
  fieldsTotal: number;
  autoFilledPct: number | null;
  autoFilledTarget: number;
  heals: number;
  healsFailed: number;
  breaks: number;
  breakRecipes: number;
  breaksFixed: number;
  /** Average manual minutes of this month's filings (estimate). */
  minutesBefore: number | null;
  /** Median measured minutes of this month's filings. */
  minutesAfter: number | null;
  browserHours: number;
  browserSessions: number;
  browserHoursCap: number;
  apiFilings: number;
  rows: AgentResultRow[];
}

export const AUTO_FILLED_TARGET = 95;

const within = (iso: string | null, start: Date, end: Date) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The month's results from the runs that started or filed in it (and in the month before, for
 * the change in filings) and the recipe fixes proposed in it.
 */
export function computeAgentResults(input: { month: string; items: AgentRunItem[]; patches: PatchFact[]; browserHoursCap: number }): AgentResults {
  const { month, items, patches, browserHoursCap } = input;
  const { start, end } = monthBounds(month);
  const prev = monthBounds(previousMonth(month));

  const filings = items.filter((i) => i.isFiling && within(i.endedAt, start, end));
  const filingsPrev = items.filter((i) => i.isFiling && within(i.endedAt, prev.start, prev.end)).length;
  const started = items.filter((i) => within(i.startedAt, start, end));

  const byAgentMap = new Map<string, { taskId: string; name: string; count: number }>();
  for (const f of filings) {
    const hit = byAgentMap.get(f.taskId);
    if (hit) hit.count += 1;
    else byAgentMap.set(f.taskId, { taskId: f.taskId, name: f.agentName, count: 1 });
  }

  const rows: AgentResultRow[] = filings
    .map((f) => {
      const manual = manualMinutesFor(f.taskId);
      return {
        filedAt: f.endedAt!,
        agentName: f.agentName,
        form: f.form,
        companyName: f.companyName,
        route: f.route,
        result: f.result ?? '',
        agentMinutes: f.minutes,
        manualMinutes: manual,
        savedMinutes: Math.max(0, manual - f.minutes),
      };
    })
    .sort((a, b) => a.filedAt.localeCompare(b.filedAt));

  const minutesSaved = rows.reduce((s, r) => s + r.savedMinutes, 0);
  const browser = started.filter((i) => i.route === 'browser');
  const fieldsFilled = browser.reduce((s, i) => s + i.fieldsDone, 0);
  const fieldsTotal = browser.reduce((s, i) => s + i.fieldsTotal, 0);
  const sessions = started.filter((i) => i.source === 'session');
  const monthPatches = patches.filter((p) => within(p.createdAt, start, end));

  return {
    month,
    label: monthLabel(month),
    filings: filings.length,
    filingsPrev,
    byAgent: [...byAgentMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    minutesSaved,
    hoursSaved: round1(minutesSaved / 60),
    savedPerFiling: rows.length ? Math.round(minutesSaved / rows.length) : null,
    fieldsFilled,
    fieldsTotal,
    autoFilledPct: fieldsTotal > 0 ? Math.round((fieldsFilled / fieldsTotal) * 100) : null,
    autoFilledTarget: AUTO_FILLED_TARGET,
    heals: started.reduce((s, i) => s + i.heals, 0),
    healsFailed: started.reduce((s, i) => s + i.healsFailed, 0),
    breaks: monthPatches.length,
    breakRecipes: new Set(monthPatches.map((p) => p.recipeId)).size,
    breaksFixed: patches.filter((p) => p.status === 'approved' && within(p.reviewedAt, start, end)).length,
    minutesBefore: rows.length ? Math.round(rows.reduce((s, r) => s + r.manualMinutes, 0) / rows.length) : null,
    minutesAfter: median(rows.map((r) => r.agentMinutes)),
    browserHours: round1(sessions.reduce((s, i) => s + i.browserMinutes, 0) / 60),
    browserSessions: sessions.length,
    browserHoursCap,
    apiFilings: filings.filter((f) => f.route === 'api').length,
    rows,
  };
}

/** The first `n` entries and one "Others" entry that sums the rest. */
export function topWithOthers<T extends { name: string; count: number }>(list: T[], n = 5): Array<{ name: string; count: number }> {
  if (list.length <= n + 1) return list.map(({ name, count }) => ({ name, count }));
  const head = list.slice(0, n).map(({ name, count }) => ({ name, count }));
  return [...head, { name: 'Others', count: list.slice(n).reduce((s, x) => s + x.count, 0) }];
}

/** The month's filings as CSV, one row per filing; the manual minutes are marked as an estimate. */
export function agentResultsCsv(results: AgentResults): string {
  return toCsv(
    ['Filed at', 'Agent', 'Form', 'Client', 'Route', 'Result', 'Agent minutes', 'Manual minutes (estimate)', 'Minutes saved (estimate)'],
    results.rows.map((r) => [r.filedAt, r.agentName, r.form, r.companyName, r.route === 'api' ? 'API' : 'Browser', r.result, r.agentMinutes, r.manualMinutes, r.savedMinutes]),
  );
}
