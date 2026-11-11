import { readProposedDirectors, displayName, type StepStateMap } from '@/lib/incorporation/proposed-directors';
import type { KnownPerson } from '@/lib/ask/mask';

/**
 * CLIENT DATA KILL SWITCH and the people the masker should know (docs/specs/ask-vcfo/PRIVACY.md).
 *
 * `ASK_CLIENT_DATA_ENABLED=false` keeps every engagement and client fact out of model prompts: no
 * project snapshot, no data tools, no record cards, no page context, no conversation history, and no
 * model reading in the Do path. Ask VCFO then answers from general knowledge only and says so. It
 * defaults to on so local work is unchanged; the owner may set it to "false" in production until
 * written client consent exists (legal review, action item 2).
 */
export function askClientDataEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.ASK_CLIENT_DATA_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
}

/** Said to the person when the switch is off and the answer came from a model. */
export const CLIENT_DATA_OFF_NOTE = 'This answer uses general knowledge only. Client data is switched off for Ask VCFO, so it does not reflect your project.';

/** Said in the Do path, which cannot read a document for a client without the model. */
export const CLIENT_DATA_OFF_DO =
  'Reading client documents with AI is switched off here. Please type the details as "Label: value" lines, which are read without AI.';

/** The directors an engagement names, plus the signed-in client, for the masker to hide. */
export function knownPeopleFromState(state: StepStateMap, extra: readonly KnownPerson[] = []): KnownPerson[] {
  const directors = readProposedDirectors(state)
    .map((d) => displayName(d.values))
    .filter((name) => name.trim().length > 0)
    .map<KnownPerson>((name) => ({ name, kind: 'DIRECTOR' }));
  return [...directors, ...extra];
}
