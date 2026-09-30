import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { topicSchema } from '@/data/ask/schema';
import {
  fieldHelpKey,
  publishTopicJson,
  setFieldHelpReview,
  TopicPublishError,
  unpublishTopicJson,
} from '@/lib/ask/topic-publish';

const GST_FILE = path.join(process.cwd(), 'src/data/ask/topics/gst-basics.json');
const rawGst = readFileSync(GST_FILE, 'utf8');
const today = '2026-10-01';

// The library "Updated" badge reads the loaded topics; load gst-basics as it
// would be after a reviewer publishes it (version bumped by the command).
vi.mock('@/data/ask/topics', async (orig) => {
  const mod = await orig<typeof import('@/data/ask/topics')>();
  const { publishTopicJson: publish } = await import('@/lib/ask/topic-publish');
  return {
    RAW_TOPICS: mod.RAW_TOPICS.map((t) =>
      (t as { slug: string }).slug === 'gst-basics'
        ? JSON.parse(publish(JSON.stringify(t), { reviewer: 'A. Partner, Partner', today: '2026-10-01' }).json)
        : t,
    ),
  };
});

describe('publish', () => {
  it('refuses without a reviewer, or with one shorter than 3 characters', () => {
    expect(() => publishTopicJson(rawGst, { reviewer: undefined, today })).toThrow(TopicPublishError);
    expect(() => publishTopicJson(rawGst, { reviewer: '  ', today })).toThrow(/reviewer is required/);
    expect(() => publishTopicJson(rawGst, { reviewer: 'AB', today })).toThrow(TopicPublishError);
  });

  it('sets status, reviewer and date, and bumps the version by one', () => {
    const before = JSON.parse(rawGst) as { version: number; body: unknown };
    const { json, topic } = publishTopicJson(rawGst, { reviewer: ' A. Partner, Partner ', today });
    expect(topic).toMatchObject({
      status: 'published',
      reviewedBy: 'A. Partner, Partner',
      reviewedAt: today,
      version: before.version + 1,
    });
    // Content is untouched; the file is 2-space JSON with a trailing newline.
    expect(topic.body).toEqual(before.body);
    expect(json.endsWith('}\n')).toBe(true);
    expect(json).toBe(`${JSON.stringify(JSON.parse(json), null, 2)}\n`);
    expect(topicSchema.safeParse(JSON.parse(json)).success).toBe(true);
  });

  it('unpublish goes back to draft, keeps the reviewer history and bumps the version', () => {
    const published = publishTopicJson(rawGst, { reviewer: 'A. Partner, Partner', today });
    const { topic } = unpublishTopicJson(published.json);
    expect(topic.status).toBe('draft');
    expect(topic.reviewedBy).toBe('A. Partner, Partner');
    expect(topic.version).toBe(published.topic.version + 1);
  });

  it('aborts on invalid topic JSON without writing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ask-topic-'));
    const file = path.join(dir, 'broken.json');
    const broken = JSON.stringify({ ...JSON.parse(rawGst), citations: [] });
    writeFileSync(file, broken);
    const write = () => {
      const { json } = publishTopicJson(readFileSync(file, 'utf8'), { reviewer: 'A. Partner, Partner', today });
      writeFileSync(file, json);
    };
    expect(write).toThrow(/does not pass the schema, nothing was written/);
    expect(readFileSync(file, 'utf8')).toBe(broken);
    expect(() => publishTopicJson('{ not json', { reviewer: 'A. Partner, Partner', today })).toThrow(/not valid JSON/);
  });
});

describe('library "Updated" badge after a publish', () => {
  it('a copy saved before the publish shows as updated', async () => {
    const { isLibraryItemUpdated } = await import('@/lib/ask/library');
    const { getTopic } = await import('@/lib/ask/topics');
    const savedVersion = (JSON.parse(rawGst) as { version: number }).version;
    expect(getTopic('gst-basics')).toMatchObject({ status: 'published', version: savedVersion + 1 });
    expect(isLibraryItemUpdated({ topicSlug: 'gst-basics', sourceVersion: savedVersion })).toBe(true);
    expect(isLibraryItemUpdated({ topicSlug: 'gst-basics', sourceVersion: savedVersion + 1 })).toBe(false);
  });
});

describe('field help review', () => {
  const source = [
    'export const FIELD_HELP = {',
    "  'pre-15:din': { text: 'Directors who already hold a DIN reuse it.', reviewed: false },",
    "  'pre-15:hasDsc': { text: \"It's needed to sign.\", reviewed: false },",
    '};',
  ].join('\n');

  it('accepts step.field and step:field', () => {
    expect(fieldHelpKey('pre-15.din')).toBe('pre-15:din');
    expect(fieldHelpKey('pre-15:din')).toBe('pre-15:din');
    expect(() => fieldHelpKey('din')).toThrow(TopicPublishError);
  });

  it('publishes one line only, with reviewer and date, and can take it back', () => {
    const next = setFieldHelpReview(source, 'pre-15.din', { reviewer: "K. O'Brien, Partner", today });
    const lines = next.split('\n');
    expect(lines[1]).toBe(
      "  'pre-15:din': { text: 'Directors who already hold a DIN reuse it.', reviewed: true, reviewedBy: 'K. O\\'Brien, Partner', reviewedAt: '2026-10-01' },",
    );
    expect(lines[2]).toBe(source.split('\n')[2]);
    expect(setFieldHelpReview(next, 'pre-15.din', null)).toBe(source);
  });

  it('refuses without a reviewer or for an unknown field', () => {
    expect(() => setFieldHelpReview(source, 'pre-15.din', { reviewer: '', today })).toThrow(/reviewer is required/);
    expect(() => setFieldHelpReview(source, 'pre-15.nope', { reviewer: 'A. Partner', today })).toThrow(/No field-help line/);
  });

  it('works on the real field-help file without changing any other line', () => {
    const real = readFileSync(path.join(process.cwd(), 'src/data/ask/field-help.ts'), 'utf8');
    const next = setFieldHelpReview(real, 'pre-15.din', { reviewer: 'A. Partner, Partner', today });
    const changed = next.split('\n').filter((line, i) => line !== real.split('\n')[i]);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toContain("reviewed: true, reviewedBy: 'A. Partner, Partner'");
  });
});
