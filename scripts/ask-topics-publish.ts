/**
 * npm run ask:topics:publish -- <slug> --reviewer "Name, Role"
 * npm run ask:topics:publish -- --unpublish <slug>
 * npm run ask:topics:publish -- --field <stepId>.<fieldKey> --reviewer "Name, Role"
 * npm run ask:topics:publish -- --unpublish --field <stepId>.<fieldKey>
 *
 * Records a human review. Changes review fields and the version of ONE topic
 * (or one field-help line) and nothing else; content is edited by hand.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { indiaDay } from '@/lib/ask/nudge';
import { publishTopicJson, setFieldHelpReview, TopicPublishError, unpublishTopicJson } from '@/lib/ask/topic-publish';

const TOPICS_DIR = path.join(process.cwd(), 'src', 'data', 'ask', 'topics');
const FIELD_HELP_FILE = path.join(process.cwd(), 'src', 'data', 'ask', 'field-help.ts');

function parseArgs(argv: string[]) {
  const out: { slug?: string; reviewer?: string; field?: string; unpublish: boolean } = { unpublish: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--unpublish') out.unpublish = true;
    else if (arg === '--reviewer') out.reviewer = argv[(i += 1)];
    else if (arg === '--field') out.field = argv[(i += 1)];
    else if (!arg.startsWith('--') && !out.slug) out.slug = arg;
    else throw new TopicPublishError(`Unknown argument: ${arg}`);
  }
  return out;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const today = indiaDay(new Date());
  if (args.field) {
    const source = readFileSync(FIELD_HELP_FILE, 'utf8');
    const next = setFieldHelpReview(source, args.field, args.unpublish ? null : { reviewer: args.reviewer, today });
    writeFileSync(FIELD_HELP_FILE, next);
    console.log(`${args.unpublish ? 'Unpublished' : 'Published'} field help ${args.field}${args.unpublish ? '' : ` — reviewed by ${args.reviewer!.trim()} on ${today}`}.`);
  } else {
    if (!args.slug || !/^[a-z0-9-]+$/.test(args.slug)) throw new TopicPublishError('Name one topic slug, e.g. gst-basics.');
    const file = path.join(TOPICS_DIR, `${args.slug}.json`);
    if (!existsSync(file)) throw new TopicPublishError(`No topic file for "${args.slug}" in src/data/ask/topics.`);
    const raw = readFileSync(file, 'utf8');
    const { json, topic } = args.unpublish ? unpublishTopicJson(raw) : publishTopicJson(raw, { reviewer: args.reviewer, today });
    writeFileSync(file, json);
    console.log(
      args.unpublish
        ? `Unpublished ${topic.slug}: now draft, version ${topic.version}.`
        : `Published ${topic.slug}: version ${topic.version}, reviewed by ${topic.reviewedBy} on ${topic.reviewedAt}.`,
    );
  }
} catch (error) {
  if (error instanceof TopicPublishError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
