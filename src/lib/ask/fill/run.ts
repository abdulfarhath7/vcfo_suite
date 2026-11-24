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
import { fieldOf, responseKey } from '@/lib/actions/checklist/rules';
import type { ActionContext } from '@/lib/actions/types';
import { applyRow, OPEN, OPEN_ROW, recheckRows } from '@/lib/ask/changeset/apply';
import type { JsonValue, RowCheck } from '@/lib/ask/changeset/types';
import { checklistGateViewerFrom, gateActiveCatalog, getStepGate } from '@/lib/checklist/checklist-step-gate';
import { isDirectFlowStep, isDirectFlowStepComplete, MANAGER_APPROVAL_STEP_ID } from '@/lib/incorporation/pre-inc-direct-flow';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { isFillRow, planFill } from './plan';
import { ASK_FILL_EVENT, FILL_WORKFLOW, type FillMode, type FillRunView, type FillState, type FillStepState } from './types';

/**
 * "Fill into app": the card's checklist values put into the steps one step at a time, in checklist
 * order, because a step opens only after the one before it is complete.
 *
 * - Auto: `fillStep` applies the step's clear rows through the card's own `applyRow` (so every rule
 *   runs again and Undo still works) and submits the step as the lead; the next step then opens and
 *   its rows are checked again. `src/jobs/ask-fill.ts` runs it, or `runAskFill` in this process.
 * - Manual: the browser types the values into the page in front of the person, who saves and
 *   submits there. The server never writes a field value; `acceptManualStep` only checks that the
 *   step is complete and marks each row saved or left.
 *
 * Both stop at a step the manager approves, a step the lead cannot submit, a locked step, or a
 * submit the validator refuses, and say why. The run's state holds ids and reasons only; values stay
 * on the card's rows.
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

async function loadChecklist(ctx: AuthContext, engagementId: string) {
  const row = await getEngagementById(ctx, engagementDbId(engagementId));
  return row ? checklistStateFromRow(row) : null;
}

function actionContext(ctx: AuthContext, found: ChangesetAccess, now: Date): ActionContext {
  return { auth: ctx, engagementId: found.changeset.engagementId, conversationId: found.changeset.conversationId, runId: found.changeset.runId, now, via: 'ask' };
}

type Checklist = NonNullable<Awaited<ReturnType<typeof loadChecklist>>>;

/** Why this step cannot be filled and submitted by this person, or null when it can. */
export function stepBlocker(ctx: Pick<AuthContext, 'role'>, stepId: string, rows: readonly Pick<AskChangesetRowRow, 'target'>[], checklist: Checklist): string | null {
  const title = titleOf(stepId);
  const gate = getStepGate(gateActiveCatalog(checklist, checklistGateViewerFrom('admin', ctx.role)), stepId);
  if (gate.kind === 'locked') return gate.blockedByTitle ? `"${title}" opens after "${gate.blockedByTitle}", so I stopped there.` : `"${title}" is not open yet, so I stopped there.`;
  if (stepId === MANAGER_APPROVAL_STEP_ID || rows.some(rowNeedsManager)) return `"${title}" needs the manager's approval, so I stopped there. The manager approves it on its page.`;
  if (!isDirectFlowStep(stepId)) {
    return getItem(stepId)?.responsibleRole === 'client'
      ? `"${title}" is the client's step, so I stopped there.`
      : `"${title}" is finished on its own page, not by a fill, so I stopped there.`;
  }
  if (ctx.role !== 'intern') return `Only the project lead submits "${title}", so I stopped there.`;
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
 * step this person cannot fill and submit stops the run with its reason. The active step's rows are
 * checked again, so a row the gate held reads clear once its step is open. Returns the new state.
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
    const blocker = stepBlocker(ctx, step.stepId, own, checklist);
    if (blocker) {
      step.status = 'stopped';
      next.stopReason = step.stopReason = blocker;
      return { state: next, rows };
    }
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
  return state.steps.some((s) => s.status === 'stopped') ? 'stopped' : 'done';
}

/** The closing chat line once a run settles. Names steps, never values. */
export function fillSummaryLine(state: FillState): string {
  const done = state.steps.filter((s) => s.status === 'done').map((s) => titleOf(s.stepId));
  const stopped = state.steps.find((s) => s.status === 'stopped');
  const head = done.length > 0 ? `I filled ${done.length} step${done.length === 1 ? '' : 's'} for ${state.companyName}: ${done.join(', ')}.` : `I did not complete any step for ${state.companyName}.`;
  return stopped?.stopReason ? `${head} ${stopped.stopReason}` : `${head} Every step on the card is done.`;
}

/**
 * Writes the run's state and status; a settled run also gets its closing chat message once. The
 * closing answer carries only `fill`: the card is already above it in the chat, and a bare `runId`
 * would be read as a background drop.
 */
async function saveRun(ctx: AuthContext, run: AskRunRow, state: FillState): Promise<FillState> {
  const status = runStatusOf(state);
  const settled = status === 'done' || status === 'stopped';
  const next = { ...state };
  if (settled && !next.answerMessageId && run.conversationId) {
    const text = fillSummaryLine(next);
    const answer: AnswerEnvelope = { line: text.slice(0, 1200), citations: [], actions: [], origin: 'work', depth: 'normal', fill: { runId: run.id, mode: next.mode } };
    const message = await appendAskMessage(ctx, run.conversationId, { sender: 'assistant', text, answer, origin: 'work', path: 'fixed_workflow' });
    if (message) next.answerMessageId = message.id;
  }
  await updateAskRun(ctx, run.id, { status, state: asJson(next), ...(settled ? { finishedAt: new Date() } : {}) });
  return next;
}

async function auditStep(ctx: AuthContext, state: FillState, stepId: string, fields: string[], extra: Record<string, unknown> = {}): Promise<void> {
  await recordAuditEvent(ctx, {
    engagementId: state.engagementId,
    action: 'ask.fill.step',
    summary: `Ask VCFO filled "${titleOf(stepId)}" (${state.mode})`,
    metadata: { via: 'ask', mode: state.mode, stepId, changesetId: state.changesetId, fields, ...extra },
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
 * Auto mode, one step: check the step's rows again, apply every clear row through `applyRow`, submit
 * the step, then open the next one. Refuses a manual run: there the browser does the writing.
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
    const blocker = stepBlocker(ctx, stepId, own, checklist);
    if (blocker) return stop(blocker, rows);

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
    if (failed.length > 0) {
      // A value the card holds did not save: submitting now would complete the step without it.
      await auditStep(ctx, state, stepId, fields, { submitted: false });
      return stop(`"${titleOf(stepId)}" was not submitted because ${failed.join(', ')} could not be saved. Check the card, then fill again.`, rows);
    }
    const refused = await submitStep(ctx, state.engagementId, stepId);
    await auditStep(ctx, state, stepId, fields, { submitted: !refused });
    if (refused) return stop(refused, rows);
  }
  step.status = 'done';
  step.stopReason = undefined;
  await settleCard(ctx, found, rows, now);
  // The person may have pressed Stop while this step was working: their Stop wins.
  const latest = await getOwnAskRun(ctx, runId);
  if (!latest || latest.status !== 'running') return { next: null, status: latest ? runStatusOf(fillStateOf(latest)) : 'stopped' };
  const moved = await moveOn(ctx, { ...state, steps }, { ...found, rows }, now);
  const saved = await saveRun(ctx, run, moved.state);
  return { next: saved.current, status: runStatusOf(saved), stopReason: saved.stopReason };
}

/**
 * Manual mode: the person saved and submitted the step on its page. Checks the step is complete,
 * marks each row saved when the page holds the card's value and left ("changed by you on the
 * page") when it does not, and opens the next step. No field value is written here.
 */
export async function acceptManualStep(ctx: AuthContext, runId: string, stepId: string): Promise<FillRunView> {
  const { run, state } = await loadRun(ctx, runId);
  if (state.mode !== 'manual') throw new FillRefused('This fill runs by itself.');
  if (run.status !== 'waiting_user' || state.current !== stepId) throw new FillRefused('This is not the step the fill is on.');
  const found = await loadCard(ctx, state.changesetId);
  const checklist = await loadChecklist(ctx, state.engagementId);
  if (!checklist) throw new FillRefused('This project is not available.', 404);
  const slice = checklist[stepId];
  if (!isDirectFlowStepComplete(stepId, slice)) throw new FillRefused('This step is not submitted yet. Save and submit it on the page first.');

  const now = new Date();
  const saved = slice?.responses ?? {};
  const updates: Array<{ id: string; patch: Partial<AskChangesetRowRow> }> = [];
  const fields: string[] = [];
  const left: string[] = [];
  for (const row of openRowsOf(stepRowsOf(found, stepId))) {
    const target = row.target as { engagementId: string; stepId: string; fieldId: string; group?: string; entryId?: string };
    const key = responseKey(target);
    const value = rowText(row.newValue)?.trim() ?? '';
    const onPage = (saved[key] ?? '').trim();
    const same = row.action === 'checklist.attachFile' ? onPage.length > 0 : onPage === value && value.length > 0;
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
  await auditStep(ctx, state, stepId, fields, { submitted: true, left });
  await settleCard(ctx, found, rows, now);

  const steps = state.steps.map((s) => (s.stepId === stepId ? { ...s, status: 'done' as const, stopReason: undefined } : s));
  const moved = await moveOn(ctx, { ...state, steps }, { ...found, rows }, now);
  const next = await saveRun(ctx, run, moved.state);
  return buildFillView({ ...run, status: runStatusOf(next) }, next, { ...found, rows: moved.rows });
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

/** Starts a fill on a card. Auto mode queues the job; manual mode waits for the page. */
export async function startFill(ctx: AuthContext, input: { changesetId: string; mode: FillMode; conversationId?: string | null }): Promise<{ runId: string; mode: FillMode; view: FillRunView }> {
  const found = await loadCard(ctx, input.changesetId);
  const plan = planFill(found.rows);
  if (plan.length === 0) throw new FillRefused('This card has no checklist values to fill.', 400);
  // One open run per card. A run the page left behind (a reload, a closed tab) is picked up again
  // rather than refused, because after a reload nothing on screen could stop it any more.
  const open = await findOpenAskFillRun(ctx, found.changeset.id, new Date());
  if (open) {
    const openState = fillStateOf(open);
    return { runId: open.id, mode: openState.mode, view: buildFillView(open, openState, found) };
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
    current: null,
    steps: plan.map((p) => ({ stepId: p.stepId, status: 'pending' })),
  };
  const run = await createAskRun(ctx, { conversationId, workflow: FILL_WORKFLOW, goal: `Fill ${found.companyName} (${input.mode})`, budgetTokens: 0, status: 'running', state: asJson(initial) });
  await lockAskRun(ctx, run.id, engagementId);
  const moved = await moveOn(ctx, initial, found, new Date());
  const state = await saveRun(ctx, run, moved.state);
  const status = runStatusOf(state);
  if (input.mode === 'auto' && status === 'running') await queueAskFill(run.id, { profileId: ctx.userId });
  return { runId: run.id, mode: input.mode, view: buildFillView({ ...run, status }, state, { ...found, rows: moved.rows }) };
}

/** What the chat rail and the live player read. A manual run's active step carries its values to type. */
export function buildFillView(run: Pick<AskRunRow, 'id' | 'status'>, state: FillState, found: Pick<ChangesetAccess, 'rows'> | null): FillRunView {
  const rows = found?.rows ?? [];
  const status = (['running', 'waiting_user', 'done', 'stopped', 'failed'] as const).find((s) => s === run.status) ?? 'running';
  return {
    id: run.id,
    status,
    mode: state.mode,
    engagementId: state.engagementId,
    companyName: state.companyName,
    current: state.current,
    ...(state.stopReason ? { stopReason: state.stopReason } : {}),
    steps: state.steps.map((step) => {
      const own = rows.filter((row) => isFillRow(row) && row.target.stepId === step.stepId && row.status !== 'undone');
      const typing = state.mode === 'manual' && step.status === 'active';
      return {
        stepId: step.stepId,
        title: titleOf(step.stepId),
        status: step.status,
        filled: own.filter((row) => row.status === 'applied').length,
        total: own.length,
        ...(step.stopReason ? { stopReason: step.stopReason } : {}),
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
  return buildFillView(run, known ?? state, found);
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
