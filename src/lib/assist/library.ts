import type { AnswerEnvelope, ProjectSnapshot } from '@/data/assist/schema';
import { answerEnvelopeSchema } from '@/data/assist/schema';
import { getTopic, topicToAnswer } from '@/lib/assist/topics';

export const UPDATED_SINCE_SAVED = 'Updated since you saved it';

export interface LibraryRowLike {
  id: string;
  topicSlug: string | null;
  title: string;
  category: string;
  snapshot: unknown;
  sourceVersion: number | null;
  createdAt: Date;
}

export interface LibraryItemView {
  id: string;
  title: string;
  category: string;
  topicSlug: string | null;
  /** Topic version moved on since the save (§4.3). */
  updated: boolean;
  savedAt: string;
  answer: AnswerEnvelope;
}

/** A topic whose current version is newer than the saved one. */
export function isLibraryItemUpdated(item: Pick<LibraryRowLike, 'topicSlug' | 'sourceVersion'>): boolean {
  if (!item.topicSlug) return false;
  const topic = getTopic(item.topicSlug);
  if (!topic) return false;
  return topic.version > (item.sourceVersion ?? 0);
}

/**
 * List / reader view of a saved item. Opening an updated topic shows the
 * current version, not the stale copy.
 */
export function toLibraryView(
  row: LibraryRowLike,
  opts: { current: boolean; snapshot: ProjectSnapshot | null },
): LibraryItemView {
  const saved = answerEnvelopeSchema.safeParse(row.snapshot);
  const updated = isLibraryItemUpdated(row);
  let answer: AnswerEnvelope = saved.success
    ? saved.data
    : { line: row.title, citations: [], actions: [], origin: 'generated', depth: 'normal' };
  if (opts.current && updated && row.topicSlug) {
    const topic = getTopic(row.topicSlug);
    if (topic) answer = topicToAnswer(topic, { depth: answer.depth, shell: 'client', snapshot: opts.snapshot });
  }
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    topicSlug: row.topicSlug,
    updated,
    savedAt: row.createdAt.toISOString(),
    answer,
  };
}
