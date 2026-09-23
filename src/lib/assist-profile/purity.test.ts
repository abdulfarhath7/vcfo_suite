import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/** `src/lib/assist-profile/` is pure: no db, no S3, no React, no fetch. */
const DIR = path.resolve(import.meta.dirname);
const FORBIDDEN = [
  /from ['"]@\/db\//,
  /from ['"]@\/storage\//,
  /from ['"]@aws-sdk\//,
  /from ['"]react['"]/,
  /from ['"]next\//,
  /from ['"]server-only['"]/,
  /\bfetch\(/,
];

describe('assist-profile purity', () => {
  const sources = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  it('has the module files', () => {
    expect(sources).toEqual(expect.arrayContaining(['build.ts', 'types.ts', 'vocabulary.ts']));
  });

  it.each(sources)('%s imports nothing impure', (file) => {
    const text = readFileSync(path.join(DIR, file), 'utf8');
    for (const pattern of FORBIDDEN) expect(text, `${file} matches ${pattern}`).not.toMatch(pattern);
  });
});
