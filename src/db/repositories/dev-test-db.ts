import type { SQL } from 'drizzle-orm';

/**
 * Test double for `@/db/client` shared by the `dev-*.test.ts` files. Every query builder
 * method returns the same chain, the captured WHERE is kept for inspection, and awaiting the
 * chain resolves the next queued result. Use it with
 * `vi.mock('@/db/client', async () => (await import('./dev-test-db')).mockDbModule)`.
 */

export type DevCall = { op: string; where?: SQL; sql?: unknown };

export const devDb = {
  calls: [] as DevCall[],
  results: [] as unknown[],
  reset() {
    this.calls.length = 0;
    this.results.length = 0;
  },
};

function chain(call: DevCall): unknown {
  const target = {};
  const proxy: unknown = new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') {
        return (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(devDb.results.length ? devDb.results.shift() : []).then(res, rej);
      }
      if (prop === 'where') {
        return (w: SQL) => {
          call.where = w;
          return proxy;
        };
      }
      // A subquery's columns are read as properties (`sub.n`); return a harmless stand-in.
      if (prop === 'as') return () => proxy;
      return () => proxy;
    },
  });
  return proxy;
}

function op(name: string) {
  return (arg?: unknown) => {
    const call: DevCall = { op: name, sql: arg };
    devDb.calls.push(call);
    if (name === 'execute') {
      return Promise.resolve(devDb.results.length ? devDb.results.shift() : { rows: [] });
    }
    return chain(call);
  };
}

export const mockDbModule = {
  db: { select: op('select'), insert: op('insert'), update: op('update'), delete: op('delete'), execute: op('execute') },
};
