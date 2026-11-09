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

/**
 * A value that is, or holds, a form this chat shows masked: a number cut to its last four, or a hidden
 * portal secret. Saving it would overwrite the real value with the mask.
 */
export const MASKED_VALUE = /(?<![A-Z0-9])X{3,}[A-Z0-9]{4}(?![A-Z0-9])|\[hidden\]/i;

/** What an undo says when somebody has changed the record since the card saved it. */
export const CHANGED_SINCE = 'This value was changed after it was saved, so it was left as it is.';

const comparable = (value: unknown): unknown => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(comparable);
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, comparable(item)]);
  }
  const text = String(value).trim();
  return text !== '' && Number.isFinite(Number(text)) ? Number(text) : text;
};

/**
 * True when a record still holds what a card saved. An undo checks this before it writes, so it
 * cannot overwrite a later edit. Numbers compare by value, as the database hands back "100.00" for
 * 100, and an empty string and a null are the same.
 */
export function stillAsSaved(current: object, saved: object): boolean {
  return Object.entries(saved).every(([key, value]) => JSON.stringify(comparable((current as Record<string, unknown>)[key])) === JSON.stringify(comparable(value)));
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
  const displayOld = draft.displayOld == null ? null : maskIdentityNumbers(draft.displayOld);
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
        oldValue: displayOld,
        newValue: displayNew,
        displayOld: displayOld ?? '',
        displayNew,
        sensitive: false,
        source: null,
        checks: [],
      },
    ],
  };
}
