/**
 * npm run ask:topics:report
 *
 * Regenerates docs/specs/ask-vcfo/TOPIC-REVIEW.md — the firm's review pack for
 * Ask VCFO topics and field-help lines. Reads the content files only; it never
 * changes a topic.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { listTopics, topicLoadErrors } from '@/lib/ask/topics';
import { buildTopicReview } from '@/lib/ask/topic-review';

const OUT = path.join(process.cwd(), 'docs', 'specs', 'ask-vcfo', 'TOPIC-REVIEW.md');

const errors = topicLoadErrors();
if (errors.length > 0) {
  console.error('Some topic files are invalid and were left out of the report:');
  for (const e of errors) console.error(`  ${e.slug ?? `#${e.index}`}: ${e.message}`);
}
const topics = listTopics();
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, buildTopicReview({ topics }));
const drafts = topics.filter((t) => t.status === 'draft').length;
console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${topics.length} topics, ${drafts} draft.`);
process.exit(errors.length > 0 ? 1 : 0);
