import type { AnswerDepth, AnswerEnvelope, AssistShell, ProjectSnapshot } from '@/data/assist/schema';

/** Browser client for /api/assist/*. Every call surfaces a friendly error message. */

export class AssistApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AssistApiError';
  }
}

async function json<T>(res: Response, fallback: string): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON error bodies fall through to the fallback message.
  }
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : fallback;
    throw new AssistApiError(message, res.status);
  }
  return body as T;
}

export type AssistStatus = { enabled: boolean; firmName: string };

export async function fetchAssistStatus(): Promise<AssistStatus> {
  const res = await fetch('/api/assist/status', { cache: 'no-store' });
  return json<AssistStatus>(res, 'Assist is unavailable');
}

export type SuggestionView = { id: string; group: string; label: string };

export async function fetchSuggestions(
  shell: AssistShell,
  engagementId: string | null,
): Promise<{ suggestions: SuggestionView[]; snapshot: ProjectSnapshot | null }> {
  const params = new URLSearchParams({ shell });
  if (engagementId) params.set('engagementId', engagementId);
  const res = await fetch(`/api/assist/suggestions?${params}`);
  return json(res, 'Could not load suggestions');
}

export async function fetchTopicAnswer(
  slug: string,
  opts: { depth?: AnswerDepth; engagementId?: string | null },
): Promise<{ topic: { slug: string; title: string; category: string; version: number }; answer: AnswerEnvelope }> {
  const params = new URLSearchParams();
  if (opts.depth) params.set('depth', opts.depth);
  if (opts.engagementId) params.set('engagementId', opts.engagementId);
  const res = await fetch(`/api/assist/topics/${encodeURIComponent(slug)}?${params}`);
  return json(res, 'Could not load this explanation');
}

export type ChatBody = {
  conversationId?: string;
  shell: AssistShell;
  engagementId?: string;
  message?: string;
  suggestionId?: string;
  context?: { kind: 'step' | 'field' | 'compliance'; ref: string; label: string };
  depth?: AnswerDepth;
};

export type ChatEvent =
  | { type: 'status'; label: string }
  | { type: 'answer'; conversationId: string; messageId: string; answer: AnswerEnvelope }
  | { type: 'error'; code: string; message: string };

/** POST /api/assist/chat and read the NDJSON stream event by event. */
export async function streamChat(body: ChatBody, onEvent: (event: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch('/api/assist/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    await json(res, 'Assist is unavailable right now');
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as ChatEvent);
        } catch {
          // A malformed line is skipped; the stream keeps going.
        }
      }
      newline = buffer.indexOf('\n');
    }
  }
}

export type StoredMessage = { id: string; sender: 'user' | 'assistant'; text: string; answer: AnswerEnvelope | null };

export async function fetchConversation(id: string): Promise<{ messages: StoredMessage[] }> {
  const res = await fetch(`/api/assist/conversations/${encodeURIComponent(id)}`);
  return json(res, 'Could not load the conversation');
}

export type LibraryItemView = {
  id: string;
  title: string;
  category: string;
  topicSlug: string | null;
  updated: boolean;
  savedAt: string;
  answer: AnswerEnvelope;
};

export async function saveToLibrary(body: {
  engagementId: string;
  topicSlug?: string;
  messageId?: string;
  answer?: AnswerEnvelope;
}): Promise<{ item: LibraryItemView }> {
  const res = await fetch('/api/assist/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return json(res, 'Could not save to your library');
}

export async function fetchLibrary(): Promise<{ items: LibraryItemView[] }> {
  return json(await fetch('/api/assist/library'), 'Could not load your library');
}

export async function fetchLibraryItem(id: string): Promise<{ item: LibraryItemView; notice: string | null }> {
  return json(await fetch(`/api/assist/library/${encodeURIComponent(id)}`), 'Could not open this item');
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await json(await fetch(`/api/assist/library/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Could not remove this item');
}

export async function sendHandoff(body: {
  engagementId: string;
  question: string;
  conversationId?: string;
  context?: string;
}): Promise<void> {
  const res = await fetch('/api/assist/handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await json(res, 'Could not send your question. Please try again.');
}
