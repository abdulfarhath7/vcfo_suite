// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

let counts = { hour: 0, day: 0 };
vi.mock('@/db/repositories/ask-messages', () => ({
  countModelAnswersSince: async (_ctx: unknown, since: Date) => (Date.now() - since.getTime() > 2 * 3_600_000 ? counts.day : counts.hour),
}));
const { checkAskRateLimit, demoAskLimits } = await import('./rate-limit');
const real = { userId: 'u', email: 'a@sbcllp.in', name: 'A', role: 'intern' as const };
const demo = { ...real, email: 'lead@vcfosuite.com', demo: true };

describe('Ask VCFO cap for demo logins', () => {
  it('uses the tighter demo cap, never above the normal limits', () => {
    expect(demoAskLimits({ hour: 30, day: 200 }, {})).toEqual({ hour: 10, day: 40 });
    expect(demoAskLimits({ hour: 5, day: 20 }, {})).toEqual({ hour: 5, day: 20 });
    expect(demoAskLimits({ hour: 30, day: 200 }, { ASK_DEMO_RATE_LIMIT_DAY: '15' })).toEqual({ hour: 10, day: 15 });
  });

  it('stops a demo login at the demo daily cap while a real person goes on', async () => {
    counts = { hour: 2, day: 40 };
    expect(await checkAskRateLimit(demo, { hour: 30, day: 200 })).toEqual({ ok: false, window: 'day' });
    expect(await checkAskRateLimit(real, { hour: 30, day: 200 })).toEqual({ ok: true });
  });
});
