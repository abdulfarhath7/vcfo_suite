import 'server-only';

import type { AuthContext } from '@/auth/guards';
import type { AnswerEnvelope } from '@/data/ask/schema';
import { appendAskMessage } from '@/db/repositories/ask-messages';
import { listEngagements } from '@/db/repositories/engagements';
import { companiesNamed, lockEngagement } from '@/lib/ask/data-router/lock';
import type { DropFillAfter, DropState } from '@/lib/ask/drop/types';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import { startSharepointDrop } from '@/lib/sharepoint/start-drop';
import { asksToFetch } from './intent';
import { FillRefused, fillStartedLine, startFill } from './run';
import type { FillMode, FillScope } from './types';

/**
 * "Fetch Bonterra's data and put it in name application" in a chat with no open card: the client's
 * SharePoint folder is read first, through the same drop `sharepoint.fetch` starts, and the drop
 * remembers that a fill should follow. When the drop's finish step has the card ready, it starts
 * the fill on that card (`fillAfterDrop`), so both the Inngest job and the inline fallback do it.
 */

export interface FetchThenFillStart {
  line: string;
  /** The drop run, so the chat shows its progress as for any SharePoint fetch. */
  runId?: string;
}

const modeWord = (mode: FillMode) => (mode === 'auto' ? 'Auto' : 'Manual');

/**
 * Starts the fetch for a fill request that found no card. Null when the message names no client or
 * folder to fetch, so the caller keeps its "no open card" answer.
 */
export async function startFetchThenFill(
  ctx: AuthContext,
  input: {
    message: string;
    conversationId: string | null;
    pagePath?: string;
    mode: FillMode;
    chip?: FillMode;
    scope: FillScope | null;
    /** Files the person attached to the message, read in the same fetch (PLAN M4). */
    attachmentIds?: readonly string[];
    /**
     * A fill request implies the fetch (the fill-everything build): with no client named, the
     * project on screen, or the person's only project, is read and filled.
     */
    implied?: boolean;
  },
): Promise<FetchThenFillStart | null> {
  if (ctx.role === 'client') return null;
  const wantsFetch = asksToFetch(input.message) || input.implied === true;
  const rows = (await listEngagements(ctx)).filter((row) => !row.deletedAt);
  const options = rows.map((row) => ({ id: row.id, slug: row.slug ?? null, companyName: row.companyName }));
  const named = companiesNamed(input.message, options);
  if (named.length === 0 && !wantsFetch) return null;
  // A message that only asks to fetch may mean the project on screen, as "fetch the folder" does.
  const lock = named.length > 0 ? lockEngagement({ message: input.message, engagements: options }) : lockEngagement({ message: input.message, pagePath: input.pagePath, engagements: options });
  if (lock.kind === 'choose') return { line: `More than one client matches: ${lock.options.map((o) => o.companyName).join(' and ')}. Which one should I fetch and fill?` };
  if (lock.kind !== 'locked') {
    return lock.mentioned ? { line: `I cannot find ${maskIdentityNumbers(lock.mentioned)} among your clients, so nothing was fetched.` } : null;
  }
  const engagement = lock.engagement;
  const fillAfter: DropFillAfter = { mode: input.mode, ...(input.chip && input.chip !== input.mode ? { chip: input.chip } : {}), ...(input.scope ? { scope: input.scope } : {}) };
  const started = await startSharepointDrop(ctx, {
    engagementId: engagement.id,
    conversationId: input.conversationId,
    message: input.message,
    projectPath: `/projects/${engagement.slug || engagement.id}`,
    fillAfter,
    ...(input.attachmentIds?.length ? { attachmentIds: input.attachmentIds } : {}),
    // A fill reads the whole folder, past the drop's 50 files (src/lib/upload-limits.ts).
    wholeFolder: true,
  });
  if (started.ok === false) return { line: `${started.message} Nothing was filled.` };
  const what = input.scope ? `${input.scope.label} into the app` : 'it into the app';
  const files = input.attachmentIds?.length ? ` with the ${input.attachmentIds.length === 1 ? 'file' : `${input.attachmentIds.length} files`} you attached` : '';
  return {
    line: `There was no card in this chat yet, so I am reading ${started.sources.includes(started.companyName) ? `${started.sources}${files}` : `${started.sources}${files} for ${started.companyName}`} first. When the card is ready I will fill ${what} (${modeWord(input.chip ?? input.mode)}).`,
    runId: started.runId,
  };
}

/**
 * The fill a fetch promised, once the drop's card is ready. Posts one chat line either way: the fill
 * started, or plainly why nothing was filled. Returns the fill run id when one started, or null when
 * the drop asked for no fill. Never throws, because the drop itself already finished.
 */
export async function fillAfterDrop(ctx: AuthContext, input: { conversationId: string | null; state: DropState }): Promise<{ runId: string | null } | null> {
  const after = input.state.fillAfter;
  if (!after || after.started) return null;
  const scope = after.scope ?? null;
  const own = input.state.source?.engagementId;
  const group = input.state.groups.find((g) => g.engagementId === own) ?? input.state.groups[0];
  let line: string;
  let fill: { runId: string; mode: FillMode } | null = null;
  if (!group) {
    line = 'The folder gave me nothing to put on a card, so nothing was filled.';
  } else {
    try {
      const started = await startFill(ctx, { changesetId: group.changesetId, mode: after.mode, ...(after.chip ? { chip: after.chip } : {}), conversationId: input.conversationId, scope });
      fill = { runId: started.runId, mode: started.mode };
      line =
        started.mode === 'manual'
          ? `${fillStartedLine(started, scope)} Press Fill into app on the card to open the steps.`
          : fillStartedLine(started, scope);
    } catch (error) {
      if (!(error instanceof FillRefused)) console.error('[ask-vcfo] fill after fetch failed', error);
      line = error instanceof FillRefused ? error.message : 'I could not start the fill. Nothing was saved; the card is above.';
    }
  }
  if (input.conversationId) {
    const answer: AnswerEnvelope = { line, citations: [], actions: [], origin: 'work', depth: 'normal', ...(fill ? { fill } : {}) };
    await appendAskMessage(ctx, input.conversationId, { sender: 'assistant', text: line, answer, origin: 'work', path: 'fixed_workflow' }).catch((error) =>
      console.error('[ask-vcfo] fill after fetch message not written', error),
    );
  }
  return { runId: fill?.runId ?? null };
}
