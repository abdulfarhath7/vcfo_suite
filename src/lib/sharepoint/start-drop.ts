import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { getOwnAskAttachments, updateOwnAskAttachment } from '@/db/repositories/ask-attachments';
import { createAskRun, startQueuedAskRun } from '@/db/repositories/ask-runs';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import type { JsonValue } from '@/lib/ask/changeset/types';
import { askBudgets, askFlags } from '@/lib/ask/config';
import { queueAskDrop } from '@/lib/ask/drop/run';
import { DROP_WORKFLOW, emptyDropState, fetchSourceWords, type DropFillAfter, type DropState } from '@/lib/ask/drop/types';
import { getEngagementById } from '@/db/repositories/engagements';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import { resolveProjectFolder, SharepointRefused } from './client-folder';

/**
 * "Take Kestrel's data from SharePoint" or "fill Kestrel into the app": finds the project's folder
 * under `/Clients` and starts a drop on it. The drop job copies the folder's files in, adds the
 * project's documents already in the app (`dropPullStep`, PLAN M4), and then runs exactly as for
 * dropped files: read, sort, one review card. Nothing is saved until the person accepts.
 *
 * With `appDocs` (the default), a project whose SharePoint folder cannot be read (SharePoint is not
 * set up, the person has not connected it, no folder or two folders match) is still fetched from
 * the app's documents, and the reason SharePoint was left out goes into the closing message.
 */

export type SharepointDropStart =
  | { ok: true; runId: string; folderName: string; companyName: string; /** Where the fetch reads, in words. */ sources: string }
  | { ok: false; message: string };

const CHOOSE_SHOWN = 5;

export async function startSharepointDrop(
  ctx: AuthContext,
  input: {
    engagementId: string;
    conversationId: string | null;
    message: string;
    projectPath?: string;
    /** Start a fill on the card once it is ready (see `DropState.fillAfter`). */
    fillAfter?: DropFillAfter;
    /** Also read the documents already in the app (default true). */
    appDocs?: boolean;
    /** Files the person attached to the request, read in the same drop. Only their own rows count. */
    attachmentIds?: readonly string[];
  },
): Promise<SharepointDropStart> {
  if (ctx.role === 'client') return { ok: false, message: 'Reading SharePoint is not available here.' };
  const flags = askFlags();
  if (flags.killedPaths.has('fixed_workflow') || flags.killedTiers.has('T2')) {
    return { ok: false, message: 'Filling in from files is switched off for now.' };
  }

  const appDocs = input.appDocs !== false;
  // Why SharePoint is left out, when it is: the whole fetch for a SharePoint-only request, a note
  // in the closing message when the app's documents are read anyway.
  let sharepointNote: string | null = null;
  let folderName = '';
  let companyName = '';
  try {
    const found = await resolveProjectFolder(ctx, input.engagementId);
    companyName = found.companyName;
    if (found.kind === 'choose') {
      const { match } = found;
      sharepointNote =
        match.kind === 'many'
          ? `More than one SharePoint folder could be ${companyName}: ${match.options.slice(0, CHOOSE_SHOWN).map((f) => f.name).join(', ')}. Pick the right one under SharePoint folder on the project's page, then ask me again.`
          : `I cannot find a SharePoint folder for ${companyName} under Clients. Link it under SharePoint folder on the project's page, then ask me again.`;
    } else folderName = found.link.folderName;
  } catch (error) {
    if (!(error instanceof SharepointRefused)) throw error;
    sharepointNote = error.message;
  }
  if (sharepointNote && !appDocs) return { ok: false, message: sharepointNote };
  if (!companyName) {
    const row = await getEngagementById(ctx, input.engagementId);
    if (!row) return { ok: false, message: 'This project is not available.' };
    companyName = row.companyName;
  }

  const sharepoint = !sharepointNote;
  const source = { kind: 'sharepoint' as const, engagementId: input.engagementId, folderName, companyName, ...(sharepoint ? {} : { sharepoint: false }), ...(appDocs ? { appDocs: true } : {}) };
  const sources = fetchSourceWords(source);
  const instruction = maskIdentityNumbers(`${input.message.trim()} (files from ${sources} of ${companyName})`).slice(0, 2000);
  const state: DropState = {
    ...emptyDropState(),
    instruction,
    ...(input.projectPath ? { page: { path: input.projectPath } } : {}),
    source,
    progress: { done: 0, total: 0, label: sharepoint ? 'Fetching from SharePoint…' : 'Gathering the documents in the app…' },
    // SharePoint's reason for being left out is said in the closing message, beside what was read.
    ...(sharepointNote ? { notes: [maskIdentityNumbers(`SharePoint was not read: ${sharepointNote}`)] } : {}),
    ...(input.fillAfter ? { fillAfter: input.fillAfter } : {}),
  };
  const goal = `${sharepoint ? 'SharePoint' : 'Documents'}: ${companyName}`;
  const run = await createAskRun(ctx, {
    conversationId: input.conversationId,
    workflow: DROP_WORKFLOW,
    goal,
    budgetTokens: askBudgets().dropMaxTokens,
    status: 'queued',
    state: state as unknown as JsonValue,
  });
  // Files attached to the request join the drop as its own uploads: the owner's rows only, and only
  // rows not yet part of another run.
  if (input.attachmentIds?.length) {
    for (const row of await getOwnAskAttachments(ctx, input.attachmentIds)) {
      if (row.runId) continue;
      await updateOwnAskAttachment(ctx, row.id, { runId: run.id, ...(input.conversationId ? { conversationId: input.conversationId } : {}) });
    }
  }
  const started = await startQueuedAskRun(ctx, run.id, { goal, state: state as unknown as JsonValue });
  if (!started) return { ok: false, message: 'This fetch has already started.' };
  await recordAuditEvent(ctx, {
    engagementId: input.engagementId,
    action: 'sharepoint.fetch',
    summary: `Fetched files from ${sources} for review`,
    metadata: { runId: run.id, folderName, appDocs, sharepoint },
  });
  await queueAskDrop(run.id, { profileId: ctx.userId });
  return { ok: true, runId: run.id, folderName, companyName, sources };
}
