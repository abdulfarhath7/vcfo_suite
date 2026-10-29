import 'server-only';
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { requireDeveloper, type AuthContext } from '@/auth/guards';

/**
 * Shared shape for every `app/api/dev/**` handler: the developer guard, query validation
 * with zod (400 on bad input), no caching, and a plain 500 that never echoes a secret.
 */
export async function devRoute<Q>(
  request: Request,
  schema: ZodType<Q>,
  handler: (ctx: AuthContext, query: Q) => Promise<unknown>,
): Promise<NextResponse> {
  const guard = await requireDeveloper();
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
