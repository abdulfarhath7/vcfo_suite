/**
 * Test-only chain stub for the work repositories' `db` mock (the same shape as the
 * stub in `document-requests.test.ts`). Each `db.select / insert / update / delete`
 * records a call, and awaiting the chain resolves the next queued result.
 * Imported only by `*.test.ts` files.
 */
import type { SQL } from 'drizzle-orm';

export type StubCall = { op: string; where?: SQL; values?: unknown; set?: unknown };

export function createDbStub() {
  const calls: StubCall[] = [];
  const state: { results: unknown[][] } = { results: [] };

  function chain(call: StubCall): unknown {
    const c: Record<string, unknown> = {
      from: () => c,
      innerJoin: () => c,
      leftJoin: () => c,
      orderBy: () => c,
      limit: () => c,
      returning: () => c,
      onConflictDoNothing: () => c,
      set: (s: unknown) => {
        call.set = s;
        return c;
      },
      where: (w: SQL) => {
        call.where = w;
        return c;
      },
      values: (v: unknown) => {
        call.values = v;
        return c;
      },
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(state.results.shift() ?? []).then(res, rej),
    };
    return c;
  }
  const op = (name: string) => () => {
    const call: StubCall = { op: name };
    calls.push(call);
    return chain(call);
  };
  const db = { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete') };
  return {
    db,
    calls,
    queue: (...rows: unknown[][]) => {
      state.results.push(...rows);
    },
    reset: () => {
      calls.length = 0;
      state.results = [];
    },
    writes: () => calls.filter((c) => c.op !== 'select'),
  };
}

/** One shared stub per test file (each Vitest file gets its own module registry). */
export const workDbStub = createDbStub();
