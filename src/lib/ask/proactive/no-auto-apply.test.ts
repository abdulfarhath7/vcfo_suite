// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * No auto-apply path exists, read from the source. Applying a card is `decideChangeset`, reached only
 * from a person's click on a route with a session. No job, no proactive code and no agent code can
 * reach it, and the proactive code cannot run an action, call a model or send an event. `prepare.test.ts`
 * proves the same at run time by watching every action's `execute`.
 */
const ROOT = process.cwd();

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const everything = [...sources('src'), ...sources('app')];
const named = (word: RegExp) => everything.filter((path) => word.test(read(path)));

describe('no automatic path to applying a card', () => {
  it('only the changeset routes can call the code that applies a card', () => {
    // A type or an error class carries no way to apply anything, so only value imports of the functions count.
    const callers = named(/import \{[^}]*\b(?:decideChangeset|undoChangeset|editChangesetRow)\b[^}]*\} from '[^']*(?:changeset\/apply|\.\/apply)'/);
    expect(callers.sort()).toEqual(['app/api/ask/changesets/[id]/decide/route.ts', 'app/api/ask/changesets/[id]/route.ts', 'app/api/ask/changesets/[id]/undo/route.ts']);
    expect(named(/from '[^']*changeset\/apply'/).filter((path) => !path.startsWith('app/api/ask/changesets/') && !path.startsWith('src/lib/ask/changeset/'))).toEqual([]);
  });

  it('the browser helpers with the same names only post to those routes', () => {
    expect(read('src/hooks/ask/ask-api.ts')).not.toMatch(/changeset\/apply/);
    expect(read('src/hooks/ask/ask-api.ts')).toMatch(/\$\{changesetUrl\(id\)\}\/decide/);
  });

  it('each of those routes needs a signed-in person, and the id of the person is the one who decides', () => {
    for (const route of ['decide', 'undo']) {
      const source = read(`app/api/ask/changesets/[id]/${route}/route.ts`);
      expect(source).toMatch(/requireAsk\(\)/);
      expect(source).toMatch(/gate\.ctx/);
    }
  });

  it('only apply.ts claims a card or changes its rows', () => {
    for (const word of [/\bclaimAskChangeset\(/, /\bupdateAskChangesetRows\(/, /\bsetAskChangesetStatus\(/]) {
      expect(named(word).filter((path) => path !== 'src/lib/ask/changeset/apply.ts' && path !== 'src/db/repositories/ask-changesets.ts')).toEqual([]);
    }
  });

  it('a new card is always proposed or held, whoever makes it', () => {
    expect(read('src/db/repositories/ask-changesets.ts')).toMatch(/status: draft\.heldReason \? 'held' : 'proposed'/);
    const inserted = /insert\(askChangesets\)[\s\S]*?\.values\(\{([\s\S]*?)\}\)/.exec(read('src/db/repositories/ask-changesets.ts'))![1]!;
    expect(inserted).not.toMatch(/status|decidedBy|appliedAt/);
  });

  it('no job can reach it', () => {
    const jobs = sources('src/jobs');
    for (const job of jobs) expect(read(job), job).not.toMatch(/changeset\/apply|decideChangeset|claimAskChangeset/);
  });

  it('the agent loop has no accept call either', () => {
    for (const file of sources('src/lib/ask/agent')) expect(read(file), file).not.toMatch(/changeset\/apply|decideChangeset|claimAskChangeset/);
  });
});

describe('the proactive code', () => {
  const own = [...sources('src/lib/ask/proactive'), 'src/jobs/ask-proactive.ts', 'src/db/repositories/ask-proactive.ts'];

  it('runs no action and undoes none', () => {
    for (const file of own) expect(read(file), file).not.toMatch(/\.execute\(|\.undo\(/);
  });

  it('calls no model and starts no other job', () => {
    for (const file of own) expect(read(file), file).not.toMatch(/getAskProvider|lib\/ask\/provider|agent\/loop|inngest\.send|ASK_RUN_START/);
  });

  it('writes to no business table: its repository only reads', () => {
    expect(read('src/db/repositories/ask-proactive.ts')).not.toMatch(/\.(?:insert|update|delete)\(/);
  });

  it('nothing outside the report reads the acceptance numbers, so autonomy cannot rise by itself', () => {
    const readers = named(/proactive\/acceptance|\.acceptance\b|acceptanceByAction|askUsageReport\(/).map((path) => relative('', path));
    expect(readers.sort()).toEqual(['app/api/ask/admin/usage/route.ts', 'src/db/repositories/ask-usage.ts', 'src/lib/ask/proactive/acceptance.ts', 'src/views/admin/ask/AskTokenUse.tsx'].sort());
  });
});
