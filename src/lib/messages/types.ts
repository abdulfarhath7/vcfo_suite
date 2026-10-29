/**
 * Client messages (G-09, G-11): the shapes shared by the routes, the repository and the
 * screens. A client writes to the people on their engagement; the lead triages each client
 * message as new, to do, done or ignored, and replies from the same thread.
 *
 * The contract is fixed in docs/ui-port/GAPS-BRIEF.md ("Client messages"); the client portal
 * codes to it, so change it only together with that brief.
 */

export const MESSAGE_TRIAGE = ['new', 'todo', 'done', 'ignored'] as const;
export type MessageTriage = (typeof MESSAGE_TRIAGE)[number];

/** The triage filter on `GET /api/messages`: one state, or every message on both sides. */
export const MESSAGE_TRIAGE_FILTER = [...MESSAGE_TRIAGE, 'all'] as const;
export type MessageTriageFilter = (typeof MESSAGE_TRIAGE_FILTER)[number];

export type MessageSenderSide = 'client' | 'staff';

export interface Message {
  id: string;
  engagementId: string;
  companyName: string;
  senderSide: MessageSenderSide;
  senderName: string;
  body: string;
  /** The step or filing the message is about (`src/lib/work/item-key.ts`), when one was named. */
  itemKey: string | null;
  /** When someone on the other side read it. */
  readAt: string | null;
  triage: MessageTriage;
  createdAt: string;
}

/** Longest message body we store. Long enough for a paragraph, short enough for an email. */
export const MESSAGE_BODY_MAX = 4000;

export function isMessageTriage(value: unknown): value is MessageTriage {
  return typeof value === 'string' && (MESSAGE_TRIAGE as readonly string[]).includes(value);
}

/** Screen word for a triage state (sentence case, R-05). */
export const MESSAGE_TRIAGE_LABEL: Record<MessageTriage, string> = {
  new: 'New',
  todo: 'To do',
  done: 'Done',
  ignored: 'Ignored',
};
