/**
 * Client ↔ lead messages, as the client portal reads them (G-09 "Message the lead").
 * The shape is the contract in docs/ui-port/GAPS-BRIEF.md; the routes
 * (`GET/POST /api/client/messages`) belong to the messaging work.
 */
export interface ClientMessage {
  id: string;
  engagementId: string;
  companyName: string;
  senderSide: 'client' | 'staff';
  senderName: string;
  body: string;
  itemKey: string | null;
  readAt: string | null;
  triage: string;
  createdAt: string;
}

/** Longest message the composer sends. */
export const CLIENT_MESSAGE_MAX = 4000;

/** The text to send, or null when there is nothing to send. */
export function messageToSend(draft: string): string | null {
  const t = draft.replace(/\r\n/g, '\n').trim();
  if (!t) return null;
  return t.slice(0, CLIENT_MESSAGE_MAX);
}

/** Oldest first, whatever order the server used; the same message once. */
export function threadOrder(list: ClientMessage[]): ClientMessage[] {
  const seen = new Set<string>();
  return [...list]
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
