import 'server-only';

import { and, asc, desc, eq, gt, max } from 'drizzle-orm';
import type { AuthContext } from '@/auth/guards';
import { db } from '@/db/client';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { askMessages, profiles } from '@/db/schema';
import { askRuns, askRunSteps } from '@/db/schema-ask';
import { AskForbiddenError, assertAskRole, canUseAsk } from '@/lib/ask/access';
import type { JsonValue } from '@/lib/ask/changeset/types';
import { maskIdentityNumbers } from '@/lib/ask/mask';

/**
 * Traces of fixed workflows and agent runs. Every run acts as the person who started it, and only
 * that person reads it: `profile_id = ctx.userId` is in every query. The goal and every step pass
 * through the mask, so a stored trace holds no identity number. `system*` helpers serve the job that
 * carries a run on after the page closes; it starts from a run id and no person is signed in there.
 */
export type AskRunRow = typeof askRuns.$inferSelect;
export type AskRunStepRow = typeof askRunSteps.$inferSelect;

/** Masks every string. A thinking block goes back to the API exactly as it came, or the API refuses it. */
function maskValue(value: JsonValue): JsonValue {
  if (typeof value === 'string') return maskIdentityNumbers(value);
  if (Array.isArray(value)) return value.map(maskValue);
  if (value === null || typeof value !== 'object') return value;
  if (value.type === 'thinking' || value.type === 'redacted_thinking') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, maskValue(item)]));
}

function maskJson(value: JsonValue | undefined): JsonValue | undefined {
  return value === undefined ? undefined : maskValue(value);
}

export async function createAskRun(
  ctx: AuthContext,
  input: { conversationId: string | null; workflow: string; goal: string; budgetTokens: number; kind?: 'fixed_workflow' | 'agent'; trigger?: 'chat' | 'schedule' },
): Promise<AskRunRow> {
  assertAskRole(ctx);
  const [row] = await db
    .insert(askRuns)
    .values({
      profileId: ctx.userId,
      conversationId: input.conversationId,
      kind: input.kind ?? 'fixed_workflow',
      workflow: input.workflow,
      trigger: input.trigger ?? 'chat',
      status: input.kind === 'agent' ? 'queued' : 'running',
      goal: maskIdentityNumbers(input.goal).slice(0, 2000),
      budgetTokens: input.budgetTokens,
      startedAt: new Date(),
    })
    .returning();
  return row!;
}

/** Locks a run to one engagement, after a repository call confirms the person can reach it. */
export async function lockAskRun(ctx: AuthContext, runId: string, engagementId: string): Promise<boolean> {
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) throw new AskForbiddenError('That project is not available.');
  const rows = await db
    .update(askRuns)
    .set({ engagementId: access.dbId })
    .where(and(eq(askRuns.id, runId), eq(askRuns.profileId, ctx.userId)))
    .returning({ id: askRuns.id });
  return rows.length > 0;
}

export async function updateAskRun(
  ctx: AuthContext,
  runId: string,
  patch: Partial<Pick<AskRunRow, 'status' | 'error' | 'model' | 'messageId' | 'turns' | 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'finishedAt'>> & { state?: JsonValue },
): Promise<void> {
  const { state, ...rest } = patch;
  await db
    .update(askRuns)
    .set({ ...rest, ...(state !== undefined ? { state: maskJson(state) } : {}) })
    .where(and(eq(askRuns.id, runId), eq(askRuns.profileId, ctx.userId)));
}

const WAITING_HOURS = 24;

/** A question the chat asked this person in this conversation, still open. */
export async function findWaitingAskRun(ctx: AuthContext, conversationId: string, now: Date): Promise<AskRunRow | null> {
  assertAskRole(ctx);
  const [row] = await db
    .select()
    .from(askRuns)
    .where(
      and(
        eq(askRuns.profileId, ctx.userId),
        eq(askRuns.conversationId, conversationId),
        eq(askRuns.status, 'waiting_reply'),
        gt(askRuns.createdAt, new Date(now.getTime() - WAITING_HOURS * 3_600_000)),
      ),
    )
    .orderBy(desc(askRuns.createdAt))
    .limit(1);
  return row ?? null;
}

export async function appendAskRunStep(
  ctx: AuthContext,
  runId: string,
  step: {
    kind: 'model' | 'tool' | 'check' | 'approval';
    name: string;
    label?: string;
    tier?: string;
    status?: string;
    input?: JsonValue;
    output?: JsonValue;
    changesetId?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
  },
): Promise<void> {
  const [own] = await db
    .select({ id: askRuns.id, last: max(askRunSteps.ordinal) })
    .from(askRuns)
    .leftJoin(askRunSteps, eq(askRunSteps.runId, askRuns.id))
    .where(and(eq(askRuns.id, runId), eq(askRuns.profileId, ctx.userId)))
    .groupBy(askRuns.id);
  if (!own) return;
  await db.insert(askRunSteps).values({
    runId,
    ordinal: (own.last ?? -1) + 1,
    kind: step.kind,
    name: step.name,
    label: step.label,
    tier: step.tier,
    status: step.status ?? 'done',
    input: maskJson(step.input),
    output: maskJson(step.output),
    changesetId: step.changesetId,
    model: step.model,
    inputTokens: step.inputTokens,
    outputTokens: step.outputTokens,
    latencyMs: step.latencyMs,
  });
}

export async function getOwnAskRun(ctx: AuthContext, runId: string): Promise<{ run: AskRunRow; steps: AskRunStepRow[]; line: string | null } | null> {
  assertAskRole(ctx);
  const [found] = await db
    .select({ run: askRuns, line: askMessages.text })
    .from(askRuns)
    .leftJoin(askMessages, eq(askMessages.id, askRuns.messageId))
    .where(and(eq(askRuns.id, runId), eq(askRuns.profileId, ctx.userId)))
    .limit(1);
  if (!found) return null;
  const steps = await db.select().from(askRunSteps).where(eq(askRunSteps.runId, runId)).orderBy(asc(askRunSteps.ordinal));
  return { run: found.run, steps, line: found.line };
}

export async function setOwnAskRunStepStatus(ctx: AuthContext, runId: string, stepId: string, status: string): Promise<void> {
  const own = await getOwnAskRun(ctx, runId);
  if (!own) return;
  await db.update(askRunSteps).set({ status }).where(and(eq(askRunSteps.id, stepId), eq(askRunSteps.runId, runId)));
}

/** The run's last word replaces the "working on it" line, so a reopened conversation reads right. */
export async function setAskRunAnswer(ctx: AuthContext, run: Pick<AskRunRow, 'id' | 'profileId' | 'messageId'>, line: string): Promise<void> {
  if (run.profileId !== ctx.userId || !run.messageId) return;
  const text = maskIdentityNumbers(line);
  const [message] = await db.select({ answer: askMessages.answer }).from(askMessages).where(eq(askMessages.id, run.messageId)).limit(1);
  if (!message) return;
  await db
    .update(askMessages)
    .set({ text, answer: { ...(message.answer as object), line: text } })
    .where(eq(askMessages.id, run.messageId));
}

const PERSON = { id: profiles.id, email: profiles.email, name: profiles.name, role: profiles.role, internId: profiles.internId, clientId: profiles.clientId, status: profiles.status };

type PersonRow = { id: string; email: string; name: string | null; role: string; internId: string | null; clientId: string | null; status: string };

/** Today's role, or null for a person who was removed or who has lost Ask VCFO. */
function contextOf(person: PersonRow | undefined): AuthContext | null {
  if (!person || person.status !== 'active' || !canUseAsk(person.role)) return null;
  return { userId: person.id, email: person.email, name: person.name?.trim() || person.email, role: person.role as AuthContext['role'], internId: person.internId ?? undefined, clientId: person.clientId ?? undefined };
}

/** The run and its person as they stand now, so a job acts with today's role and a run can stop if they have gone. */
export async function systemLoadAskRun(runId: string): Promise<{ run: AskRunRow; ctx: AuthContext } | null> {
  const [found] = await db.select({ run: askRuns, ...PERSON }).from(askRuns).innerJoin(profiles, eq(profiles.id, askRuns.profileId)).where(eq(askRuns.id, runId)).limit(1);
  const ctx = contextOf(found);
  return found && ctx ? { run: found.run, ctx } : null;
}

/** The person a scheduled run acts as, read the same way. */
export async function systemLoadAskOwner(profileId: string): Promise<AuthContext | null> {
  const [found] = await db.select(PERSON).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  return contextOf(found);
}

export async function systemStopAskRun(runId: string, error: string): Promise<void> {
  await db.update(askRuns).set({ status: 'failed', error, finishedAt: new Date() }).where(eq(askRuns.id, runId));
}

/**
 * A card behind this run was decided. A fixed workflow ends there, as nothing else comes after its
 * card, and the kind tells the caller whether an agent run is sleeping on the decision.
 */
export async function systemNoteAskRunDecision(runId: string, settled: boolean): Promise<AskRunRow['kind'] | null> {
  const [run] = await db.select({ kind: askRuns.kind, status: askRuns.status }).from(askRuns).where(eq(askRuns.id, runId)).limit(1);
  if (!run) return null;
  if (settled && run.kind === 'fixed_workflow' && run.status === 'waiting_approval') {
    await db.update(askRuns).set({ status: 'done', finishedAt: new Date() }).where(eq(askRuns.id, runId));
  }
  return run.kind;
}
