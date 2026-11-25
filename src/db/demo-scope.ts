import { AsyncLocalStorage } from 'node:async_hooks';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { getToken } from 'next-auth/jwt';
import { authSecrets } from '@/auth/secrets';

/**
 * DEMO SCOPE (PLAN H2, docs/context/notes/demo-data.md "Demo logins").
 *
 * The demo logins live in their own database (`DEMO_DB_NAME`, default `vcfo_demo`) on the same
 * Postgres server. `src/db/client.ts` asks `isDemoScope()` before every query and every
 * transaction and sends it to the demo pool when the answer is true. Nothing above the
 * repositories needs to know.
 *
 * The answer comes from, in order:
 *   1. An explicit scope: `runInDemo(fn)` or `runInMain(fn)`. Sign-in uses it (an email on the
 *      demo domain is checked only in the demo database, any other email only in the main one),
 *      so do Inngest jobs whose event carries `demo: true`, and the demo seed scripts.
 *   2. The current Next.js request: a request whose session cookie holds a token with
 *      `demo: true` is a demo request, from its first query to its last (route handlers, server
 *      components, server actions and `after()` work alike). The token is decoded once per
 *      request. Nothing has to "enter" the scope, so no query can run against the main
 *      database before it is known that the request is a demo one.
 *   3. Otherwise the main database (scripts, cron jobs, signed-out pages).
 *
 * Fail closed: when the demo database is switched off (`DEMO_DB_NAME=off` or empty) a demo
 * scope still answers true, and `client.ts` then refuses the query instead of using the main
 * database.
 *
 * The state is kept on `globalThis` because the Next.js dev server can load this module more
 * than once (one copy per route bundle), and every copy must see the same scope.
 */

type Scope = { demo: boolean };
type State = { als: AsyncLocalStorage<Scope>; requests: WeakMap<object, Promise<boolean>> };

const g = globalThis as unknown as { __vcfoDemoScope?: State };
const state: State = (g.__vcfoDemoScope ??= { als: new AsyncLocalStorage<Scope>(), requests: new WeakMap() });

/**
 * Run `fn` against the demo database, whatever the request or the caller's scope says.
 *
 * The result is awaited INSIDE the scope. A drizzle query builder is lazy: it runs when it is
 * awaited, so `runInDemo(() => db.select()…)` would otherwise run after the scope had ended.
 */
export function runInDemo<T>(fn: () => T | PromiseLike<T>): Promise<T> {
  return state.als.run({ demo: true }, async () => await fn());
}

/** Run `fn` against the main database, whatever the request says (sign-in with a real email). */
export function runInMain<T>(fn: () => T | PromiseLike<T>): Promise<T> {
  return state.als.run({ demo: false }, async () => await fn());
}

/** Run `fn` in the demo or the main scope. */
export function runInScope<T>(demo: boolean, fn: () => T | PromiseLike<T>): Promise<T> {
  return demo ? runInDemo(fn) : runInMain(fn);
}

/** The explicit scope, if any (no request lookup). */
export function explicitDemoScope(): boolean | undefined {
  return state.als.getStore()?.demo;
}

/** The demo database name, or null when demo logins are switched off. */
export function demoDbName(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.DEMO_DB_NAME;
  if (raw === undefined) return 'vcfo_demo';
  const name = raw.trim();
  if (!name || /^(off|false|0|none|disabled)$/i.test(name)) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
  return name;
}

/** True when demo logins can be used (the demo database is configured). */
export function demoEnabled(): boolean {
  return demoDbName() !== null;
}

/** Thrown when a demo query cannot reach the demo database. Never falls back to the main one. */
export class DemoScopeUnavailableError extends Error {
  constructor() {
    super('Demo logins are switched off (DEMO_DB_NAME).');
    this.name = 'DemoScopeUnavailableError';
  }
}

const COOKIE_NAMES = ['__Secure-authjs.session-token', 'authjs.session-token'] as const;

/** True when the request's session token says `demo: true`. */
async function tokenSaysDemo(headers: Headers): Promise<boolean> {
  const cookie = headers.get('cookie') ?? '';
  if (!cookie.includes('authjs.session-token')) return false;
  const secret = authSecrets();
  if (!secret.length) return false;
  for (const cookieName of COOKIE_NAMES) {
    if (!cookie.includes(`${cookieName}=`) && !cookie.includes(`${cookieName}.0=`)) continue;
    const token = await getToken({
      req: { headers },
      secret,
      cookieName,
      salt: cookieName,
      secureCookie: cookieName.startsWith('__Secure-'),
      logger: { error: () => undefined, warn: () => undefined, debug: () => undefined } as never,
    }).catch(() => null);
    if (token) return (token as { demo?: unknown }).demo === true;
  }
  return false;
}

/** The Next.js request store of the current call, or null outside a request. */
function requestStore(): { headers: Headers } | null {
  try {
    const store = workUnitAsyncStorage.getStore() as { type?: string; headers?: Headers } | undefined;
    if (!store || store.type !== 'request' || !store.headers) return null;
    return store as { headers: Headers };
  } catch {
    return null;
  }
}

/**
 * True when the current call belongs to the demo world. Cheap after the first call in a request:
 * the decision is kept per request.
 */
export async function isDemoScope(): Promise<boolean> {
  const explicit = state.als.getStore();
  if (explicit) return explicit.demo;
  const store = requestStore();
  if (!store) return false;
  let decision = state.requests.get(store);
  if (!decision) {
    decision = tokenSaysDemo(store.headers);
    state.requests.set(store, decision);
  }
  return decision;
}

/**
 * The data an Inngest event sent from the current scope carries: `{ demo: true }` inside a demo
 * scope, nothing otherwise. Used by the Inngest client middleware (src/jobs/client.ts).
 */
export async function demoEventData(): Promise<{ demo: true } | Record<string, never>> {
  return (await isDemoScope()) ? { demo: true } : {};
}
