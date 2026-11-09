// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// drizzle-orm's migrator reads only the newest created_at it has applied and runs a migration
// only when its `when` is later. A migration whose `when` is earlier than one before it, or two
// files sharing a number, is skipped on any database that already ran the other one.
const dir = path.resolve(__dirname, 'migrations');
const journal = JSON.parse(readFileSync(path.join(dir, 'meta/_journal.json'), 'utf8')) as {
  entries: { idx: number; when: number; tag: string }[];
};

describe('migration journal', () => {
  it('numbers every entry in order with a later timestamp than the one before', () => {
    journal.entries.forEach((entry, i) => {
      expect(entry.idx).toBe(i);
      expect(entry.tag.startsWith(String(i).padStart(4, '0') + '_')).toBe(true);
      if (i > 0) expect(entry.when).toBeGreaterThan(journal.entries[i - 1].when);
      expect(existsSync(path.join(dir, `${entry.tag}.sql`))).toBe(true);
    });
  });

  it('has exactly one SQL file per journal entry', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => f.slice(0, -4)).sort();
    expect(files).toEqual(journal.entries.map((e) => e.tag).sort());
  });
});
