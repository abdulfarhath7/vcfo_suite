import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getActiveCatalogItems } from '@/data/checklist';
import { appendAskChangesetRows, type ChangesetAccess } from '@/db/repositories/ask-changesets';
import { checklistStateFromRow, getEngagementById } from '@/db/repositories/engagements';
import { addRequestListItem, createRequestList, listRequestLists, RequestListError, getRequestList } from '@/db/repositories/request-lists';
import { responseKey } from '@/lib/actions/checklist/rules';
import { getAction } from '@/lib/actions/registry';
import type { ChangesetRowDraft } from '@/lib/ask/changeset/types';
import { OPEN_ROW } from '@/lib/ask/changeset/apply';
import { isDirectFlowStep } from '@/lib/incorporation/pre-inc-direct-flow';
import type { CompletenessEngagement } from '@/lib/incorporation/step-completeness';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { requestsPageHref } from '@/lib/request-lists/model';
import { askClientItems, fillGaps, type GapField } from './gaps';
import { isFillRow } from './plan';
import type { FillLadder, FillScope } from './types';

/**
 * The gaps ladder of a "fill everything" run, before its steps are filled (`gaps.ts` decides; this
 * file reads and writes through the repositories as the person). Suggested answers become rows on
 * the same card, marked "(suggested)" with the reason as their source, so the fill saves them as
 * drafts and Undo still works. What only the client knows goes onto one draft request list, which
 * the fill never sends. Never throws: a ladder that fails leaves the fill to fill the card as it is.
 */

/** The one draft list a fill adds to, so asking again does not make a second list. */
export const ASK_CLIENT_LIST_TITLE = 'Incorporation details (Ask client)';

/** The steps a whole fill looks at: every direct-flow incorporation step, or the request's scope. */
export function ladderSteps(scope: FillScope | null | undefined): string[] {
  const all = getActiveCatalogItems()
    .filter((item) => (item.bucket === 'pre-inc' || item.bucket === 'post-inc') && isDirectFlowStep(item.id))
    .map((item) => item.id);
  return scope?.stepIds.length ? all.filter((id) => scope.stepIds.includes(id)) : all;
}

/** The card's values per step and key, from its open rows the rules let through. */
function cardValuesOf(rows: ChangesetAccess['rows']): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    if (!isFillRow(row) || !OPEN_ROW.has(row.status) || row.heldReason || !row.checks.every((c) => c.ok)) continue;
    const target = row.target as { stepId: string; fieldId: string; group?: string; entryId?: string };
    const value = typeof row.newValue === 'string' ? row.newValue : row.newValue == null ? '' : String(row.newValue);
    if (!value.trim()) continue;
    (out[target.stepId] ??= {})[responseKey(target)] = value;
  }
  return out;
}

async function suggestionRows(ctx: AuthContext, found: ChangesetAccess, gaps: readonly GapField[], now: Date): Promise<ChangesetRowDraft[]> {
  const action = await getAction('checklist.setResponse');
  if (!action) return [];
  const engagementId = found.changeset.engagementId!;
  const actx = { auth: ctx, engagementId, conversationId: found.changeset.conversationId, runId: found.changeset.runId, now, via: 'ask' as const };
  const out: ChangesetRowDraft[] = [];
  for (const gap of gaps) {
    if (gap.rung !== 'suggested' || !gap.suggestion) continue;
    const parsed = action.input.safeParse({ engagementId, stepId: gap.stepId, fieldId: gap.suggestion.fieldId, value: gap.suggestion.value });
    if (!parsed.success) continue;
    const draft = await action.preview(actx, parsed.data).catch(() => null);
    const row = draft?.rows[0];
    if (!row) continue;
    out.push({ ...row, label: `${row.label} (suggested)`, source: { kind: 'record', quote: gap.suggestion.why } });
  }
  return out;
}

async function askClientList(ctx: AuthContext, engagementId: string, gaps: readonly GapField[]): Promise<FillLadder['requestList']> {
  const items = askClientItems(gaps);
  if (items.length === 0) return undefined;
  const href = (id: string) => `${requestsPageHref(ctx.role)}?list=${encodeURIComponent(id)}`;
  try {
    const drafts = await listRequestLists(ctx, { engagementId, status: ['draft'] });
    const open = drafts.find((list) => list.title === ASK_CLIENT_LIST_TITLE);
    if (open) {
      const detail = await getRequestList(ctx, open.id);
      const known = new Set((detail?.items ?? []).map((item) => item.label));
      for (const item of items) if (!known.has(item.label)) await addRequestListItem(ctx, open.id, item);
      return { id: open.id, href: href(open.id), items: items.length };
    }
    const list = await createRequestList(ctx, { engagementId, title: ASK_CLIENT_LIST_TITLE, templateId: null, cadenceDays: 3, items });
    return { id: list.id, href: href(list.id), items: items.length };
  } catch (error) {
    if (!(error instanceof RequestListError)) console.error('[ask-vcfo] ask-client list not drafted', error instanceof Error ? error.message : error);
    return undefined;
  }
}

/**
 * Runs the ladder on a card before a whole fill. Returns what it did, with labels only, and whether
 * it added rows to the card (the caller then reads the card again).
 */
export async function prepareFillEverything(
  ctx: AuthContext,
  found: ChangesetAccess,
  input: { scope?: FillScope | null; now: Date },
): Promise<{ ladder: FillLadder; addedRows: boolean }> {
  const empty: FillLadder = { suggested: [], askClient: [], left: [] };
  try {
    const engagementId = found.changeset.engagementId;
    if (!engagementId || ctx.role === 'client') return { ladder: empty, addedRows: false };
    const row = await getEngagementById(ctx, engagementDbId(engagementId));
    if (!row) return { ladder: empty, addedRows: false };
    const gaps = fillGaps({
      stepIds: ladderSteps(input.scope),
      state: checklistStateFromRow(row),
      engagement: row as CompletenessEngagement,
      cardValues: cardValuesOf(found.rows),
    });
    const rows = await suggestionRows(ctx, found, gaps, input.now);
    const added = rows.length > 0 ? await appendAskChangesetRows(ctx, found.changeset.id, rows, input.now) : false;
    const suggestedKeys = new Set(rows.map((r) => `${String(r.target.stepId)}/${String(r.target.fieldId)}`));
    const requestList = await askClientList(ctx, engagementId, gaps);
    const ladder: FillLadder = {
      suggested: added ? gaps.filter((g) => g.rung === 'suggested' && suggestedKeys.has(`${g.stepId}/${g.suggestion!.fieldId}`)).map(({ stepId, label }) => ({ stepId, label })) : [],
      askClient: gaps.filter((g) => g.rung === 'ask_client').map(({ stepId, label }) => ({ stepId, label })),
      left: gaps.filter((g) => g.rung === 'left').map(({ stepId, label, reason }) => ({ stepId, label, reason: reason ?? '' })),
      ...(requestList ? { requestList } : {}),
    };
    return { ladder, addedRows: added };
  } catch (error) {
    console.error('[ask-vcfo] fill ladder failed', error instanceof Error ? error.message : error);
    return { ladder: empty, addedRows: false };
  }
}
