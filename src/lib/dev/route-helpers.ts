import 'server-only';
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { requireAuth, requireDeveloper, requireDeveloperOrToken, type AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';

/**
 * Shared shape for every `app/api/dev/**` read: the developer guard (or a personal API
 * token, read only), query validation
 * with zod (400 on bad input), no caching, and a plain 500 that never echoes a secret.
 */
export async function devRoute<Q>(
  request: Request,
  schema: ZodType<Q>,
  handler: (ctx: AuthContext, query: Q) => Promise<unknown>,
): Promise<NextResponse> {
  // Reads also take a personal API token (Access › API tokens); writes below never do.
  const guard = await requireDeveloperOrToken(request);
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'invalid_query' }, { status: 400 });
  }

  try {
    const body = await handler(guard.ctx, parsed.data);
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.warn('[dev-console]', request.method, url.pathname, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}

/** What a console write handler returns: a status and a JSON body without secrets. */
export type DevActionResult = { status: number; body: Record<string, unknown> };

/**
 * Shared shape for a console write (POST under `app/api/dev/**`, R-40): the developer guard,
 * a JSON body checked with zod (400 on bad input), no caching, and a plain 500 that never
 * echoes a secret. The handler writes its own audit row, because only it knows the outcome.
 * A signed-in person without the developer role gets 403 and a `dev.action.denied` row.
 */
export async function devAction<B>(
  request: Request,
  schema: ZodType<B>,
  handler: (ctx: AuthContext, body: B) => Promise<DevActionResult>,
): Promise<NextResponse> {
  const guard = await requireDeveloper();
  if (guard.ok === false) {
    if (guard.status === 403) await auditDenied(new URL(request.url).pathname);
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'invalid_body' }, { status: 400 });
  }

  try {
    const out = await handler(guard.ctx, parsed.data);
    return NextResponse.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.warn('[dev-console]', request.method, new URL(request.url).pathname, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'action_failed' }, { status: 500 });
  }
}

/** Write the `denied` audit row for a console write tried by someone without the role. */
async function auditDenied(path: string): Promise<void> {
  const who = await requireAuth();
  if (who.ok === false) return;
  await recordAuditEvent(who.ctx, {
    action: 'dev.action.denied',
    summary: `Console change refused: ${path.replace(/^\/api\/dev\//, '')}`,
    metadata: { path },
    result: 'denied',
  });
}
