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
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [hour, day] = await Promise.all([
    countModelAnswersSince(ctx, hourAgo),
    countModelAnswersSince(ctx, dayAgo),
  ]);
  if (hour >= limits.hour) return { ok: false, window: 'hour' };
  if (day >= limits.day) return { ok: false, window: 'day' };
  return { ok: true };
}
