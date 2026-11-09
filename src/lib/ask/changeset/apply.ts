import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { systemNoteAskRunDecision } from '@/db/repositories/ask-runs';
import {
  claimAskChangeset,
  claimAskChangesetEdit,
  claimAskChangesetRow,
  getAskChangesetForDecision,
  rowNeedsManager,
  setAskChangesetStatus,
  updateAskChangesetRows,
  type AskChangesetRow,
  type AskChangesetRowRow,
  type ChangesetAccess,
} from '@/db/repositories/ask-changesets';
import { isFileRow, responseKey } from '@/lib/actions/checklist/rules';
import { getAction } from '@/lib/actions/registry';
import { refusalOf } from '@/lib/actions/shared';
import { agentMayExecute, type ActionContext, type AnyAction } from '@/lib/actions/types';
import { ASK_CHANGESET_DECIDED } from '@/lib/ask/agent/events';
import { askFlags } from '@/lib/ask/config';
import { inngest } from '@/jobs/client';
import { changesetHash } from './hash';
import { recipientKey, type JsonValue } from './types';
import { safeError } from '@/lib/ask/mask';

/**
 * Approval and undo. Nothing here is reachable by a model: these run only from a person's click on
 * the card, through the changeset routes. At the click, code re-parses each row, runs the same rules
 * again against the saved record, compares the content hash and only then calls the action, as the
 * person who clicked.
 */
export class ChangesetRefused extends Error {
  constructor(
    message: string,
    readonly status: number = 409,
  ) {
    super(message);
    this.name = 'ChangesetRefused';
  }
}

const OPEN: readonly string[] = ['proposed', 'partly_applied'];
const OPEN_ROWS = ['proposed', 'edited', 'accepted', 'held', 'failed'] as const;
const OPEN_ROW: ReadonlySet<string> = new Set(OPEN_ROWS);

/** Who may approve one row. Undo takes the same right, row by row, whoever clicked last on the card. */
export function canDecideRow(found: Pick<ChangesetAccess, 'owner' | 'manager'>, row: Pick<AskChangesetRowRow, 'target'>): boolean {
  return rowNeedsManager(row) ? found.manager : found.owner;
}

function actionContext(ctx: AuthContext, found: ChangesetAccess, now: Date): ActionContext {
  return { auth: ctx, engagementId: found.changeset.engagementId, conversationId: found.changeset.conversationId, runId: found.changeset.runId, now, via: 'ask' };
}

async function loadOpen(ctx: AuthContext, id: string, now: Date): Promise<ChangesetAccess> {
  const found = await getAskChangesetForDecision(ctx, id);
  if (!found) throw new ChangesetRefused('This card is not available.', 404);
  if (!OPEN.includes(found.changeset.status)) throw new ChangesetRefused('This card has already been decided.');
  if (found.changeset.expiresAt <= now) {
    await setAskChangesetStatus(ctx, found, 'expired');
    throw new ChangesetRefused('This card has expired. Please send the details again.');
  }
  return found;
}

const inputOf = (row: AskChangesetRowRow) => ({ ...row.target, value: row.newValue });

/** Runs every still-open row's rules again, in order, with earlier rows' answers counted. */
async function recheckRows(actx: ActionContext, rows: readonly AskChangesetRowRow[]) {
  const pending: Record<string, string> = {};
  const updates: Array<Omit<Parameters<typeof updateAskChangesetRows>[2][number], 'from'>> = [];
  for (const row of rows) {
    if (row.status === 'applied' || row.status === 'undone' || row.status === 'skipped') continue;
    const action = await getAction(row.action);
    const parsed = action?.input.safeParse(inputOf(row));
    if (!action?.recheck || !parsed?.success) continue;
    const checked = await action.recheck(actx, parsed.data, pending);
    updates.push({
      id: row.id,
      patch: {
        checks: checked.checks,
        heldReason: checked.heldReason,
        status: checked.heldReason ? 'held' : row.status === 'held' ? 'proposed' : row.status,
        oldValue: checked.oldValue,
        displayOld: checked.displayOld,
        displayNew: checked.displayNew,
      },
    });
    const value = typeof row.newValue === 'string' ? row.newValue : '';
    const key = keyOf(row);
    if (value && key) pending[key] = value;
  }
  return updates;
}

function keyOf(row: AskChangesetRowRow): string | null {
  const { group, entryId, fieldId } = row.target;
  return typeof fieldId === 'string' ? responseKey({ fieldId, group: group as string | undefined, entryId: entryId as string | undefined }) : null;
}

/**
 * A person's correction to one row. It is a server call of its own, so the value is checked and the
 * hash recomputed before the card can show it. A sensitive value is typed in full and shown masked.
 */
export async function editChangesetRow(ctx: AuthContext, id: string, rowId: string, value: string): Promise<void> {
  const now = new Date();
  const found = await loadOpen(ctx, id, now);
  const row = found.rows.find((r) => r.id === rowId);
  if (!row || !canDecideRow(found, row)) throw new ChangesetRefused('This row is not yours to change.', 403);
  if (isFileRow(row.action) || row.status === 'applied') throw new ChangesetRefused('This row cannot be edited.');
  const actx = actionContext(ctx, found, now);
  const action = await getAction(row.action);
  const parsed = action?.input.safeParse({ ...row.target, value });
  if (!action?.recheck || !parsed?.success) throw new ChangesetRefused('This value cannot be used.', 400);
  // The stored value takes the shape the screen stores: a date as YYYY-MM-DD, a PAN in capitals.
  const checked = await action.recheck(actx, parsed.data, {});
  const edited = found.rows.map((r) => (r.id === rowId ? { ...r, newValue: checked.value as JsonValue, status: 'edited' } : r));
  const updates = await recheckRows(actx, edited);
  if (!(await claimAskChangesetEdit(ctx, found, changesetHash(edited.map((r) => ({ action: r.action, target: r.target, newValue: r.newValue as JsonValue })))))) {
    throw new ChangesetRefused('This card has already been decided, or it changed.');
  }
  await updateAskChangesetRows(
    ctx,
    found,
    updates.map((update) => ({ ...update, from: OPEN_ROWS, ...(update.id === rowId ? { patch: { ...update.patch, newValue: checked.value, editedAt: now } } : {}) })),
  );
}

export interface DecisionResult {
  applied: number;
  failed: number;
  held: number;
}

/** The approval. `accept` lists the rows this person accepted; a row not listed stays open. */
export async function decideChangeset(ctx: AuthContext, id: string, input: { contentHash: string; accept: readonly string[] }): Promise<DecisionResult> {
  const now = new Date();
  const found = await loadOpen(ctx, id, now);
  const current = changesetHash(found.rows.map((r) => ({ action: r.action, target: r.target, newValue: r.newValue as JsonValue })));
  if (current !== input.contentHash || current !== found.changeset.contentHash) {
    throw new ChangesetRefused('This card changed after you saw it. Please look at it again.');
  }
  const wanted = found.rows.filter((row) => input.accept.includes(row.id) && OPEN_ROW.has(row.status));
  if (wanted.some((row) => !canDecideRow(found, row))) throw new ChangesetRefused('One of these rows needs the manager to approve it.', 403);
  if (wanted.length === 0) throw new ChangesetRefused('Accept at least one row first.', 400);
  if (!(await claimAskChangeset(ctx, found, input.contentHash, now))) {
    throw new ChangesetRefused('This card has already been decided, or it changed.');
  }

  const actx = actionContext(ctx, found, now);
  const result: DecisionResult = { applied: 0, failed: 0, held: 0 };
  const statusById = new Map(found.rows.map((row) => [row.id, row.status]));
  const fields: string[] = [];
  try {
    for (const row of wanted) {
      // Another click that read this card at the same moment holds the row, or has already run it.
      if (!(await claimAskChangesetRow(ctx, found, row.id, OPEN_ROWS))) continue;
      statusById.set(row.id, 'applying');
      const outcome = await applyRow(actx, row, found.changeset);
      await updateAskChangesetRows(ctx, found, [{ id: row.id, from: ['applying'], patch: outcome.patch }]);
      statusById.set(row.id, outcome.patch.status!);
      if (outcome.patch.status === 'applied') {
        result.applied += 1;
        fields.push(row.target.stepId ? `${String(row.target.stepId)}/${String(row.target.fieldId)}` : row.action);
      } else if (outcome.patch.status === 'held') result.held += 1;
      else result.failed += 1;
    }
  } finally {
    // Whatever stopped the loop, the card leaves `approved`, so it can be decided again and its run is told.
    // The rows are read again, so a click that ran rows at the same moment counts too.
    const statuses = (await getAskChangesetForDecision(ctx, id))?.rows.map((row) => row.status) ?? [...statusById.values()];
    const remaining = statuses.some((status) => OPEN_ROW.has(status) || status === 'applying');
    const saved = statuses.some((status) => status === 'applied');
    const status = remaining ? (saved ? 'partly_applied' : 'proposed') : 'applied';
    await setAskChangesetStatus(ctx, found, status, result.applied > 0 ? { appliedAt: now } : {});
    if (found.changeset.engagementId && result.applied > 0) {
      await recordAuditEvent(ctx, {
        engagementId: found.changeset.engagementId,
        action: 'ask.changeset.applied',
        summary: `Saved ${result.applied} value${result.applied === 1 ? '' : 's'} from an Ask VCFO card`,
        metadata: { via: 'ask', changesetId: id, runId: found.changeset.runId, fields },
        result: 'ok',
      });
    }
    await announceDecision(found, status !== 'partly_applied' && status !== 'proposed');
  }
  return result;
}

/** Ends a fixed workflow's run, or wakes the agent run sleeping on this card. It never undoes a decision. */
async function announceDecision(found: ChangesetAccess, settled: boolean): Promise<void> {
  const { id, runId } = found.changeset;
  if (!runId) return;
  try {
    const kind = await systemNoteAskRunDecision(runId, settled);
    if (kind === 'agent') await inngest.send({ name: ASK_CHANGESET_DECIDED, data: { changesetId: id, runId } });
  } catch (error) {
    console.error('[ask-vcfo] decision not announced', safeError(error));
  }
}

/** An owner's flag or kill switch stops a card already made. A T3 card stops with the T3 switch, whichever tier the action says it is. */
async function loadAction(row: AskChangesetRowRow, cardTier: string): Promise<AnyAction | null> {
  const action = await getAction(row.action);
  const { killedTiers } = askFlags();
  if (!action || !agentMayExecute(action.tier) || killedTiers.has(action.tier) || (cardTier === 'T3' && killedTiers.has('T3'))) return null;
  return action.available?.() === false ? null : action;
}

/**
 * The approval covered the names the card showed for this row: its own, or the card's when the row
 * keeps none. If the same action would now reach someone else, it says who, and nothing goes out. A
 * person who has since left the list is no reason to stop.
 */
async function strangerOnCard(action: AnyAction, actx: ActionContext, input: unknown, row: AskChangesetRowRow, card: AskChangesetRow): Promise<string | null> {
  const draft = await action.preview(actx, input as never);
  const own = row.target.cardRecipients;
  const known = new Set(Array.isArray(own) ? own.map(String) : (card.recipients ?? []).map(recipientKey));
  const strangers = (draft?.recipients ?? []).filter((person) => !known.has(recipientKey(person)));
  return strangers.length > 0 ? `The people on this have changed since the card was made: ${strangers.map((p) => p.name).join(', ')} would also get it. Nothing was sent. Please ask again.` : null;
}

async function applyRow(actx: ActionContext, row: AskChangesetRowRow, card: AskChangesetRow): Promise<{ patch: Parameters<typeof updateAskChangesetRows>[2][number]['patch'] }> {
  const failed = (error: string) => ({ patch: { status: 'failed', error } });
  const action = await loadAction(row, card.tier);
  if (!action) return failed('This action is switched off.');
  if (!action.roles.includes(actx.auth.role)) return failed('This is not yours to do.');
  const parsed = action.input.safeParse(inputOf(row));
  if (!parsed.success) return failed('This row no longer reads as a valid change.');
  try {
    if (action.recheck) {
      const checked = await action.recheck(actx, parsed.data, {});
      if (!checked.canApply) {
        return { patch: { status: 'held', checks: checked.checks, heldReason: checked.heldReason ?? checked.checks.find((c) => !c.ok)?.message ?? 'A check failed.' } };
      }
    }
    if (card.tier === 'T3') {
      const stranger = await strangerOnCard(action, actx, parsed.data, row, card);
      if (stranger) return failed(stranger);
    }
    const outcome = await action.execute(actx, parsed.data);
    if (outcome.ok === false) return failed(outcome.error);
    return { patch: { status: 'applied', error: null, heldReason: null, appliedAt: actx.now, undoData: outcome.undo ?? null } };
  } catch (error) {
    const refusal = refusalOf(error);
    if (refusal) return failed(refusal);
    console.error('[ask-vcfo] changeset row failed', safeError(error));
    return failed('This row could not be saved.');
  }
}

export async function rejectChangeset(ctx: AuthContext, id: string): Promise<void> {
  const now = new Date();
  const found = await loadOpen(ctx, id, now);
  const leftOpen = found.rows.filter((r) => OPEN_ROW.has(r.status));
  // Rejecting saves nothing, so the person who asked may withdraw every row; anyone else closes only the rows they could decide.
  const closing = leftOpen.filter((r) => found.owner || canDecideRow(found, r));
  if (closing.length === 0 && leftOpen.length > 0) throw new ChangesetRefused('This card is not yours to decide.', 403);
  await updateAskChangesetRows(ctx, found, closing.map((r) => ({ id: r.id, from: OPEN_ROWS, patch: { status: 'skipped' } })));
  const settled = closing.length === leftOpen.length;
  if (settled) await setAskChangesetStatus(ctx, found, found.rows.some((r) => r.status === 'applied') ? 'partly_applied' : 'rejected', { decidedAt: now });
  await announceDecision(found, settled);
}

/**
 * Puts back what the card saved, newest first, of the rows this person could decide. A value changed
 * since then is left as it is, and so is a row only somebody else could decide.
 */
export async function undoChangeset(ctx: AuthContext, id: string): Promise<{ undone: number; kept: string[] }> {
  const now = new Date();
  const found = await getAskChangesetForDecision(ctx, id);
  if (!found) throw new ChangesetRefused('This card is not available.', 404);
  const saved = found.rows.filter((row) => row.status === 'applied' && row.undoData != null);
  if (saved.length === 0) throw new ChangesetRefused('Nothing on this card has been saved.');
  const mine = saved.filter((row) => canDecideRow(found, row));
  if (mine.length === 0) throw new ChangesetRefused('Only the person who may approve these rows can undo them.', 403);
  const actx = actionContext(ctx, found, now);
  const kept: string[] = [];
  let undone = 0;
  for (const row of [...mine].reverse()) {
    const action = await getAction(row.action);
    const outcome = action?.undo ? await action.undo(actx, row.undoData) : { ok: false as const, error: 'This row cannot be undone.' };
    if (outcome.ok === true) {
      undone += 1;
      await updateAskChangesetRows(ctx, found, [{ id: row.id, from: ['applied'], patch: { status: 'undone' } }]);
    } else {
      kept.push(`${row.label}: ${outcome.error}`);
      await updateAskChangesetRows(ctx, found, [{ id: row.id, from: ['applied'], patch: { error: outcome.error } }]);
    }
  }
  if (kept.length === 0 && mine.length === saved.length) await setAskChangesetStatus(ctx, found, 'undone', { undoneAt: now });
  if (found.changeset.engagementId && undone > 0) {
    await recordAuditEvent(ctx, {
      engagementId: found.changeset.engagementId,
      action: 'ask.changeset.undone',
      summary: `Undid ${undone} value${undone === 1 ? '' : 's'} saved from an Ask VCFO card`,
      metadata: { via: 'ask', changesetId: id, runId: found.changeset.runId },
      result: 'ok',
    });
  }
  return { undone, kept };
}
