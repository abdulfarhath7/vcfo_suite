import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { searchAskChunks } from '@/db/repositories/ask-documents';
import type { Topic } from '@/data/ask/schema';
import { appliesTo, listTopics, type ApplicabilityContext } from '@/lib/ask/topics';

/** One piece of evidence handed to the model, citable by `id`. */
export interface RetrievedSource {
  id: string;
  kind: 'chunk' | 'topic';
  label: string;
  text: string;
  url?: string | null;
}

const STOP = new Set(['what', 'is', 'the', 'a', 'an', 'of', 'do', 'we', 'to', 'and', 'for', 'in', 'my', 'our', 'how', 'why', 'does', 'it', 'i', 'you', 'be', 'on', 'need']);

function terms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Keyword overlap score of a topic against a query (topics are few; no index needed). */
export function scoreTopic(topic: Topic, query: string): number {
  const q = new Set(terms(query));
  if (q.size === 0) return 0;
  const hay = new Set(terms(`${topic.title} ${topic.question} ${topic.body.normal}`));
  let score = 0;
  for (const t of q) if (hay.has(t)) score += 1;
  return score / q.size;
}

export function matchTopics(
  query: string,
  ctx: ApplicabilityContext | null,
  audience: 'client' | 'staff',
  limit = 3,
): Topic[] {
  return listTopics()
    .filter((t) => t.audience === 'both' || t.audience === audience)
    .filter((t) => appliesTo(t.appliesTo, ctx))
    .map((t) => ({ t, s: scoreTopic(t, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

/**
 * Evidence for a generated answer: full-text search over ingested sources
 * (audience-filtered in the repository) plus matching topics — draft topics
 * included, as context only; the answer is then badged "AI answer".
 */
export async function retrieveSources(
  authCtx: AuthContext,
  input: { query: string; persona: 'client' | 'staff'; topK: number; applicability: ApplicabilityContext | null },
): Promise<RetrievedSource[]> {
  let chunks: RetrievedSource[] = [];
  try {
    const hits = await searchAskChunks(authCtx, { query: input.query, persona: input.persona, limit: input.topK });
    chunks = hits.map((h) => ({
      id: h.id,
      kind: 'chunk',
      label: h.documentTitle,
      text: [h.contextPrefix, h.text].filter(Boolean).join('\n'),
      url: h.sourceUrl,
    }));
  } catch (error) {
    console.warn('[ask-vcfo] retrieval failed; answering from topics only', error);
  }
  const topics: RetrievedSource[] = matchTopics(input.query, input.applicability, input.persona).map((t) => ({
    id: t.slug,
    kind: 'topic',
    label: t.title,
    text: `${t.question}\n${t.body.detail}\nWhy it matters: ${t.body.why}\nSources: ${t.citations
      .map((c) => `${c.id} (${c.label})`)
      .join('; ')}`,
  }));
  return [...topics, ...chunks];
}
