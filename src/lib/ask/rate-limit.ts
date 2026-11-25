import 'server-only';

import type { AuthContext } from '@/auth/guards';
import { countModelAnswersSince } from '@/db/repositories/ask-messages';

/**
 * Postgres-count limiter (shared across App Runner instances, unlike the
 * in-memory helper in src/lib/api/rate-limit.ts). Only model-backed answers
 * count; suggestions and reviewed topics are free.
 */
export async function checkAskRateLimit(
  ctx: AuthContext,
  limits: { hour: number; day: number },
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; window: 'hour' | 'day' }> {
  const lim = ctx.demo ? demoAskLimits(limits) : limits;
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [hour, day] = await Promise.all([
    countModelAnswersSince(ctx, hourAgo),
    countModelAnswersSince(ctx, dayAgo),
  ]);
  if (hour >= lim.hour) return { ok: false, window: 'hour' };
  if (day >= lim.day) return { ok: false, window: 'day' };
  return { ok: true };
}

/**
 * Demo logins (src/lib/demo-logins.ts) are shared by everyone who has the password, so their
 * cap is tighter: `ASK_DEMO_RATE_LIMIT_HOUR` (default 10) and `ASK_DEMO_RATE_LIMIT_DAY`
 * (default 40) model answers per demo account, never above the normal limits.
 */
export function demoAskLimits(limits: { hour: number; day: number }, env: Record<string, string | undefined> = process.env): { hour: number; day: number } {
  const n = (v: string | undefined, d: number) => {
    const x = Number.parseInt(v ?? '', 10);
    return Number.isFinite(x) && x >= 0 ? x : d;
  };
  return {
    hour: Math.min(limits.hour, n(env.ASK_DEMO_RATE_LIMIT_HOUR, 10)),
    day: Math.min(limits.day, n(env.ASK_DEMO_RATE_LIMIT_DAY, 40)),
  };
}
