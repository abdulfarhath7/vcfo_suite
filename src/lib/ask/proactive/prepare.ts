import 'server-only';

import { listOwnScheduledRows } from '@/db/repositories/ask-changesets';
import type { ProactiveOwner } from '@/db/repositories/ask-proactive';
import { appendAskRunStep, createAskRun, lockAskRun, systemLoadAskOwner, updateAskRun } from '@/db/repositories/ask-runs';
import { systemTodayTokenTotal } from '@/db/repositories/ask-usage';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { actionsForRole } from '@/lib/actions/registry';
import { refusalOf } from '@/lib/actions/shared';
import { needsApproval, type ActionContext, type AnyAction } from '@/lib/actions/types';
import type { AuthContext } from '@/auth/guards';
import { changesetHash } from '@/lib/ask/changeset/hash';
import type { ChangesetDraft, JsonValue } from '@/lib/ask/changeset/types';
import { askBudgets, askConfig, askFlags } from '@/lib/ask/config';
import { createReviewCard, oneCard } from '@/lib/ask/do/card';
import { roleAnnouncementsPath } from '@/lib/notifications/announcements';
import { firmWideProposals, proposalsForEngagement, type Proposal } from './proposals';

/**
 * The overnight job's work for one owner. It acts as that person and leaves only review cards: it can
 * call an action's `preview`, which never writes, and nothing here can call `execute`, accept a card or
 * apply a row. T0, T1 and T4 actions are not even looked up. The same flag, kill switches and daily
 * budget as a chat request stop it, and it spends no tokens of its own.
 */
const CARDS_PER_OWNER = 10;
const ROWS_PER_CARD = 10;
/** A card lives seven days; after this a thing still open may be proposed once more. */
const QUIET_DAYS = 14;

export type ProactiveResult = { cards: number; rows: number } | { stopped: string };

export async function proactiveStop(now: Date): Promise<string | null> {
  const flags = askFlags();
  if (!askConfig().enabled || !flags.proactive) return 'off';
  if (flags.killedPaths.has('fixed_workflow') || flags.killedTiers.has('T2')) return 'switched off';
  if ((await systemTodayTokenTotal(now)) >= askBudgets().dailyTokens) return 'daily budget';
  return null;
}

async function proposable(ctx: AuthContext): Promise<ReadonlyMap<string, AnyAction>> {
  const killed = askFlags().killedTiers;
  const actions = (await actionsForRole(ctx.role)).filter((action) => needsApproval(action.tier) && !killed.has(action.tier) && action.available?.() !== false);
  return new Map(actions.map((action) => [action.name, action]));
}

const seenKey = (row: { action: string; target: JsonValue }) => changesetHash([{ ...row, newValue: null }]);

/** One draft per proposal the action itself accepts. A refusal only means there is nothing to propose. */
async function draftsFor(actx: ActionContext, proposals: readonly Proposal[], actions: ReadonlyMap<string, AnyAction>, seen: Set<string>): Promise<ChangesetDraft[]> {
  const drafts: ChangesetDraft[] = [];
  for (const { action: name, input, firstLook } of proposals) {
    const action = actions.get(name);
    const parsed = action?.input.safeParse(input);
    if (!action || !parsed?.success) continue;
    try {
      const draft = await action.preview(actx, parsed.data);
      if (!draft || draft.rows.some((row) => seen.has(seenKey(row)))) continue;
      draft.rows.forEach((row) => seen.add(seenKey(row)));
      drafts.push(firstLook ? { ...draft, rows: draft.rows.map((row) => ({ ...row, checks: [...row.checks, { rule: 'open_first', ok: false, message: firstLook }] })) } : draft);
    } catch (error) {
      if (!refusalOf(error)) throw error;
    }
  }
  return drafts;
}

async function putOnCard(ctx: AuthContext, drafts: readonly ChangesetDraft[], scope: { id: string; companyName: string } | null, now: Date): Promise<string | null> {
  const run = await createAskRun(ctx, {
    conversationId: null,
    workflow: 'proactive',
    goal: `Overnight proposals${scope ? ` for ${scope.companyName}` : ''}`,
    budgetTokens: askBudgets().runMaxTokens,
    trigger: 'schedule',
  });
  if (scope) await lockAskRun(ctx, run.id, scope.id);
  await appendAskRunStep(ctx, run.id, { kind: 'check', name: 'proposals', output: { found: drafts.length } });
  const changesetId = await createReviewCard(ctx, oneCard(drafts, null), { runId: run.id, conversationId: null, companyName: scope?.companyName ?? '', now });
  await updateAskRun(ctx, run.id, changesetId ? { status: 'waiting_approval' } : { status: 'failed', error: 'card refused', finishedAt: new Date() });
  return changesetId;
}

export async function prepareForOwner(owner: ProactiveOwner, now: Date): Promise<ProactiveResult> {
  const stopped = await proactiveStop(now);
  if (stopped) return { stopped };
  const ctx = await systemLoadAskOwner(owner.ownerId);
  if (!ctx) return { stopped: 'owner not active' };

  const actions = await proposable(ctx);
  const earlier = await listOwnScheduledRows(ctx, new Date(now.getTime() - QUIET_DAYS * 86_400_000));
  const seen = new Set(earlier.map((row) => seenKey({ action: row.action, target: row.target })));
  const cards: string[] = [];
  const named: string[] = [];
  let rows = 0;

  for (const scope of [...owner.engagements, null]) {
    if (cards.length >= CARDS_PER_OWNER) break;
    try {
      const actx: ActionContext = { auth: ctx, engagementId: scope?.id ?? null, conversationId: null, runId: null, now, via: 'ask' };
      const proposals = scope ? await proposalsForEngagement(ctx, scope.id, now, ROWS_PER_CARD) : await firmWideProposals(ctx, ROWS_PER_CARD);
      const drafts = await draftsFor(actx, proposals, actions, seen);
      if (drafts.length === 0) continue;
      const changesetId = await putOnCard(ctx, drafts, scope, now);
      if (!changesetId) continue;
      cards.push(changesetId);
      if (scope) named.push(scope.companyName);
      rows += drafts.flatMap((draft) => draft.rows).length;
    } catch (error) {
      // One project's fault must not cost the owner's other projects their proposals.
      console.error('[ask-vcfo] overnight proposals failed for one project', error);
    }
  }

  if (cards.length > 0) {
    await createNotificationsForUsers([
      {
        userId: ctx.userId,
        kind: 'ask.proposal',
        title: `${rows} proposal${rows === 1 ? '' : 's'} to review`,
        body: `Prepared overnight${named.length > 0 ? ` for ${named.join(', ')}` : ''}. Nothing is saved or sent until you accept.`.slice(0, 400),
        engagementId: '',
        companyName: '',
        href: `${roleAnnouncementsPath(ctx.role as Parameters<typeof roleAnnouncementsPath>[0]).replace(/announcements$/, 'ask')}?${cards.map((id) => `changeset=${id}`).join('&')}`,
      },
    ]).catch((error) => console.error('[ask-vcfo] overnight notice failed', error));
  }
  return { cards: cards.length, rows };
}
