import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { createAskRun, startQueuedAskRun } from '@/db/repositories/ask-runs';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import type { JsonValue } from '@/lib/ask/changeset/types';
import { askBudgets, askFlags } from '@/lib/ask/config';
import { queueAskDrop } from '@/lib/ask/drop/run';
import { DROP_WORKFLOW, emptyDropState, type DropState } from '@/lib/ask/drop/types';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import { resolveProjectFolder, SharepointRefused } from './client-folder';

/**
 * "Take Kestrel's data from SharePoint": finds the project's folder under `/Clients` and starts a
 * drop on it. The drop job copies the folder's files in (`dropPullStep`) and then runs exactly as
 * for dropped files: read, sort, one review card. Nothing is saved until the person accepts.
 */

export type SharepointDropStart =
  | { ok: true; runId: string; folderName: string; companyName: string }
  | { ok: false; message: string };

const CHOOSE_SHOWN = 5;

export async function startSharepointDrop(
  ctx: AuthContext,
  input: { engagementId: string; conversationId: string | null; message: string; projectPath?: string },
): Promise<SharepointDropStart> {
  if (ctx.role === 'client') return { ok: false, message: 'Reading SharePoint is not available here.' };
  const flags = askFlags();
  if (flags.killedPaths.has('fixed_workflow') || flags.killedTiers.has('T2')) {
    return { ok: false, message: 'Filling in from files is switched off for now.' };
  }

  let found;
  try {
    found = await resolveProjectFolder(ctx, input.engagementId);
  } catch (error) {
    if (error instanceof SharepointRefused) return { ok: false, message: error.message };
    throw error;
  }
  if (found.kind === 'choose') {
    const { match, companyName } = found;
    if (match.kind === 'many') {
      const names = match.options.slice(0, CHOOSE_SHOWN).map((f) => f.name).join(', ');
      return { ok: false, message: `More than one SharePoint folder could be ${companyName}: ${names}. Pick the right one under SharePoint folder on the project's page, then ask me again.` };
    }
    return { ok: false, message: `I cannot find a SharePoint folder for ${companyName} under Clients. Link it under SharePoint folder on the project's page, then ask me again.` };
  }

  const { link, companyName } = found;
  const instruction = maskIdentityNumbers(`${input.message.trim()} (files from the SharePoint folder of ${companyName})`).slice(0, 2000);
  const state: DropState = {
    ...emptyDropState(),
    instruction,
    ...(input.projectPath ? { page: { path: input.projectPath } } : {}),
    source: { kind: 'sharepoint', engagementId: input.engagementId, folderName: link.folderName },
    progress: { done: 0, total: 0, label: 'Fetching from SharePoint…' },
  };
  const run = await createAskRun(ctx, {
    conversationId: input.conversationId,
    workflow: DROP_WORKFLOW,
    goal: `SharePoint: ${companyName}`,
    budgetTokens: askBudgets().dropMaxTokens,
    status: 'queued',
    state: state as unknown as JsonValue,
  });
  const started = await startQueuedAskRun(ctx, run.id, { goal: `SharePoint: ${companyName}`, state: state as unknown as JsonValue });
  if (!started) return { ok: false, message: 'This fetch has already started.' };
  await recordAuditEvent(ctx, {
    engagementId: input.engagementId,
    action: 'sharepoint.fetch',
    summary: `Fetched files from the SharePoint folder ${link.folderName} for review`,
    metadata: { runId: run.id, folderName: link.folderName },
  });
  await queueAskDrop(run.id, { profileId: ctx.userId });
  return { ok: true, runId: run.id, folderName: link.folderName, companyName };
}
