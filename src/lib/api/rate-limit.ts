/**
 * In-memory per-user rate limit.
 *
 * ⚠️ TODO before scaling: replace with Upstash Redis (or similar distributed
 * store). On Vercel Serverless, each cold-start resets this Map — the limit
 * is not enforced across concurrent function instances.
 * See: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

function checkRateLimit(bucketKey: string, userId: string): boolean {
  const key = `${bucketKey}:${userId}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) {
    return false;
  }

  entry.count += 1;
  return true;
}

export function checkWelcomeEmailRateLimit(userId: string): boolean {
  return checkRateLimit('welcome-email', userId);
}

export function checkInternCreateRateLimit(userId: string): boolean {
  return checkRateLimit('intern-create', userId);
}
