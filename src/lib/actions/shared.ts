import 'server-only';

import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import type { ChangesetDraft, ChangesetRecipient, JsonValue } from '@/lib/ask/changeset/types';
import { maskIdentityNumbers } from '@/lib/ask/mask';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import type { ActionContext, ActionResult } from './types';

/**
 * What the record-type actions share. The client is never part of a tool's input: it comes from the
 * run's lock, and every item id the model names is checked against that client before anything runs.
 */
export const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'intern'] as const;
export const MANAGING_ROLES = ['super_admin', 'admin', 'manager'] as const;

/** A sentence for the person: the action could not run, and nothing was changed. */
export class ActionRefused extends Error {}

export function lockedClient(actx: ActionContext): string {
  if (!actx.engagementId) throw new ActionRefused('This needs one project first.');
  return actx.engagementId;
}

/** Refuses an item that belongs to another client, as if it did not exist. */
export function assertOnLockedClient(actx: ActionContext, engagementId: string | null | undefined, what: string): void {
  if (!engagementId || engagementDbId(engagementId) !== engagementDbId(lockedClient(actx))) {
    throw new ActionRefused(`That ${what} is not on this project.`);
  }
}

/** The repositories refuse with short codes; these are the ones a person can act on. */
const REFUSAL_COPY: Record<string, string> = {
  forbidden: 'You cannot do this on this item.',
  not_found: 'That item is not available.',
  end_before_start: 'The due date is before the start date.',
  name_required: 'This needs a name.',
  label_required: 'This needs some text.',
  body_required: 'This needs some text.',
  empty_body: 'This needs some text.',
  note_required: 'This needs a note saying why.',
  not_in_review: 'This task is not waiting for review.',
  owner_not_staff: 'That person is not active staff.',
  unknown_activity: 'That activity is not available.',
};

/** A repository's refusal becomes a sentence; anything else is a fault and stays one. */
export function refusalOf(error: unknown): string | null {
  if (error instanceof ActionRefused) return error.message;
  const status = (error as { status?: unknown } | null)?.status;
  if (error instanceof Error && typeof status === 'number' && status >= 400 && status < 500) {
    return REFUSAL_COPY[error.message] ?? error.message;
  }
  return null;
}

export async function refusing(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch (error) {
    const text = refusalOf(error);
    if (text) return { ok: false, error: text };
    throw error;
  }
}

/** The people on the client's side, worked out by code: the model never picks a recipient. */
export async function clientRecipients(engagementId: string): Promise<ChangesetRecipient[]> {
  const parties = await resolveEngagementRecipients(engagementId);
  return (parties?.clients ?? []).map((party) => ({ name: party.name, email: party.email, role: 'Client' }));
}

/** One row for a card. The input is the target, so the hash covers everything the action will do. */
export function recordDraft(
  actx: ActionContext,
  draft: {
    action: string;
    tier: ChangesetDraft['tier'];
    title: string;
    label: string;
    target: object;
    displayNew: string;
    displayOld?: string;
    recipients?: ChangesetRecipient[];
  },
): ChangesetDraft {
  const displayNew = maskIdentityNumbers(draft.displayNew);
  return {
    title: draft.title,
    tier: draft.tier,
    engagementId: lockedClient(actx),
    recipients: draft.recipients,
    rows: [
      {
        action: draft.action,
        target: JSON.parse(JSON.stringify(draft.target)) as { [key: string]: JsonValue },
        label: draft.label,
        oldValue: draft.displayOld ?? null,
        newValue: displayNew,
        displayOld: draft.displayOld ?? '',
        displayNew,
        sensitive: false,
        source: null,
        checks: [],
      },
    ],
  };
}
