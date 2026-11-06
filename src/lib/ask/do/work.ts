import 'server-only';

import type { AuthContext } from '@/auth/guards';
import type { AnswerEnvelope, AskShell } from '@/data/ask/schema';
import { appendAskRunStep, createAskRun, lockAskRun, setAskRunAnswer, updateAskRun, type AskRunRow } from '@/db/repositories/ask-runs';
import { getAction } from '@/lib/actions/registry';
import { refusalOf } from '@/lib/actions/shared';
import { needsApproval, type ActionContext } from '@/lib/actions/types';
import type { JsonValue } from '@/lib/ask/changeset/types';
import { ASK_RUN_START } from '@/lib/ask/agent/events';
import { firstAgentMessage } from '@/lib/ask/agent/loop';
import { actionsFor } from '@/lib/ask/agent/tools';
import { askBudgets, askConfig, askFlags } from '@/lib/ask/config';
import { lockEngagement, type LockableEngagement } from '@/lib/ask/data-router/lock';
import { maskIdentityNumbers, safeError } from '@/lib/ask/mask';
import type { LlmProvider } from '@/lib/ask/provider';
import { limitAnswer } from '@/lib/ask/refusals';
import { inngest } from '@/jobs/client';
import { createReviewCard } from './card';
import { pickWork, type WorkPick } from './pick';

/**
 * Work asked for in words. A request one action can settle gets a card at once, and only open-ended
 * work starts an agent run. Either way the run is locked to one client first, by code, and asks when
 * two match. Firm-wide work, which sits on no project, skips the lock and sees only firm-wide actions.
 * A question asked here is held in a run row with the choice already made, so the reply costs no second
 * model call.
 */

export interface WorkState {
  mode: 'work';
  pick: WorkPick;
  instruction: string;
  attachmentIds: string[];
  options: LockableEngagement[];
  mismatch: null;
}

export type WorkOutcome =
  | { kind: 'data' }
  | { kind: 'none' }
  | { kind: 'answer'; answer: AnswerEnvelope; path: 'fixed_workflow' | 'agent_run'; start?: (messageId: string | null) => Promise<void> };

const line = (text: string, extra: Partial<AnswerEnvelope> = {}): AnswerEnvelope => ({
  line: text.slice(0, 1200),
  citations: [],
  actions: [],
  origin: 'work',
  depth: 'normal',
  ...extra,
});

const answerOf = (answer: AnswerEnvelope, path: 'fixed_workflow' | 'agent_run' = 'fixed_workflow'): WorkOutcome => ({ kind: 'answer', answer, path });

export async function handleWork(
  ctx: AuthContext,
  request: { shell: AskShell; page?: { path: string } },
  input: {
    message: string;
    onScreen: string | null;
    conversationId: string | null;
    now: Date;
    engagements: () => Promise<readonly LockableEngagement[]>;
    provider: () => Promise<LlmProvider>;
    /** A reply to this flow's own question: the choice made then, and the client just named. */
    resumed?: { run: AskRunRow; pick: WorkPick; engagement: LockableEngagement };
  },
): Promise<WorkOutcome> {
  const { message, conversationId, now, resumed } = input;
  const budgets = askBudgets();
  const actions = await actionsFor(ctx.role, request.shell);
  const pick = resumed
    ? resumed.pick
    : (await pickWork(await input.provider(), askConfig().models.extract, { message, onScreen: input.onScreen, simple: actions.filter((action) => action.simple), receivables: actions.some((action) => action.firmWide), handoff: actions.some((action) => action.name === 'filing.prepareRun'), now })).pick;
  if (pick.kind === 'none') return { kind: 'none' };
  if (pick.kind === 'cut') return answerOf(line('That is more than I can take in one go. Please send it in smaller parts.'));
  if (pick.kind === 'data') return { kind: 'data' };
  if (pick.kind === 'agent' && askFlags().killedPaths.has('agent_run')) return answerOf(limitAnswer(request.shell, 'pathStopped'));

  const workflow = pick.kind === 'action' ? pick.action : 'agent';
  const action = pick.kind === 'action' ? actions.find((candidate) => candidate.name === pick.action) : undefined;
  const firmWide = pick.kind === 'agent' ? pick.firmWide === true : action?.firmWide === true;
  const engagements = resumed || firmWide ? [] : await input.engagements();
  const lock = firmWide
    ? null
    : resumed
      ? ({ kind: 'locked', engagement: resumed.engagement } as const)
      : lockEngagement({ message, pagePath: request.page?.path, engagements, ownCompany: request.shell === 'client' });
  if (lock?.kind === 'unknown' && lock.mentioned) return answerOf(line(`I cannot find ${maskIdentityNumbers(lock.mentioned)} among your projects, so I have done nothing.`));
  if (lock && lock.kind !== 'locked') {
    const options = lock.kind === 'choose' ? lock.options : engagements;
    const run = await createAskRun(ctx, { conversationId, workflow, goal: message, budgetTokens: budgets.runMaxTokens, kind: pick.kind === 'agent' ? 'agent' : undefined });
    const state: WorkState = { mode: 'work', pick, instruction: message, attachmentIds: [], options: options.map(({ id, slug, companyName }) => ({ id, slug, companyName })), mismatch: null };
    await updateAskRun(ctx, run.id, { status: 'waiting_reply', state: state as unknown as JsonValue });
    const question = lock.kind === 'choose' ? `More than one project matches: ${options.map((o) => o.companyName).join(' and ')}. Which one is this for?` : 'Which project is this for?';
    return answerOf(line(question, { runId: run.id }));
  }
  const engagement = lock?.kind === 'locked' ? lock.engagement : null;
  const forWhom = engagement ? ` for ${engagement.companyName}` : '';

  if (pick.kind === 'agent') {
    const run = resumed?.run ?? (await createAskRun(ctx, { conversationId, workflow, goal: message, budgetTokens: budgets.runMaxTokens, kind: 'agent' }));
    if (engagement) await lockAskRun(ctx, run.id, engagement.id);
    const state = firstAgentMessage({ companyName: engagement?.companyName ?? null, person: ctx.name, role: ctx.role, goal: message, now });
    await updateAskRun(ctx, run.id, { status: 'queued', state: state as unknown as JsonValue });
    return {
      kind: 'answer',
      path: 'agent_run',
      answer: line(`Working on this${forWhom}. Nothing is saved or sent until you accept it.`, { runId: run.id, runLive: true }),
      start: async (messageId) => {
        await updateAskRun(ctx, run.id, { messageId });
        try {
          await inngest.send({ name: ASK_RUN_START, data: { runId: run.id } });
        } catch (error) {
          console.error('[ask-vcfo] run did not start', safeError(error));
          const stopped = 'This could not start just now. Nothing was saved. Please try again in a little while.';
          await setAskRunAnswer(ctx, { id: run.id, profileId: ctx.userId, messageId }, stopped);
          await updateAskRun(ctx, run.id, { status: 'failed', error: 'job not started', finishedAt: new Date() });
        }
      },
    };
  }

  // One action, chosen from what this role may use. It only ever becomes a card here.
  if (!action || !needsApproval(action.tier)) return { kind: 'none' };
  const parsed = action.input.safeParse(pick.input);
  if (!parsed.success) return answerOf(line('I could not read all the details in that. Please say it once more with the name and the date.'));

  const run = resumed?.run ?? (await createAskRun(ctx, { conversationId, workflow, goal: message, budgetTokens: budgets.runMaxTokens }));
  const close = async (status: string) => updateAskRun(ctx, run.id, { status, ...(status === 'waiting_approval' ? {} : { finishedAt: new Date() }) });
  if (engagement) await lockAskRun(ctx, run.id, engagement.id);
  const actx: ActionContext = { auth: ctx, engagementId: engagement?.id ?? null, conversationId, runId: run.id, now, via: 'ask' };
  try {
    const draft = await action.preview(actx, parsed.data);
    if (!draft) return { kind: 'none' };
    const changesetId = await createReviewCard(ctx, draft, { runId: run.id, conversationId, companyName: engagement?.companyName ?? '', now });
    if (!changesetId) {
      await close('failed');
      return answerOf(line('That project is not available.', { runId: run.id }));
    }
    await close('waiting_approval');
    const hold = draft.tier === 'T3' ? 'Nothing goes out until you confirm.' : 'Nothing is saved until you accept.';
    return answerOf(line(`I prepared this${forWhom}. ${hold}`, { changesetId, runId: run.id }));
  } catch (error) {
    const refusal = refusalOf(error);
    if (!refusal) throw error;
    await appendAskRunStep(ctx, run.id, { kind: 'tool', name: action.name, status: 'failed', output: { error: refusal } });
    await close('failed');
    return answerOf(line(refusal, { runId: run.id }));
  }
}
