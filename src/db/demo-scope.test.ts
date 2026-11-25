// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PLAN H2: `db` sends each query to the main pool, or to the demo pool inside a demo scope
 * (src/db/demo-scope.ts, src/db/client.ts). `pg` is replaced by a fake whose pools record the
 * database they were made for and every statement they ran.
 */
type Call = { database: string; text: string };
const calls: Call[] = [];
const made: string[] = [];

vi.mock('pg', () => {
  const dbOf = (cfg: { connectionString?: string; database?: string } | undefined) =>
    cfg?.database ?? (cfg?.connectionString ? new URL(cfg.connectionString).pathname.slice(1) : '(none)');
  class Pool {
    database: string;
    constructor(cfg?: { connectionString?: string; database?: string }) {
      this.database = dbOf(cfg);
      made.push(this.database);
    }
    async query(q: string | { text: string }) {
      calls.push({ database: this.database, text: typeof q === 'string' ? q : q.text });
      return { rows: [], rowCount: 0, fields: [], command: 'SELECT' };
    }
    async connect() {
      const database = this.database;
      return {
        query: async (q: string | { text: string }) => {
          calls.push({ database, text: typeof q === 'string' ? q : q.text });
          return { rows: [], rowCount: 0, fields: [], command: 'SELECT' };
        },
        release: () => undefined,
      };
    }
  }
  return { Pool, default: { Pool } };
});

// The Next.js server installs this global before any request storage is made; do the same here.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = (await import('node:async_hooks')).AsyncLocalStorage;
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/vcfo_main_test';
delete process.env.DB_SECRET_ARN;

const { sql } = await import('drizzle-orm');
const { db } = await import('./client');
const { runInDemo, runInMain, isDemoScope, demoDbName } = await import('./demo-scope');

const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external');
const { encode } = await import('next-auth/jwt');

const ran = () => calls.map((c) => c.database);

beforeEach(() => {
  calls.length = 0;
  delete process.env.DEMO_DB_NAME;
});

describe('demo scope routing', () => {
  it('outside any scope, queries go to the main database', async () => {
    expect(await isDemoScope()).toBe(false);
    await db.execute(sql`select 1`);
    expect(ran()).toEqual(['vcfo_main_test']);
  });

  it('inside runInDemo, queries go to the demo database (default vcfo_demo)', async () => {
    await runInDemo(async () => {
      expect(await isDemoScope()).toBe(true);
      await db.execute(sql`select 1`);
      await db.execute(sql`select 2`);
    });
    expect(ran()).toEqual(['vcfo_demo', 'vcfo_demo']);
  });

  it('the scope follows awaits, timers and un-awaited promises started inside it', async () => {
    let later: Promise<unknown> = Promise.resolve();
    await runInDemo(async () => {
      await new Promise((r) => setTimeout(r, 5));
      later = new Promise((r) => setTimeout(r, 5)).then(() => db.execute(sql`select 'later'`));
    });
    await later;
    expect(ran()).toEqual(['vcfo_demo']);
  });

  it('nested scopes: the innermost wins, and the outer one comes back', async () => {
    await runInDemo(async () => {
      await db.execute(sql`select 'demo 1'`);
      await runInMain(async () => {
        await db.execute(sql`select 'main'`);
      });
      await db.execute(sql`select 'demo 2'`);
    });
    await db.execute(sql`select 'outside'`);
    expect(ran()).toEqual(['vcfo_demo', 'vcfo_main_test', 'vcfo_demo', 'vcfo_main_test']);
  });

  it('a transaction stays on the pool it started on', async () => {
    await runInDemo(() =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select 'in tx'`);
        // Even a main scope inside the callback does not move the open transaction.
        await runInMain(() => tx.execute(sql`select 'still in tx'`));
      }),
    );
    expect(calls.map((c) => [c.database, c.text.toLowerCase()])).toEqual([
      ['vcfo_demo', 'begin'],
      ['vcfo_demo', "select 'in tx'"],
      ['vcfo_demo', "select 'still in tx'"],
      ['vcfo_demo', 'commit'],
    ]);
  });

  it('two scopes running at once do not mix', async () => {
    await Promise.all([
      runInDemo(async () => {
        await new Promise((r) => setTimeout(r, 3));
        await db.execute(sql`select 'd'`);
      }),
      runInMain(async () => {
        await db.execute(sql`select 'm'`);
      }),
    ]);
    expect(calls.map((c) => `${c.database}:${c.text}`).sort()).toEqual(["vcfo_demo:select 'd'", "vcfo_main_test:select 'm'"]);
  });

  it('DEMO_DB_NAME picks the demo database; off refuses instead of using the main one', async () => {
    process.env.DEMO_DB_NAME = 'vcfo_demo_other';
    await runInDemo(() => db.execute(sql`select 1`));
    expect(ran()).toEqual(['vcfo_demo_other']);

    calls.length = 0;
    process.env.DEMO_DB_NAME = 'off';
    const err = await runInDemo(() => db.execute(sql`select 1`)).then(
      () => null,
      (e: Error & { cause?: Error }) => e,
    );
    // drizzle wraps the pool's error as "Failed query"; the cause is the refusal.
    expect(String(err?.cause?.message ?? err?.message)).toMatch(/switched off/);
    expect(calls).toEqual([]);
  });

  it('reads DEMO_DB_NAME strictly', () => {
    expect(demoDbName({})).toBe('vcfo_demo');
    expect(demoDbName({ DEMO_DB_NAME: 'demo_2' })).toBe('demo_2');
    for (const off of ['', ' ', 'off', 'OFF', 'false', '0', 'none', 'bad-name', 'x;drop']) {
      expect(demoDbName({ DEMO_DB_NAME: off })).toBeNull();
    }
  });

  it('makes the demo pool only when a demo query first runs', () => {
    expect(made.filter((d) => d.startsWith('vcfo_demo')).length).toBeGreaterThan(0);
    expect(made.filter((d) => d === 'vcfo_demo').length).toBe(1);
  });
});

describe('lazy query builders', () => {
  it('a builder returned from the scope still runs inside it', async () => {
    await runInDemo(() => db.execute(sql`select 'lazy'`));
    await runInMain(() => db.execute(sql`select 'lazy main'`));
    expect(ran()).toEqual(['vcfo_demo', 'vcfo_main_test']);
  });
});

describe('the request scope comes from the session token', () => {
  const secret = 'test-secret-for-demo-scope-0123456789';
  const inRequest = <T>(cookie: string, fn: () => Promise<T>) =>
    workUnitAsyncStorage.run({ type: 'request', headers: new Headers({ cookie }) } as never, fn);
  const cookieFor = async (name: string, claims: Record<string, unknown>) =>
    `${name}=${await encode({ token: { sub: 'u1', role: 'intern', ...claims }, secret, salt: name })}`;

  beforeEach(() => {
    process.env.AUTH_SECRET = secret;
  });

  it('a demo token makes every query of the request go to the demo database', async () => {
    const cookie = await cookieFor('authjs.session-token', { demo: true });
    await inRequest(cookie, async () => {
      expect(await isDemoScope()).toBe(true);
      await db.execute(sql`select 'page'`);
      await db.execute(sql`select 'more'`);
    });
    expect(ran()).toEqual(['vcfo_demo', 'vcfo_demo']);
  });

  it('the secure cookie name works too', async () => {
    const cookie = await cookieFor('__Secure-authjs.session-token', { demo: true });
    expect(await inRequest(cookie, () => isDemoScope())).toBe(true);
  });

  it('a real token, no cookie, or a forged token stays on the main database', async () => {
    const real = await cookieFor('authjs.session-token', {});
    expect(await inRequest(real, () => isDemoScope())).toBe(false);
    expect(await inRequest('', () => isDemoScope())).toBe(false);
    const forged = `authjs.session-token=${await encode({ token: { sub: 'u1', demo: true }, secret: 'another-secret-0123456789abcdef', salt: 'authjs.session-token' })}`;
    expect(await inRequest(forged, () => isDemoScope())).toBe(false);
    await inRequest(real, () => db.execute(sql`select 'real'`).then(() => undefined));
    expect(ran()).toEqual(['vcfo_main_test']);
  });

  it('an explicit scope wins over the request (sign-in with the other kind of email)', async () => {
    const cookie = await cookieFor('authjs.session-token', { demo: true });
    await inRequest(cookie, () => runInMain(() => db.execute(sql`select 'sign-in'`)));
    expect(ran()).toEqual(['vcfo_main_test']);
  });
});
