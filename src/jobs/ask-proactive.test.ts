// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The job's steps are tested in `src/lib/ask/proactive/prepare.test.ts`; this is its wiring. */
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('the overnight job is wired up', () => {
  it('runs nightly in India time, once at a time', () => {
    const source = read('src/jobs/ask-proactive.ts');
    expect(source).toContain("'TZ=Asia/Kolkata 30 2 * * *'");
    expect(source).toContain('concurrency: { limit: 1 }');
  });

  it('is served, and is listed for the developer page', () => {
    expect(read('app/api/inngest/route.ts')).toMatch(/\baskProactive\b/);
    expect(read('src/lib/dev/jobs-registry.ts')).toMatch(/\baskProactive\b/);
  });
});
