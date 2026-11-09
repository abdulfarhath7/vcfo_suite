// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A chat request has 120 seconds. The SDK's own retries would start attempts the request never
 * waits for, which the API may bill while the usage records count only finished calls, so every
 * model call made while a person waits asks for none.
 */
const REQUEST_PATH = ['src/lib/ask/guard.ts', 'src/lib/ask/generate.ts', 'src/lib/ask/data-router/read.ts', 'src/lib/ask/data-router/choose.ts', 'src/lib/ask/do/pick.ts', 'src/lib/ask/agent/loop.ts'];

describe('model calls while a person waits', () => {
  it.each(REQUEST_PATH)('%s asks the SDK for no retries', (file) => {
    const source = readFileSync(path.resolve(__dirname, '../../../..', file), 'utf8');
    const calls = source.split(/\.complete\(\{/).slice(1).map((rest) => rest.slice(0, rest.indexOf('});')));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toContain('maxRetries: 0');
  });
});
