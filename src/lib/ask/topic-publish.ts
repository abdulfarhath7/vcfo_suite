import { topicSchema, type Topic } from '@/data/ask/schema';
import { FIELD_HELP_MAX_CHARS } from '@/data/ask/field-help';

/**
 * Review bookkeeping for Ask VCFO content. Pure text-in / text-out so the
 * publish command and its tests share one implementation. Nothing here ever
 * publishes on its own: a named human reviewer is always required, and topic
 * CONTENT is edited by hand — these functions only change review fields and
 * the version.
 */

export class TopicPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TopicPublishError';
  }
}

export const MIN_REVIEWER_CHARS = 3;

function requireReviewer(reviewer: string | undefined): string {
  const name = (reviewer ?? '').trim();
  if (name.length < MIN_REVIEWER_CHARS) {
    throw new TopicPublishError('A reviewer is required: --reviewer "Name, Role" (at least 3 characters).');
  }
  return name;
}

function parseTopic(raw: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new TopicPublishError('The topic file is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TopicPublishError('The topic file must hold one JSON object.');
  }
  return data as Record<string, unknown>;
}

function serialise(topic: Record<string, unknown>): { json: string; topic: Topic } {
  const checked = topicSchema.safeParse(topic);
  if (!checked.success) {
    const why = checked.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new TopicPublishError(`The topic does not pass the schema, nothing was written: ${why}`);
  }
  return { json: `${JSON.stringify(topic, null, 2)}\n`, topic: checked.data };
}

function nextVersion(topic: Record<string, unknown>): number {
  const current = typeof topic.version === 'number' && Number.isInteger(topic.version) ? topic.version : 0;
  return current + 1;
}

/** Mark a topic reviewed and published by `reviewer` on `today` (ISO date); bumps the version. */
export function publishTopicJson(raw: string, opts: { reviewer: string | undefined; today: string }) {
  const reviewer = requireReviewer(opts.reviewer);
  const topic = parseTopic(raw);
  // The file as it stands must be valid before anything is changed.
  serialise(topic);
  return serialise({
    ...topic,
    status: 'published',
    version: nextVersion(topic),
    reviewedBy: reviewer,
    reviewedAt: opts.today,
  });
}

/** Back to draft. Reviewer history stays; the version still bumps so saved copies show "Updated". */
export function unpublishTopicJson(raw: string) {
  const topic = parseTopic(raw);
  return serialise({ ...topic, status: 'draft', version: nextVersion(topic) });
}

// ---------- Field help (C3) ----------

/** `pre-15.din` or `pre-15:din` → the key used in field-help.ts. */
export function fieldHelpKey(ref: string): string {
  const at = ref.indexOf(':') >= 0 ? ref.indexOf(':') : ref.indexOf('.');
  if (at <= 0 || at === ref.length - 1) throw new TopicPublishError('Use --field <stepId>.<fieldKey>, e.g. --field pre-15.din');
  return `${ref.slice(0, at)}:${ref.slice(at + 1)}`;
}

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Flip one field-help line in the source of `src/data/ask/field-help.ts`.
 * Only that line changes; its text is left exactly as written.
 */
export function setFieldHelpReview(
  source: string,
  ref: string,
  review: { reviewer: string | undefined; today: string } | null,
): string {
  const key = fieldHelpKey(ref);
  const lines = source.split('\n');
  const prefix = `  '${key}': {`;
  const index = lines.findIndex((line) => line.startsWith(prefix));
  if (index < 0) throw new TopicPublishError(`No field-help line for ${key}.`);
  const line = lines[index]!;
  const text = line.match(/text: (['"])(.*)\1, reviewed: /);
  if (!text) throw new TopicPublishError(`The field-help line for ${key} is not in the expected shape; edit it by hand.`);
  if (text[2]!.replace(/\\(.)/g, '$1').length > FIELD_HELP_MAX_CHARS) {
    throw new TopicPublishError(`The field-help line for ${key} is longer than ${FIELD_HELP_MAX_CHARS} characters.`);
  }
  const head = line.slice(0, line.indexOf(', reviewed: '));
  lines[index] = review
    ? `${head}, reviewed: true, reviewedBy: ${quote(requireReviewer(review.reviewer))}, reviewedAt: '${review.today}' },`
    : `${head}, reviewed: false },`;
  return lines.join('\n');
}
