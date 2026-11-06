import 'server-only';

import { randomUUID } from 'node:crypto';
import type { AuthContext } from '@/auth/guards';
import type { AnswerEnvelope, AskShell } from '@/data/ask/schema';
import { getOwnAskAttachments, createAskAttachment, updateOwnAskAttachment, type AskAttachmentRow } from '@/db/repositories/ask-attachments';
import { checklistStateFromRow, getEngagementBySlug, getEngagementById, listEngagements } from '@/db/repositories/engagements';
import { appendAskRunStep, createAskRun, findWaitingAskRun, lockAskRun, updateAskRun, type AskRunRow } from '@/db/repositories/ask-runs';
import { systemTodayTokenTotal } from '@/db/repositories/ask-usage';
import { checklist } from '@/data/checklist';
import type { JsonValue } from '@/lib/ask/changeset/types';
import { askBudgets, askConfig, askFlags } from '@/lib/ask/config';
import { catalogSynonyms } from '@/lib/ask/data-router/candidates';
import { companiesNamed, documentMatches, lockEngagement } from '@/lib/ask/data-router/lock';
import { placeValues, type SourceRead } from '@/lib/ask/data-router/place';
import { planRows } from '@/lib/ask/data-router/plan';
import { instructionOf, looksLikeData, readFile, readPaste, REFUSED_ID_DOC, ReadRefused } from '@/lib/ask/data-router/read';
import type { ReadResult } from '@/lib/ask/data-router/types';
import { matchClientFiles } from '@/lib/actions/client-portal/file-card';
import { normalizeLabel } from '@/lib/ask/field-catalog/rules';
import { maskIdentityNumbers, safeError } from '@/lib/ask/mask';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { addLlmUsage, getAskProvider, NO_LLM_USAGE } from '@/lib/ask/provider';
import { meterProvider, type MeteredProvider } from '@/lib/ask/provider/meter';
import { checkAskRateLimit } from '@/lib/ask/rate-limit';
import { limitAnswer, REFUSAL_COPY } from '@/lib/ask/refusals';
import { getObjectBuffer, putObject } from '@/storage/s3';
import { createReviewCard } from './card';
import { handleWork, type WorkState } from './work';

/**
 * The Do engine's way in. A file, a labelled paste or a message of facts goes to the data router:
 * read it, find the place for each value, run the screen's rules, and put a review card in the chat.
 * Each step is code except the two small-model calls, which return strict schemas and can touch
 * nothing. Work asked for in words goes to `handleWork`, which uses the same card and starts an agent
 * run only for open-ended work. A question either one cannot settle is asked in the chat and held in
 * a run row, so the next message can finish it.
 */

export type DoEvent = { type: 'progress'; runId: string; label: string } | { type: 'run'; runId: string; status: string };

export interface DoWorkResult {
  answer: AnswerEnvelope;
  metered: MeteredProvider | null;
  path?: 'fixed_workflow' | 'agent_run';
  /** Runs once the answer is stored, so a run can point back at its message. */
  start?: (messageId: string | null) => Promise<void>;
}

export interface DoWorkRequest {
  shell: AskShell;
  attachmentIds?: string[];
  page?: { path: string; engagementId?: string };
}

type EngagementOption = { id: string; slug: string | null; companyName: string };

interface PendingState {
  mode?: undefined;
  attachmentIds: string[];
  instruction: string;
  options: EngagementOption[];
  /** The project a document seems not to belong to, waiting for a yes. */
  mismatch: { engagementId: string; company: string } | null;
}

const MIN_SYNONYM_LENGTH = 4;
export const STORED_USER_TEXT_MAX = 1_000;

const line = (text: string, extra: Partial<AnswerEnvelope> = {}): AnswerEnvelope => ({
  line: text.slice(0, 1200),
  citations: [],
  actions: [],
  origin: 'work',
  depth: 'normal',
  ...extra,
});

/** A message worth a look by the router: a labelled line, or a long paste. */
export function isDataMessage(message: string): boolean {
  return message.length > 2000 || looksLikeData(message);
}

/** A message the router sent as work, which still has to name a fact or a number to be data. */
function mayHoldValues(message: string): boolean {
  if (/\d/.test(message)) return true;
  const text = ` ${normalizeLabel(message)} `;
  for (const synonym of catalogSynonyms()) {
    if (synonym.length >= MIN_SYNONYM_LENGTH && text.includes(` ${synonym} `)) return true;
  }
  return false;
}

/** What the model read from a file, kept beside it, so that answering a question does not pay to read it again. */
const readKey = (s3Key: string): string => `${s3Key}.read.json`;

async function keepRead(s3Key: string, result: ReadResult): Promise<void> {
  if (!result.usedModel) return;
  await putObject(readKey(s3Key), JSON.stringify(result), 'application/json').catch((error) => console.warn('[ask-vcfo] read not kept', safeError(error)));
}

async function keptRead(s3Key: string): Promise<ReadResult | null> {
  try {
    const kept = await getObjectBuffer(readKey(s3Key));
    return kept ? (JSON.parse(kept.toString('utf8')) as ReadResult) : null;
  } catch (error) {
    console.warn('[ask-vcfo] kept read not used', safeError(error));
    return null;
  }
}

const moreThanOne = (options: ReadonlyArray<{ companyName: string }>): string => `More than one project matches: ${options.map((o) => o.companyName).join(' and ')}. Which one is this for?`;

const CANCEL = /^\s*(?:no|nope|cancel|stop|leave it|never ?mind|don'?t)\b/i;
const CONFIRM = /^\s*(?:yes|yep|yeah|ok|okay|sure|confirm|go ahead|file it|correct|right)\b/i;

/** The open question this message answers, if it answers one; otherwise the normal chat runs. */
export async function pendingDoRun(ctx: AuthContext, conversationId: string | null, message: string | undefined, now: Date) {
  if (!conversationId || !message) return null;
  const run = await findWaitingAskRun(ctx, conversationId, now);
  if (!run) return null;
  const state = run.state as unknown as PendingState | WorkState;
  const named = companiesNamed(message, state.options);
  if (CANCEL.test(message) || CONFIRM.test(message) || named.length > 0) return { run, state };
  return null;
}

/** A short line about the record on screen, so "this client" means something to the router. */
export async function pageContextLine(ctx: AuthContext, page: DoWorkRequest['page']): Promise<string | null> {
  const match = page?.path ? /\/(?:projects|engagements|clients)\/([^/?#]+)(?:\/step\/([^/?#]+))?/.exec(page.path) : null;
  if (!match) return null;
  const key = decodeURIComponent(match[1]!);
  const row = (await getEngagementBySlug(ctx, key)) ?? (/^[0-9a-f-]{36}$/i.test(key) ? await getEngagementById(ctx, key) : null);
  if (!row) return null;
  const stepKey = match[2] ? decodeURIComponent(match[2]) : null;
  const step = stepKey ? checklist.find((item) => item.slug === stepKey || item.id === stepKey) : undefined;
  return `The person is looking at ${row.companyName}${step ? `, step "${step.title}"` : ''}.`;
}

export async function handleDoWork(
  ctx: AuthContext,
  request: DoWorkRequest,
  message: string,
  emit: (event: DoEvent) => void,
  context: {
    conversationId: string | null;
    now: Date;
    pending: Awaited<ReturnType<typeof pendingDoRun>>;
    metered?: MeteredProvider | null;
    /** Told as soon as a meter starts, so a failure partway through can still count what it spent. */
    onMeter?: (meter: MeteredProvider) => void;
    /** A client's own company, from the shell: every run in that shell is held to it. */
    lockedTo?: string | null;
  },
): Promise<DoWorkResult | null> {
  const { shell } = request;
  const client = shell === 'client';
  // A super admin previewing the client shell only reads; a client's run needs their own company.
  if (client && (ctx.role !== 'client' || !context.lockedTo)) return { answer: limitAnswer(shell, 'doWork'), metered: null };
  const flags = askFlags();
  if (flags.killedPaths.has('fixed_workflow') || flags.killedTiers.has('T2')) return { answer: limitAnswer(shell, 'pathStopped'), metered: null };
  const { conversationId, now } = context;
  const attachmentIds = request.attachmentIds ?? [];

  const config = askConfig();
  const budgets = askBudgets();
  let metered: MeteredProvider | null = context.metered ?? null;
  const provider = async () => {
    if (metered) return metered;
    if ((await systemTodayTokenTotal(now)) >= budgets.dailyTokens) throw new ReadRefused(REFUSAL_COPY.budgetReached);
    if (!(await checkAskRateLimit(ctx, config.rateLimit, now)).ok) throw new ReadRefused(REFUSAL_COPY.rateLimited);
    const configured = await getAskProvider();
    if (!configured) throw new ReadRefused('Reading this needs the Ask VCFO model, which is not available right now. Please type the details as "Label: value" lines.');
    metered = meterProvider(configured);
    context.onMeter?.(metered);
    return metered;
  };
  const deps = { provider, model: config.models.extract, idDocReading: flags.idDocReading };
  const reachable = async (): Promise<EngagementOption[]> =>
    (await listEngagements(ctx)).map((e) => ({ id: e.id, slug: e.slug, companyName: e.companyName })).filter((e) => !client || engagementDbId(e.id) === engagementDbId(context.lockedTo!));

  // Work asked for in words comes first; a message of facts carries on to the data router below.
  const waiting = context.pending;
  const workReply = waiting?.state.mode === 'work' ? { run: waiting.run, state: waiting.state as WorkState } : null;
  if (workReply || (!waiting && attachmentIds.length === 0 && !isDataMessage(message))) {
    if (workReply && CANCEL.test(message)) {
      await updateAskRun(ctx, workReply.run.id, { status: 'cancelled', finishedAt: new Date() });
      return { answer: line('All right, I have left this as it is. Nothing was saved.', { runId: workReply.run.id }), metered };
    }
    const matches = workReply ? companiesNamed(message, workReply.state.options) : [];
    if (workReply && matches.length !== 1) {
      const question = matches.length > 1 ? moreThanOne(matches) : 'Please tell me which project this is for.';
      return { answer: line(question, { runId: workReply.run.id }), metered };
    }
    const named = matches[0];
    const outcome = await handleWork(ctx, request, {
      message: workReply ? workReply.state.instruction : message,
      onScreen: await pageContextLine(ctx, request.page),
      conversationId,
      now,
      engagements: reachable,
      provider,
      resumed: workReply ? { run: workReply.run, pick: workReply.state.pick, engagement: named! } : undefined,
    });
    if (outcome.kind === 'answer') return { answer: outcome.answer, metered, path: outcome.path, start: outcome.start };
    // Prose that names no fact goes back to the plain line.
    if (outcome.kind === 'none' || !mayHoldValues(message)) return null;
  }
  const pending = waiting as { run: AskRunRow; state: PendingState } | null;

  const run = pending?.run ?? (await createAskRun(ctx, { conversationId, workflow: 'data_router', goal: instructionOf(message) || (attachmentIds.length > 0 ? `${attachmentIds.length} attached file(s)` : 'Pasted details'), budgetTokens: budgets.runMaxTokens }));
  const runId = run.id;
  emit({ type: 'run', runId, status: 'running' });
  const progress = (label: string) => emit({ type: 'progress', runId, label });

  const close = async (status: string, state?: PendingState, error?: string) => {
    const spend = metered?.spend() ?? [];
    const usage = spend.reduce((sum, s) => addLlmUsage(sum, s.usage), NO_LLM_USAGE);
    await updateAskRun(ctx, runId, {
      status,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      model: metered?.lastModel() ?? null,
      ...(state ? { state: state as unknown as JsonValue } : {}),
      ...(error ? { error } : {}),
      ...(status === 'waiting_reply' || status === 'waiting_approval' ? {} : { finishedAt: new Date() }),
    });
    emit({ type: 'run', runId, status });
  };
  const finish = async (answer: AnswerEnvelope, status = 'done', state?: PendingState, error?: string): Promise<DoWorkResult> => {
    await close(status, state, error);
    return { answer: { ...answer, runId }, metered };
  };

  if (pending && CANCEL.test(message)) return finish(line('All right, I have left this as it is. Nothing was saved.'), 'cancelled');

  const engagements = await reachable();
  const instruction = pending ? pending.state.instruction : instructionOf(message);

  const reads: SourceRead[] = [];
  // The sources: files as given, and a paste kept as a file only if the run has to wait.
  const sourceIds = pending ? pending.state.attachmentIds : attachmentIds;
  const paste = !pending && message.trim() && attachmentIds.length === 0 ? message : null;
  const keepPaste = async (): Promise<string[]> => {
    if (!paste) return sourceIds;
    const s3Key = `ask/attachments/${ctx.userId}/${randomUUID()}/paste.txt`;
    await putObject(s3Key, paste, 'text/plain; charset=utf-8');
    const pasteRead = reads.find((read) => !read.attachment);
    if (pasteRead) await keepRead(s3Key, pasteRead.result);
    const row = await createAskAttachment(ctx, { kind: 'paste', fileName: 'paste.txt', contentType: 'text/plain', sizeBytes: Buffer.byteLength(paste), s3Key, conversationId });
    return [row.id];
  };
  const askBack = async (text: string, state: Omit<PendingState, 'attachmentIds' | 'instruction'>) =>
    finish(line(text), 'waiting_reply', { attachmentIds: await keepPaste(), instruction, ...state });

  // Which client. A reply to a question names it, or confirms the one asked about.
  const replyMatches = pending ? companiesNamed(message, pending.state.options) : [];
  if (pending && replyMatches.length > 1) return askBack(moreThanOne(replyMatches), { options: replyMatches, mismatch: null });
  const replied = pending
    ? (replyMatches[0] ?? (pending.state.mismatch && CONFIRM.test(message) ? engagements.find((e) => e.id === pending.state.mismatch!.engagementId) : undefined))
    : undefined;
  if (pending && !replied) return askBack('Please tell me which project this is for.', pending.state);
  const firstLock = replied
    ? ({ kind: 'locked', engagement: replied } as const)
    : lockEngagement({ message: instruction, pagePath: request.page?.path, engagements, ownCompany: client });
  if (firstLock.kind === 'choose') {
    return askBack(moreThanOne(firstLock.options), { options: firstLock.options, mismatch: null });
  }
  if (firstLock.kind === 'unknown' && firstLock.mentioned) {
    return finish(line(`I cannot find ${maskIdentityNumbers(firstLock.mentioned)} among your projects, so nothing was read.`));
  }

  // Read every source. A refused file is reported; the others still count.
  const rows: AskAttachmentRow[] = await getOwnAskAttachments(ctx, sourceIds);
  if (sourceIds.length > 0 && rows.length !== sourceIds.length) return finish(line('One of those files is not available. Please attach it again.'), 'failed');

  // A client's file that answers something open needs no reading: it goes straight on a card.
  let openNote = '';
  const clientFiles = rows.filter((row) => row.kind !== 'paste');
  if (client && clientFiles.length > 0 && firstLock.kind === 'locked') {
    const { engagement } = firstLock;
    const match = await matchClientFiles({ auth: ctx, engagementId: engagement.id, conversationId, runId, now, via: 'ask' }, clientFiles, instruction);
    openNote = match.note;
    if (match.draft) {
      await lockAskRun(ctx, runId, engagement.id);
      const changesetId = await createReviewCard(ctx, match.draft, { runId, conversationId, companyName: engagement.companyName, now });
      if (!changesetId) return finish(line('Your company is not available.'), 'failed');
      return finish(line(`I prepared this for ${engagement.companyName}. Nothing goes out until you confirm.${openNote}`, { changesetId }), 'waiting_approval');
    }
  }

  progress(rows.length > 0 || paste ? 'Reading…' : 'Checking…');
  const refusals: string[] = [];
  const readOne = async (attachment: AskAttachmentRow | null, read: () => Promise<ReadResult>) => {
    try {
      const result = await read();
      reads.push({ result, attachment });
      if (attachment) await updateOwnAskAttachment(ctx, attachment.id, { status: 'read', docType: result.docType, sensitive: result.sensitive, runId });
      await appendAskRunStep(ctx, runId, { kind: result.usedModel ? 'model' : 'tool', name: 'read', label: 'Reading', output: { docType: result.docType, values: result.values.length } });
    } catch (error) {
      const known = error instanceof ReadRefused;
      if (!known) console.error('[ask-vcfo] read failed', safeError(error));
      const text = known ? error.message : 'This file could not be read. Please type the details in instead.';
      refusals.push(text);
      if (attachment) await updateOwnAskAttachment(ctx, attachment.id, { status: 'failed', error: text, runId });
    }
  };
  if (paste) await readOne(null, () => readPaste(paste, deps));
  for (const attachment of rows) {
    await readOne(attachment, async () => {
      const kept = pending && attachment.s3Key ? await keptRead(attachment.s3Key) : null;
      if (kept?.sensitive && !flags.idDocReading) throw new ReadRefused(REFUSED_ID_DOC);
      if (kept) return kept;
      const bytes = attachment.s3Key ? await getObjectBuffer(attachment.s3Key) : null;
      if (!bytes) throw new ReadRefused('That file is no longer available. Please attach it again.');
      const result = await (attachment.kind === 'paste' ? readPaste(bytes.toString('utf8'), deps) : readFile({ fileName: attachment.fileName, data: bytes }, deps));
      await keepRead(attachment.s3Key!, result);
      return result;
    });
  }
  if (reads.length === 0) return finish(line(`${refusals[0] ?? 'I found nothing to read.'}${openNote}`), 'failed', undefined, 'read refused');
  if (reads.every((r) => r.result.values.length === 0)) {
    if (paste && !isDataMessage(paste)) {
      await close('done');
      return null;
    }
    return finish(line(`I could not find any details to file in this. Nothing was saved.${openNote}`));
  }

  // With no client yet, the document may name one. A document naming another client is a question.
  const docCompanies = [...new Set(reads.flatMap((r) => (r.result.company ? [r.result.company] : [])))];
  let locked = firstLock.kind === 'locked' ? firstLock.engagement : null;
  if (!locked) {
    const named = [...new Map(docCompanies.flatMap((name) => companiesNamed(name, engagements)).map((e) => [e.id, e])).values()];
    if (named.length === 1) locked = named[0]!;
    else {
      const text = named.length > 1 ? moreThanOne(named) : 'Which project is this for?';
      return askBack(text, { options: named.length > 1 ? named : engagements, mismatch: null });
    }
  }
  await lockAskRun(ctx, runId, locked.id);
  const row = await getEngagementById(ctx, locked.id);
  if (!row) return finish(line('That project is not available.'), 'failed');
  const state = checklistStateFromRow(row);
  // Only a yes to the project the mismatch question asked about passes over the document's name.
  const confirmed = Boolean(replied) && pending?.state.mismatch?.engagementId === row.id;
  const knownNames = [row.companyName, state['pre-1']?.responses?.proposedName1, state['pre-1']?.responses?.proposedName2, row.parentEntityName].filter((n): n is string => Boolean(n?.trim()));
  const stranger = confirmed ? null : docCompanies.find((name) => !documentMatches(name, knownNames));
  if (stranger) {
    return askBack(`This document names ${maskIdentityNumbers(stranger)}, not ${row.companyName}. Should I file it for ${row.companyName}? Say "Yes, file it for ${row.companyName}", or name the right project.`, {
      options: engagements,
      mismatch: { engagementId: row.id, company: stranger },
    });
  }

  // Find the place for each value: code first, then one small-model call for the rest.
  progress('Finding the right fields…');
  const { placed, questions: placeQuestions, files, chooseCalls } = await placeValues(reads, { instruction, provider, model: config.models.extract });
  if (chooseCalls > 0) await appendAskRunStep(ctx, runId, { kind: 'model', name: 'choose', output: { asked: chooseCalls, chosen: placed.length } });
  const questions = [...new Set(refusals), ...placeQuestions];

  progress('Checking the rules…');
  const plan = planRows({ role: ctx.role, engagementId: row.id, companyName: row.companyName, engagement: row, state, placed, files, instruction });
  questions.push(...plan.questions);
  const askMore = `${questions.length > 0 ? ` ${[...new Set(questions)].slice(0, 5).join(' ')}` : ''}${openNote}`;

  if (plan.draft.rows.length === 0) {
    const nothing = placed.length > 0 ? `Everything here is already saved for ${row.companyName}.` : `I found nothing to save for ${row.companyName}.`;
    return finish(line(`${nothing}${askMore}`));
  }
  const changesetId = await createReviewCard(ctx, plan.draft, { runId, conversationId, companyName: row.companyName, now });
  if (!changesetId) return finish(line('That project is not available.'), 'failed');

  const count = plan.draft.rows.length;
  const held = plan.draft.rows.filter((r) => r.heldReason).length;
  const heldNote = held > 0 ? ` ${held} ${held === 1 ? 'is' : 'are'} held, with the reason on the row.` : '';
  return finish(
    line(`I prepared ${count} value${count === 1 ? '' : 's'} for ${row.companyName}. Nothing is saved until you accept.${heldNote}${askMore}`, { changesetId }),
    'waiting_approval',
  );
}
