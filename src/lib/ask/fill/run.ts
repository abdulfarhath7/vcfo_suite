import 'server-only';

import type { AuthContext } from '@/auth/guards';
import type { AnswerEnvelope } from '@/data/ask/schema';
import { getItem } from '@/data/checklist';
import { getAskChangesetForDecision, rowNeedsManager, setAskChangesetStatus, updateAskChangesetRows, type AskChangesetRowRow, type ChangesetAccess } from '@/db/repositories/ask-changesets';
import { getAskConversation } from '@/db/repositories/ask-conversations';
import { appendAskMessage } from '@/db/repositories/ask-messages';
import { askRunActor, createAskRun, findOpenAskFillRun, getOwnAskRun, lockAskRun, updateAskRun, type AskRunRow } from '@/db/repositories/ask-runs';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { checklistStateFromRow, getEngagementById } from '@/db/repositories/engagements';
import { submitStepWithNotices } from '@/lib/actions/checklist/submit-step';
import { fieldOf, otherStepValue, responseKey } from '@/lib/actions/checklist/rules';
import type { ActionContext } from '@/lib/actions/types';
import { applyRow, OPEN, OPEN_ROW, recheckRows } from '@/lib/ask/changeset/apply';
import type { JsonValue, RowCheck } from '@/lib/ask/changeset/types';
import { checklistGateViewerFrom, gateActiveCatalog, getStepGate } from '@/lib/checklist/checklist-step-gate';
import { isDirectFlowStep, isDirectFlowStepComplete, MANAGER_APPROVAL_STEP_ID } from '@/lib/incorporation/pre-inc-direct-flow';
import { stepCompleteness, type CompletenessEngagement } from '@/lib/incorporation/step-completeness';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { isFillRow, planFill } from './plan';
import { ASK_FILL_EVENT, FILL_WORKFLOW, type FillLadder, type FillMode, type FillRunView, type FillScope, type FillState, type FillStepState } from './types';
import { boardResolutionLine } from './draft-br-decision';

/**
 * "Fill into app" (PLAN K): the card's checklist values saved into every step as drafts, in
 * checklist order, including steps not open yet. A fill never submits: the person submits each step
 * in order as before, or presses "Submit ready steps" (`submitReadySteps`), which submits complete
 * steps through the step page's own submit and stops at the first one that is not ready.
 *
 * - Auto: `fillStep` applies the step's clear rows through the card's own `applyRow` (so every rule
 *   runs again and Undo still works), then goes on to the next step. `src/jobs/ask-fill.ts` runs it,
 *   or `runAskFill` in this process.
 * - Manual: the browser types the values into the page in front of the person, who checks them and
 *   accepts; the page is saved (not submitted). The server never writes a field value;
 *   `acceptManualStep` checks the page was saved and marks each row saved or left.
 *
 * A step this person may not fill (the manager's approval step, the client's step, a page they cannot
 * edit) is left with its reason and the run goes on. The run's state holds ids and reasons only;
 * values stay on the card's rows.
 */

export class FillRefused extends Error {
  constructor(
    message: string,
    readonly status: number = 409,
  ) {
    super(message);
    this.name = 'FillRefused';
  }
}

const asJson = (state: FillState) => state as unknown as JsonValue;

export function fillStateOf(run: Pick<AskRunRow, 'state'>): FillState {
  const raw = (run.state ?? {}) as unknown as Partial<FillState>;
  return { changesetId: '', engagementId: '', companyName: '', mode: 'manual', current: null, steps: [], ...raw };
}

const titleOf = (stepId: string) => getItem(stepId)?.title ?? stepId;
const isClear = (checks: readonly RowCheck[]) => checks.every((check) => check.ok);
/**
 * A row's value as the text the form holds. The JSONB column can hand a numeric-looking answer back
 * as a number ("1500000" read as 1500000), so a number or boolean is turned back into its text.
 */
export function rowText(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}
const heldOf = (row: Pick<AskChangesetRowRow, 'heldReason' | 'checks'>) => row.heldReason ?? row.checks.find((check) => !check.ok)?.message ?? undefined;

/** A checklist answer row with its value as text, so the rules and the apply see what the form stores. */
function asFormText(row: AskChangesetRowRow): AskChangesetRowRow {
  if (row.action !== 'checklist.setResponse' || typeof row.newValue === 'string') return row;
  const text = rowText(row.newValue);
  return text === null ? row : { ...row, newValue: text };
}

function stepRowsOf(found: ChangesetAccess, stepId: string): AskChangesetRowRow[] {
  return found.rows.filter((row) => isFillRow(row) && row.target.stepId === stepId).map(asFormText);
}

const openRowsOf = (rows: readonly AskChangesetRowRow[]) => rows.filter((row) => OPEN_ROW.has(row.status));

/** The card, for this person, still open. Staff only: a client never reaches a fill. */
async function loadCard(ctx: AuthContext, changesetId: string): Promise<ChangesetAccess> {
  if (ctx.role === 'client') throw new FillRefused('Fill into app is for staff.', 403);
  const found = await getAskChangesetForDecision(ctx, changesetId);
  if (!found || !found.changeset.engagementId) throw new FillRefused('This card is not available.', 404);
  if (!found.owner && !found.manager) throw new FillRefused('This card is not yours to fill.', 403);
  if (!OPEN.includes(found.changeset.status)) throw new FillRefused('This card has already been decided.');
  if (found.changeset.expiresAt <= new Date()) throw new FillRefused('This card has expired. Please send the details again.');
  return found;
}

async function loadRun(ctx: AuthContext, runId: string): Promise<{ run: AskRunRow; state: FillState }> {
  if (ctx.role === 'client') throw new FillRefused('Fill into app is for staff.', 403);
  const run = await getOwnAskRun(ctx, runId);
  if (!run || run.workflow !== FILL_WORKFLOW) throw new FillRefused('This fill is not available.', 404);
  return { run, state: fillStateOf(run) };
}

async function loadProject(ctx: AuthContext, engagementId: string) {
  const row = await getEngagementById(ctx, engagementDbId(engagementId));
  return row ? { row, checklist: checklistStateFromRow(row) } : null;
}

async function loadChecklist(ctx: AuthContext, engagementId: string) {
  return (await loadProject(ctx, engagementId))?.checklist ?? null;
}

function actionContext(ctx: AuthContext, found: ChangesetAccess, now: Date): ActionContext {
  return { auth: ctx, engagementId: found.changeset.engagementId, conversationId: found.changeset.conversationId, runId: found.changeset.runId, now, via: 'ask' };
}

type Checklist = NonNullable<Awaited<ReturnType<typeof loadChecklist>>>;

const gateOf = (ctx: Pick<AuthContext, 'role'>, checklist: Checklist, stepId: string) =>
  getStepGate(gateActiveCatalog(checklist, checklistGateViewerFrom('admin', ctx.role)), stepId);

/** Why this person may not submit this step now, or null when the submit may go ahead. */
export function stepBlocker(ctx: Pick<AuthContext, 'role'>, stepId: string, rows: readonly Pick<AskChangesetRowRow, 'target'>[], checklist: Checklist): string | null {
  const title = titleOf(stepId);
  const gate = gateOf(ctx, checklist, stepId);
  if (gate.kind === 'locked') return gate.blockedByTitle ? `"${title}" opens after "${gate.blockedByTitle}", so I stopped there.` : `"${title}" is not open yet, so I stopped there.`;
  if (stepId === MANAGER_APPROVAL_STEP_ID || rows.some(rowNeedsManager)) return `"${title}" needs the manager's approval, so I stopped there. The manager approves it on its page.`;
  if (!isDirectFlowStep(stepId)) {
    return getItem(stepId)?.responsibleRole === 'client'
      ? `"${title}" is the client's step, so I stopped there.`
      : `"${title}" is finished on its own page, not by a submit, so I stopped there.`;
  }
  if (ctx.role !== 'intern') return `Only the project lead submits "${title}", so I stopped there.`;
  return null;
}

/**
 * Why a fill leaves this step and goes on, or null when it fills it. A fill only saves drafts, so a
 * step not open yet is filled too; the manager's approval step and the client's own step are not.
 * A Manual run types into the page, so a page this person cannot edit is left as well.
 */
export function fillSkipReason(ctx: Pick<AuthContext, 'role'>, mode: FillMode, stepId: string, rows: readonly Pick<AskChangesetRowRow, 'target'>[], checklist: Checklist): string | null {
  const title = titleOf(stepId);
  if (stepId === MANAGER_APPROVAL_STEP_ID || rows.some(rowNeedsManager)) return `"${title}" needs the manager's approval, so I left it. The manager fills it from the card.`;
  if (!isDirectFlowStep(stepId) && getItem(stepId)?.responsibleRole === 'client') return `"${title}" is the client's step, so I left it.`;
  if (mode === 'manual' && !gateOf(ctx, checklist, stepId).canEdit) return `"${title}" cannot be edited by you yet, so I left it on the card. Save it from the card or with Auto.`;
  return null;
}

/** The card's status after rows moved, the way the card's own Save settles it. */
async function settleCard(ctx: AuthContext, found: ChangesetAccess, rows: readonly AskChangesetRowRow[], now: Date): Promise<void> {
  if (!rows.some((row) => row.status === 'applied')) return;
  const remaining = rows.some((row) => OPEN_ROW.has(row.status));
  await setAskChangesetStatus(ctx, found, remaining ? 'partly_applied' : 'applied', { appliedAt: now });
}

/** Rows as they stand after the given patches. */
function patched(rows: readonly AskChangesetRowRow[], patches: ReadonlyArray<{ id: string; patch: Partial<AskChangesetRowRow> }>): AskChangesetRowRow[] {
  const byId = new Map(patches.map((p) => [p.id, p.patch]));
  return rows.map((row) => (byId.has(row.id) ? { ...row, ...byId.get(row.id) } : row));
}

/**
 * Moves the run to the first pending step it can work on: a step already complete counts as done, a
 * step this person may not fill is left with its reason and the run goes on. The active step's rows
 * are checked again. A step not open yet is filled as a draft and remembered as filled early.
 * Returns the new state.
 */
async function moveOn(ctx: AuthContext, state: FillState, found: ChangesetAccess, now: Date): Promise<{ state: FillState; rows: AskChangesetRowRow[] }> {
  let rows = found.rows;
  const steps: FillStepState[] = state.steps.map((s) => ({ ...s }));
  const next: FillState = { ...state, steps, current: null };
  const checklist = await loadChecklist(ctx, state.engagementId);
  for (const step of steps) {
    if (step.status !== 'pending' && step.status !== 'active') continue;
    if (!checklist) {
      step.status = 'stopped';
      next.stopReason = step.stopReason = 'This project is not available.';
      return { state: next, rows };
    }
    if (isDirectFlowStepComplete(step.stepId, checklist[step.stepId])) {
      step.status = 'done';
      continue;
    }
    const own = stepRowsOf({ ...found, rows }, step.stepId);
    const skip = fillSkipReason(ctx, state.mode, step.stepId, own, checklist);
    if (skip) {
      step.status = 'stopped';
      step.stopReason = skip;
      continue;
    }
    if (gateOf(ctx, checklist, step.stepId).kind === 'locked') step.early = true;
    step.status = 'active';
    next.current = step.stepId;
    const updates = await recheckRows(actionContext(ctx, found, now), openRowsOf(own));
    if (updates.length > 0) {
      await updateAskChangesetRows(ctx, found, updates);
      rows = patched(rows, updates);
    }
    return { state: next, rows };
  }
  return { state: next, rows };
}

function runStatusOf(state: FillState): FillRunView['status'] {
  if (state.stopReason && !state.current) return 'stopped';
  if (state.current) return state.mode === 'manual' ? 'waiting_user' : 'running';
  return 'done';
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "A, B, C and 2 more". */
function firstFew(labels: readonly string[], few = 3): string {
  if (labels.length <= few) return labels.join(', ');
  return `${labels.slice(0, few).join(', ')} and ${labels.length - few} more`;
}

export interface FillSummary {
  line: string;
  /** The steps still needing answers, one fact each, for the answer's key facts. */
  needs: Array<{ stepId: string; title: string; text: string }>;
  /** The first step that still needs answers: the summary's "Open step" link. */
  openStepId: string | null;
}

/**
 * The closing chat message once a run settles: values and steps filled, how many steps are complete
 * and how many answers the rest still need, the steps left with their reason, and the steps filled
 * before they opened. Names steps and fields, never values.
 */
/** What a "fill everything" run adds to the closing message. Labels and counts only. */
export interface FillSummaryExtra {
  ladder?: FillLadder;
  boardResolutionLine?: string;
  /** Rows where two documents differed and code chose one. */
  conflicts?: number;
}

export function fillSummary(view: Pick<FillRunView, 'companyName' | 'steps' | 'stopReason' | 'status'>, extra: FillSummaryExtra = {}): FillSummary {
  const filled = view.steps.filter((s) => s.filled > 0);
  const values = filled.reduce((sum, s) => sum + s.filled, 0);
  const marked = view.steps.filter((s) => s.completeness && s.status !== 'stopped');
  const complete = marked.filter((s) => s.completeness!.complete);
  const incomplete = marked.filter((s) => !s.completeness!.complete);
  const more = incomplete.reduce((sum, s) => sum + s.completeness!.missing, 0);
  const parts: string[] = [];
  parts.push(values > 0 ? `Filled ${plural(values, 'value')} in ${plural(filled.length, 'step')} for ${view.companyName}.` : `Nothing new was filled for ${view.companyName}.`);
  if (marked.length > 0) {
    parts.push(
      incomplete.length === 0
        ? `${complete.length === 1 ? 'The step is' : `All ${complete.length} steps are`} complete and ready to submit.`
        : `${plural(complete.length, 'step')} complete, ${incomplete.length} need ${more} more.`,
    );
  }
  const left = view.steps.filter((s) => s.status === 'stopped' && s.stopReason && s.stopReason !== view.stopReason);
  if (left.length > 0) parts.push(left.map((s) => s.stopReason).join(' '));
  if (view.stopReason) parts.push(view.stopReason);
  const early = view.steps.filter((s) => s.early && s.filled > 0);
  if (early.length > 0) parts.push(`${plural(early.length, 'step')} ${early.length === 1 ? 'was' : 'were'} filled before ${early.length === 1 ? 'it' : 'they'} opened: check ${early.length === 1 ? 'it' : 'them'} once the earlier steps are final.`);
  const ladder = extra.ladder;
  if (ladder) {
    if (ladder.suggested.length > 0) parts.push(`${plural(ladder.suggested.length, 'answer')} ${ladder.suggested.length === 1 ? 'was' : 'were'} filled as suggested (${firstFew(ladder.suggested.map((g) => g.label))}): check ${ladder.suggested.length === 1 ? 'it' : 'them'}.`);
    if (ladder.askClient.length > 0) {
      parts.push(
        ladder.requestList
          ? `Only the client can give ${plural(ladder.askClient.length, 'answer')}; I put ${ladder.askClient.length === 1 ? 'it' : 'them'} on one draft Ask-client list, not sent.`
          : `Only the client can give ${plural(ladder.askClient.length, 'answer')} (${firstFew(ladder.askClient.map((g) => g.label))}).`,
      );
    }
    if (ladder.left.length > 0) parts.push(`Left for the project lead: ${firstFew(ladder.left.map((g) => g.label))}.`);
  }
  if (extra.conflicts) parts.push(`Documents differed on ${plural(extra.conflicts, 'answer')}; I used the signed, final or newest one and kept the other as a note on the card.`);
  if (extra.boardResolutionLine) parts.push(extra.boardResolutionLine);
  if (complete.length > 0) parts.push('Nothing was submitted; submit each step in order, or press Submit ready steps.');
  const needs = incomplete.map((s) => ({ stepId: s.stepId, title: s.title, text: s.completeness!.labels.length > 0 ? `Needs ${firstFew(s.completeness!.labels)}` : `${s.completeness!.missing} to fill` }));
  return { line: parts.join(' ').slice(0, 1200), needs, openStepId: incomplete[0]?.stepId ?? null };
}

/** The closing line alone, as the chat's text. */
export function fillSummaryLine(view: Pick<FillRunView, 'companyName' | 'steps' | 'stopReason' | 'status'>, extra: FillSummaryExtra = {}): string {
  const summary = fillSummary(view, extra);
  if (summary.needs.length === 0) return summary.line;
  return `${summary.line} ${summary.needs.map((n) => `${n.title}: ${n.text}.`).join(' ')}`.slice(0, 1200);
}

function summaryAnswer(view: FillRunView, run: Pick<AskRunRow, 'id'>, mode: FillMode, extra: FillSummaryExtra = {}): AnswerEnvelope {
  const summary = fillSummary(view, extra);
  const facts = summary.needs.slice(0, 6).map((n) => ({ k: n.title.slice(0, 60), v: n.text.slice(0, 200) }));
  const line = summary.needs.length === 1 ? `${summary.line} ${summary.needs[0]!.title}: ${summary.needs[0]!.text}.`.slice(0, 1200) : summary.line;
  return {
    line,
    citations: [],
    actions: [],
    origin: 'work',
    depth: 'normal',
    fill: { runId: run.id, mode },
    ...(facts.length >= 2 ? { visual: { type: 'keyFacts' as const, facts } } : {}),
    ...(() => {
      const links = summaryLinks(view, summary, extra);
      return links.length > 0 ? { links } : {};
    })(),
  };
}

/**
 * The closing message's buttons. A plain fill opens the first step still needing answers. A whole
 * fill offers Review drafts (the first step it filled) and Send Ask-client list (the Requests page,
 * where the person sends it; nothing is sent from here). Submit ready steps is the fill rail's own
 * button, which the answer's `fill` brings.
 */
function summaryLinks(view: FillRunView, summary: FillSummary, extra: FillSummaryExtra): NonNullable<AnswerEnvelope['links']> {
  const links: NonNullable<AnswerEnvelope['links']> = [];
  if (!extra.ladder) {
    if (summary.openStepId) links.push({ dest: { to: 'projectStep', engagementId: view.engagementId, stepId: summary.openStepId }, label: `Open ${titleOf(summary.openStepId)}`.slice(0, 60), primary: true });
    return links;
  }
  const first = view.steps.find((s) => s.filled > 0)?.stepId ?? summary.openStepId;
  if (first) links.push({ dest: { to: 'projectStep', engagementId: view.engagementId, stepId: first }, label: 'Review drafts', primary: true });
  if (extra.ladder.requestList) links.push({ dest: { to: 'list', list: 'requests' }, label: 'Send Ask-client list' });
  return links;
}

/**
 * Writes the run's state and status; a settled run also gets its closing chat message once. The
 * closing answer carries only `fill`: the card is already above it in the chat, and a bare `runId`
 * would be read as a background drop.
 */
async function saveRun(ctx: AuthContext, run: AskRunRow, state: FillState, rows?: readonly AskChangesetRowRow[]): Promise<FillState> {
  const status = runStatusOf(state);
  const settled = status === 'done' || status === 'stopped';
  const next = { ...state };
  // A whole fill settles the draft board resolution once: generated in an Auto run (the job), or
  // what it still needs. Only when the run covered that step.
  if (settled && next.ladder && next.boardResolutionLine === undefined && (!next.scope || next.scope.stepIds.includes(MANAGER_APPROVAL_STEP_ID))) {
    const { draftBoardResolutionAfterFill } = await import('./draft-br');
    next.boardResolutionLine = boardResolutionLine(await draftBoardResolutionAfterFill(ctx, state.engagementId, { generate: next.mode === 'auto' }));
  }
  if (settled && !next.answerMessageId && run.conversationId) {
    const cardRows = rows ?? (await getAskChangesetForDecision(ctx, state.changesetId).catch(() => null))?.rows ?? [];
    const project = await loadProject(ctx, state.engagementId).catch(() => null);
    const view = buildFillView({ ...run, status }, next, { rows: cardRows }, project);
    const extra: FillSummaryExtra = next.ladder
      ? { ladder: next.ladder, boardResolutionLine: next.boardResolutionLine, conflicts: cardRows.filter((r) => isFillRow(r) && r.checks.some((c) => c.rule === 'documents_chosen')).length }
      : {};
    const answer = summaryAnswer(view, run, next.mode, extra);
    const text = fillSummaryLine(view, extra);
    const message = await appendAskMessage(ctx, run.conversationId, { sender: 'assistant', text, answer, origin: 'work', path: 'fixed_workflow' });
    if (message) next.answerMessageId = message.id;
  }
  await updateAskRun(ctx, run.id, { status, state: asJson(next), ...(settled ? { finishedAt: new Date() } : {}) });
  return next;
}

async function auditStep(ctx: AuthContext, state: FillState, stepId: string, fields: string[], extra: Record<string, unknown> = {}): Promise<void> {
  const early = state.steps.find((s) => s.stepId === stepId)?.early === true;
  await recordAuditEvent(ctx, {
    engagementId: state.engagementId,
    action: 'ask.fill.step',
    // The step page's activity reads this line: a step filled before it opened says to check it.
    summary: early ? `Ask VCFO filled "${titleOf(stepId)}" before it opened (${state.chip ?? state.mode}); please check it once the earlier steps are final` : `Ask VCFO filled "${titleOf(stepId)}" (${state.chip ?? state.mode})`,
    metadata: { via: 'ask', mode: state.mode, stepId, changesetId: state.changesetId, fields, submitted: false, ...(early ? { early: true } : {}), ...extra },
    result: 'ok',
  });
}

function fieldName(stepId: string, key: string): string {
  const [group, entryId, fieldId] = key.split('.');
  const field = fieldId && group && entryId ? fieldOf({ stepId, fieldId, group, entryId }) : fieldOf({ stepId, fieldId: key });
  return field?.label ?? key;
}

/** The submit as the lead, with the same notices the step page sends. Null when it went through. */
async function submitStep(ctx: AuthContext, engagementId: string, stepId: string): Promise<string | null> {
  const title = titleOf(stepId);
  let result: Awaited<ReturnType<typeof submitStepWithNotices>>;
  try {
    result = await submitStepWithNotices(ctx, engagementId, stepId);
  } catch (error) {
    return `"${title}" could not be submitted: ${error instanceof Error ? error.message : 'the submit failed'}.`;
  }
  if (result.outcome === 'invalid') {
    const labels = [...new Set(Object.keys(result.fieldErrors).map((key) => fieldName(stepId, key)))];
    return `"${title}" is not complete yet, so I stopped there. Still needed: ${labels.join(', ')}.`;
  }
  if (result.outcome === 'waiting_on_lead') return `"${title}" is waiting on the project lead.`;
  return null;
}

export interface FillStepResult {
  /** The step the run moved on to, or null when it settled. */
  next: string | null;
  status: FillRunView['status'];
  stopReason?: string;
}

/**
 * Auto mode, one step: check the step's rows again, apply every clear row through `applyRow` as a
 * draft, then go on to the next step. Nothing is submitted. Refuses a manual run: there the browser
 * does the writing.
 */
export async function fillStep(ctx: AuthContext, runId: string, stepId: string): Promise<FillStepResult> {
  const { run, state } = await loadRun(ctx, runId);
  if (state.mode !== 'auto') throw new FillRefused('This fill is in manual mode.');
  if (run.status !== 'running' || state.current !== stepId) return { next: null, status: runStatusOf(state), stopReason: state.stopReason };
  const found = await loadCard(ctx, state.changesetId);
  const now = new Date();
  const checklist = await loadChecklist(ctx, state.engagementId);
  const steps = state.steps.map((s) => ({ ...s }));
  const step = steps.find((s) => s.stepId === stepId)!;
  const stop = async (reason: string, rows: AskChangesetRowRow[]) => {
    step.status = 'stopped';
    step.stopReason = reason;
    await settleCard(ctx, found, rows, now);
    const saved = await saveRun(ctx, run, { ...state, steps, current: null, stopReason: reason });
    return { next: null, status: runStatusOf(saved), stopReason: reason };
  };
  if (!checklist) return stop('This project is not available.', found.rows);

  let rows = found.rows;
  if (!isDirectFlowStepComplete(stepId, checklist[stepId])) {
    const own = stepRowsOf(found, stepId);
    const skip = fillSkipReason(ctx, state.mode, stepId, own, checklist);
    if (skip) {
      step.status = 'stopped';
      step.stopReason = skip;
      const moved = await moveOn(ctx, { ...state, steps }, { ...found, rows }, now);
      const saved = await saveRun(ctx, run, moved.state, moved.rows);
      return { next: saved.current, status: runStatusOf(saved), stopReason: saved.stopReason };
    }

    const actx = actionContext(ctx, found, now);
    const updates = await recheckRows(actx, openRowsOf(own));
    if (updates.length > 0) await updateAskChangesetRows(ctx, found, updates);
    rows = patched(rows, updates);
    const fields: string[] = [];
    const failed: string[] = [];
    for (const row of openRowsOf(stepRowsOf({ ...found, rows }, stepId))) {
      if (!isClear(row.checks)) continue;
      const outcome = await applyRow(actx, row);
      await updateAskChangesetRows(ctx, found, [{ id: row.id, patch: outcome.patch }]);
      rows = patched(rows, [{ id: row.id, patch: outcome.patch as Partial<AskChangesetRowRow> }]);
      if (outcome.patch.status === 'applied') fields.push(responseKey(row.target as never));
      else if (outcome.patch.status === 'failed') failed.push(row.label);
    }
    // A value that did not save stays on the card with its error; the step is never submitted here.
    await auditStep(ctx, { ...state, steps }, stepId, fields, failed.length > 0 ? { failed } : {});
  }
  step.status = 'done';
  step.stopReason = undefined;
  await settleCard(ctx, found, rows, now);
  // The person may have pressed Stop while this step was working: their Stop wins.
  const latest = await getOwnAskRun(ctx, runId);
  if (!latest || latest.status !== 'running') return { next: null, status: latest ? runStatusOf(fillStateOf(latest)) : 'stopped' };
  const moved = await moveOn(ctx, { ...state, steps }, { ...found, rows }, now);
  const saved = await saveRun(ctx, run, moved.state, moved.rows);
  return { next: saved.current, status: runStatusOf(saved), stopReason: saved.stopReason };
}

/**
 * Manual mode: the person accepted the step and the page saved it (a draft, not a submit). Checks the
 * page was saved, marks each row saved when the page holds the card's value and left ("changed by you
 * on the page") when it does not, and opens the next step. No field value is written here.
 */
export async function acceptManualStep(ctx: AuthContext, runId: string, stepId: string): Promise<FillRunView> {
  const { run, state } = await loadRun(ctx, runId);
  if (state.mode !== 'manual') throw new FillRefused('This fill runs by itself.');
  if (run.status !== 'waiting_user' || state.current !== stepId) throw new FillRefused('This is not the step the fill is on.');
  const found = await loadCard(ctx, state.changesetId);
  const checklist = await loadChecklist(ctx, state.engagementId);
  if (!checklist) throw new FillRefused('This project is not available.', 404);
  const slice = checklist[stepId];
  const saved = slice?.responses ?? {};
  const open = openRowsOf(stepRowsOf(found, stepId));
  const keyOf = (row: AskChangesetRowRow) => responseKey(row.target as { fieldId: string; group?: string; entryId?: string });
  const onPageOf = (row: AskChangesetRowRow) => (saved[keyOf(row)] ?? '').trim();
  const sameOf = (row: AskChangesetRowRow) => {
    const value = rowText(row.newValue)?.trim() ?? '';
    return row.action === 'checklist.attachFile' ? onPageOf(row).length > 0 : onPageOf(row) === value && value.length > 0;
  };
  // The page typed every clear row; when none of them reads anything new on the saved step, the
  // page was not saved (a value the person changed still reads as changed).
  const typed = open.filter((row) => isClear(row.checks) && !row.heldReason);
  const unsaved = typed.length > 0 && typed.every((row) => !sameOf(row) && onPageOf(row) === (rowText(row.oldValue) ?? '').trim());
  if (unsaved) throw new FillRefused('This page is not saved yet. Save it on the page first, then accept.');

  const now = new Date();
  const updates: Array<{ id: string; patch: Partial<AskChangesetRowRow> }> = [];
  const fields: string[] = [];
  const left: string[] = [];
  for (const row of open) {
    const target = row.target as { engagementId: string; stepId: string; fieldId: string; group?: string; entryId?: string };
    const key = keyOf(row);
    const same = sameOf(row);
    // A row the page never typed (held by a rule) stays on the card as it was.
    if (!same && !typed.includes(row)) continue;
    if (same) {
      fields.push(key);
      const undoData = { engagementId: target.engagementId, stepId, key, previous: rowText(row.oldValue) ?? '', applied: saved[key] ?? '', ...(target.group && target.entryId ? { group: target.group, entryId: target.entryId, addedEntry: row.target.newEntry === true } : {}) };
      updates.push({ id: row.id, patch: { status: 'applied', error: null, heldReason: null, appliedAt: now, undoData } });
    } else {
      left.push(key);
      updates.push({ id: row.id, patch: { status: 'skipped', error: 'Changed by you on the page.' } });
    }
  }
  if (updates.length > 0) await updateAskChangesetRows(ctx, found, updates);
  const rows = patched(found.rows, updates);
  await auditStep(ctx, state, stepId, fields, { left });
  await settleCard(ctx, found, rows, now);

  const steps = state.steps.map((s) => (s.stepId === stepId ? { ...s, status: 'done' as const, stopReason: undefined } : s));
  const moved = await moveOn(ctx, { ...state, steps }, { ...found, rows }, now);
  const next = await saveRun(ctx, run, moved.state, moved.rows);
  return buildFillView({ ...run, status: runStatusOf(next) }, next, { ...found, rows: moved.rows }, await loadProject(ctx, state.engagementId));
}

export interface SubmitReadyResult {
  /** The steps submitted, in order. */
  submitted: string[];
  /** Why it stopped before the end, or null when every complete step went through. */
  stopReason: string | null;
  line: string;
  view: FillRunView;
}

/**
 * "Submit ready steps": the fill's steps in checklist order, each submitted through the step page's
 * own submit (`submitStepWithNotices`, which validates again) while it is complete. Stops at the first
 * step that is not complete, not open, or not this person's to submit, and says why. A step already
 * submitted is passed over.
 */
export async function submitReadySteps(ctx: AuthContext, runId: string): Promise<SubmitReadyResult> {
  const { run, state } = await loadRun(ctx, runId);
  if (run.status === 'running' || run.status === 'waiting_user') throw new FillRefused('The fill is still going. Submit the steps once it has finished.');
  const found = await getAskChangesetForDecision(ctx, state.changesetId).catch(() => null);
  const rows = found?.rows ?? [];
  const submitted: string[] = [];
  let stopReason: string | null = null;
  for (const step of state.steps) {
    const project = await loadProject(ctx, state.engagementId);
    if (!project) {
      stopReason = 'This project is not available.';
      break;
    }
    if (isDirectFlowStepComplete(step.stepId, project.checklist[step.stepId])) continue;
    const own = rows.filter((row) => isFillRow(row) && row.target.stepId === step.stepId);
    const blocker = stepBlocker(ctx, step.stepId, own, project.checklist);
    if (blocker) {
      stopReason = blocker;
      break;
    }
    const mark = stepCompleteness({ stepId: step.stepId, state: project.checklist, engagement: project.row as CompletenessEngagement });
    if (mark && !mark.complete) {
      stopReason = `"${titleOf(step.stepId)}" still needs ${mark.labels.length > 0 ? firstFew(mark.labels) : plural(mark.missing, 'answer')}, so I stopped there.`;
      break;
    }
    const refused = await submitStep(ctx, state.engagementId, step.stepId);
    if (refused) {
      stopReason = refused;
      break;
    }
    submitted.push(titleOf(step.stepId));
  }
  const head = submitted.length > 0 ? `Submitted ${plural(submitted.length, 'step')}: ${submitted.join(', ')}.` : 'No step was submitted.';
  const line = stopReason ? `${head} ${stopReason}` : `${head} Every complete step on this fill is submitted.`;
  await recordAuditEvent(ctx, {
    engagementId: state.engagementId,
    action: 'ask.fill.submit_ready',
    summary: `Ask VCFO submitted ${plural(submitted.length, 'ready step')}`,
    metadata: { via: 'ask', changesetId: state.changesetId, submitted, ...(stopReason ? { stoppedAt: stopReason } : {}) },
    result: 'ok',
  });
  if (run.conversationId) {
    const answer: AnswerEnvelope = { line: line.slice(0, 1200), citations: [], actions: [], origin: 'work', depth: 'normal' };
    await appendAskMessage(ctx, run.conversationId, { sender: 'assistant', text: line, answer, origin: 'work', path: 'fixed_workflow' }).catch((error) =>
      console.warn('[ask-vcfo] submit-ready message not written', error),
    );
  }
  const view = buildFillView(run, state, found, await loadProject(ctx, state.engagementId));
  return { submitted, stopReason, line, view };
}

/** The person pressed Stop. Steps already done stay saved; the card keeps the rest. */
export async function stopFill(ctx: AuthContext, runId: string): Promise<FillRunView> {
  const { run, state } = await loadRun(ctx, runId);
  if (run.status !== 'running' && run.status !== 'waiting_user') return getFillView(ctx, runId);
  const reason = 'Stopped by you.';
  const steps = state.steps.map((s) => (s.stepId === state.current ? { ...s, status: 'stopped' as const, stopReason: reason } : s));
  const next = await saveRun(ctx, run, { ...state, steps, current: null, stopReason: reason });
  return getFillView(ctx, runId, next);
}

/**
 * The chat line once a fill has started, for the pipeline and for a fill that follows a fetch. The
 * word follows the chip: Auto with "Watch it fill" runs in the browser (a Manual run on the server)
 * but is still Auto to the person.
 */
export function fillStartedLine(started: { mode: FillMode; chip?: FillMode; view: Pick<FillRunView, 'companyName'> }, scope?: FillScope | null): string {
  const company = started.view.companyName || 'this project';
  const only = scope ? ` (${scope.label} only)` : '';
  if (started.mode === 'auto') return `I am filling ${company}${only} (Auto) in the background, saving every step as a draft; I will post here when done.`;
  if (started.chip === 'auto') return `I am filling ${company}${only} (Auto) on screen: each page is typed and saved as a draft, nothing is submitted.`;
  return `I am filling ${company}${only} step by step (Manual): watch each page, then accept it here to save it as a draft.`;
}

/** Starts a fill on a card. Auto mode queues the job; manual mode waits for the page. */
export async function startFill(
  ctx: AuthContext,
  input: {
    changesetId: string;
    mode: FillMode;
    chip?: FillMode;
    conversationId?: string | null;
    scope?: FillScope | null;
    /** A chat fill ("fill everything"): run the gaps ladder first and report it at the end. */
    everything?: boolean;
  },
): Promise<{ runId: string; mode: FillMode; chip?: FillMode; view: FillRunView }> {
  let found = await loadCard(ctx, input.changesetId);
  const scope = input.scope && input.scope.stepIds.length > 0 ? input.scope : null;
  let ladder: FillLadder | undefined;
  // One open run per card: the ladder runs only for a new run, never twice.
  if (input.everything && !(await findOpenAskFillRun(ctx, found.changeset.id, new Date()))) {
    const { prepareFillEverything } = await import('./everything');
    const prepared = await prepareFillEverything(ctx, found, { scope, now: new Date() });
    ladder = prepared.ladder;
    if (prepared.addedRows) found = await loadCard(ctx, input.changesetId);
  }
  const plan = planFill(found.rows, scope?.stepIds);
  if (plan.length === 0) {
    if (scope && planFill(found.rows).length > 0) throw new FillRefused(`This card has no values for ${scope.label}, so nothing was filled. The card keeps its other rows.`, 400);
    throw new FillRefused('This card has no checklist values to fill.', 400);
  }
  // One open run per card. A run the page left behind (a reload, a closed tab) is picked up again
  // rather than refused, because after a reload nothing on screen could stop it any more.
  const open = await findOpenAskFillRun(ctx, found.changeset.id, new Date());
  if (open) {
    const openState = fillStateOf(open);
    return { runId: open.id, mode: openState.mode, ...(openState.chip ? { chip: openState.chip } : {}), view: buildFillView(open, openState, found) };
  }
  const engagementId = found.changeset.engagementId!;
  // A conversation the person does not own is not used; the card's own is, when it is theirs.
  const asked = input.conversationId && (await getAskConversation(ctx, input.conversationId)) ? input.conversationId : null;
  const conversationId = asked ?? (found.owner ? found.changeset.conversationId : null);
  const initial: FillState = {
    changesetId: found.changeset.id,
    engagementId,
    companyName: found.companyName,
    mode: input.mode,
    ...(input.chip && input.chip !== input.mode ? { chip: input.chip } : {}),
    current: null,
    steps: plan.map((p) => ({ stepId: p.stepId, status: 'pending' })),
    ...(scope ? { scope } : {}),
    ...(ladder ? { ladder } : {}),
  };
  const run = await createAskRun(ctx, { conversationId, workflow: FILL_WORKFLOW, goal: `Fill ${found.companyName} (${input.mode})`, budgetTokens: 0, status: 'running', state: asJson(initial) });
  await lockAskRun(ctx, run.id, engagementId);
  const moved = await moveOn(ctx, initial, found, new Date());
  const state = await saveRun(ctx, run, moved.state, moved.rows);
  const status = runStatusOf(state);
  if (input.mode === 'auto' && status === 'running') await queueAskFill(run.id, { profileId: ctx.userId });
  return {
    runId: run.id,
    mode: input.mode,
    ...(state.chip ? { chip: state.chip } : {}),
    view: buildFillView({ ...run, status }, state, { ...found, rows: moved.rows }, await loadProject(ctx, engagementId)),
  };
}

type Project = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

/**
 * The values this fill saved on a step that another step now holds differently (a name or an
 * address changed on an earlier step after it was copied here): the person should check them.
 */
function staleChecks(stepId: string, own: readonly AskChangesetRowRow[], checklist: Checklist): Array<{ label: string; message: string }> {
  const saved = checklist[stepId]?.responses ?? {};
  const out: Array<{ label: string; message: string }> = [];
  for (const row of own) {
    if (row.status !== 'applied' || row.action !== 'checklist.setResponse') continue;
    const target = row.target as { engagementId: string; stepId: string; fieldId: string; group?: string; entryId?: string };
    const value = (saved[responseKey(target)] ?? '').trim();
    if (!value) continue;
    const position = target.group && target.entryId ? (saved[target.group] ?? '').split(',').indexOf(target.entryId) + 1 : 0;
    const other = otherStepValue(target, position || null, checklist);
    if (other && other.value !== value) out.push({ label: row.label, message: `"${other.stepTitle}" now holds a different value. Please check.` });
  }
  return out;
}

/** What the chat rail and the live player read. A manual run's active step carries its values to type. */
export function buildFillView(run: Pick<AskRunRow, 'id' | 'status'>, state: FillState, found: Pick<ChangesetAccess, 'rows'> | null, project?: Project | null): FillRunView {
  const rows = found?.rows ?? [];
  const status = (['running', 'waiting_user', 'done', 'stopped', 'failed'] as const).find((s) => s === run.status) ?? 'running';
  return {
    id: run.id,
    status,
    mode: state.mode,
    ...(state.chip ? { chip: state.chip } : {}),
    engagementId: state.engagementId,
    companyName: state.companyName,
    current: state.current,
    ...(state.stopReason ? { stopReason: state.stopReason } : {}),
    steps: state.steps.map((step) => {
      const own = rows.filter((row) => isFillRow(row) && row.target.stepId === step.stepId && row.status !== 'undone');
      const typing = state.mode === 'manual' && step.status === 'active';
      const mark = project ? stepCompleteness({ stepId: step.stepId, state: project.checklist, engagement: project.row as CompletenessEngagement }) : null;
      const checks = project && step.early ? staleChecks(step.stepId, own, project.checklist) : [];
      return {
        stepId: step.stepId,
        title: titleOf(step.stepId),
        status: step.status,
        filled: own.filter((row) => row.status === 'applied').length,
        total: own.length,
        ...(step.stopReason ? { stopReason: step.stopReason } : {}),
        ...(mark ? { completeness: mark } : {}),
        ...(step.early ? { early: true } : {}),
        ...(checks.length > 0 ? { checks } : {}),
        rows: openRowsOf(own).map((row) => {
          const target = row.target as { fieldId: string; group?: string; entryId?: string; newEntry?: boolean };
          const held = isClear(row.checks) && !row.heldReason ? undefined : heldOf(row);
          return {
            rowId: row.id,
            fieldKey: responseKey(target),
            fieldId: target.fieldId,
            ...(target.group ? { group: target.group } : {}),
            ...(target.entryId ? { entryId: target.entryId } : {}),
            ...(target.newEntry ? { newEntry: true } : {}),
            label: row.label,
            // Only the page being typed needs the value itself; everything else shows the masked one.
            value: typing && row.action === 'checklist.setResponse' ? (rowText(row.newValue) ?? row.displayNew) : row.displayNew,
            ...(held ? { held } : {}),
          };
        }),
      };
    }),
  };
}

export async function getFillView(ctx: AuthContext, runId: string, known?: FillState): Promise<FillRunView> {
  const { run, state } = await loadRun(ctx, runId);
  const found = await getAskChangesetForDecision(ctx, state.changesetId).catch(() => null);
  const project = await loadProject(ctx, state.engagementId).catch(() => null);
  return buildFillView(run, known ?? state, found, project);
}

// ---- The auto loop: the job's steps, and the in-process fallback ----

/** One auto step for the job, as the run's owner. Returns the next step id, or null when the run settled. */
export async function autoFillStep(runId: string, stepId: string): Promise<string | null> {
  const found = await askRunActor(runId);
  if (!found || found.run.workflow !== FILL_WORKFLOW || found.run.status !== 'running') return null;
  return (await fillStep(found.ctx, runId, stepId)).next;
}

/** The step an auto run is on, or null. */
export async function autoFillCurrent(runId: string): Promise<string | null> {
  const found = await askRunActor(runId);
  if (!found || found.run.workflow !== FILL_WORKFLOW || found.run.status !== 'running') return null;
  return fillStateOf(found.run).current;
}

/** After the job gave up: the run is failed and the chat says so. Steps already done stay saved. */
export async function failAskFill(runId: string, error: unknown): Promise<void> {
  const found = await askRunActor(runId);
  if (!found || found.run.workflow !== FILL_WORKFLOW || found.run.status !== 'running') return;
  const { ctx, run } = found;
  console.error('[ask-vcfo] fill failed', runId, error instanceof Error ? error.message : String(error));
  const state = fillStateOf(run);
  const text = 'Something went wrong while I was filling the steps, so I stopped. Steps already done stay saved; the card keeps the rest.';
  if (!state.answerMessageId && run.conversationId) {
    const message = await appendAskMessage(ctx, run.conversationId, {
      sender: 'assistant',
      text,
      answer: { line: text, citations: [], actions: [], origin: 'work', depth: 'normal', fill: { runId, mode: state.mode } },
      origin: 'work',
      path: 'fixed_workflow',
    });
    if (message) state.answerMessageId = message.id;
  }
  await updateAskRun(ctx, runId, { status: 'failed', error: 'fill job failed', state: asJson({ ...state, current: null }), finishedAt: new Date() });
}

/** Most steps a run takes, so a loop never runs away. */
export const FILL_MAX_STEPS = 40;

/** The whole auto fill in this process, step after step, for when no Inngest is reachable. */
export async function runAskFill(runId: string): Promise<void> {
  try {
    let next = await autoFillCurrent(runId);
    for (let i = 0; next && i < FILL_MAX_STEPS; i += 1) next = await autoFillStep(runId, next);
  } catch (error) {
    await failAskFill(runId, error).catch((inner) => console.error('[ask-vcfo] fill failure not recorded', inner));
  }
}

/** Queues an auto fill on Inngest; with no Inngest reachable it runs in this process. */
export async function queueAskFill(runId: string, opts: { profileId?: string } = {}): Promise<'queued' | 'inline'> {
  try {
    const { inngest } = await import('@/jobs/client');
    await inngest.send({ name: ASK_FILL_EVENT, data: { runId, ...(opts.profileId ? { profileId: opts.profileId } : {}) } });
    return 'queued';
  } catch (error) {
    console.warn('[ask-vcfo] inngest unavailable; running the fill inline', error);
    void runAskFill(runId);
    return 'inline';
  }
}
