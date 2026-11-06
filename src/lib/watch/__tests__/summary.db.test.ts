// @vitest-environment node
import '../../../../scripts/load-env';

import { randomUUID } from 'node:crypto';
import { inArray, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/client';
import { notifications, profiles } from '@/db/schema';
import { regUpdates } from '@/db/schema-watch';
import { systemSendSummaryOnce } from '@/db/repositories/reg-updates';

/**
 * The daily summary on a real Postgres: the bell rows and `notified_at` commit together. Run it with
 * `ASK_ACTIONS_DB=1 npx vitest run src/lib/watch/__tests__/summary.db.test.ts`; a plain `npm run test`
 * skips it because CI has no database. It removes the rows it adds.
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe.skipIf(!process.env.ASK_ACTIONS_DB)('The daily summary on the real database', () => {
  const mark = `summary-test-${randomUUID()}`;
  let ids: string[] = [];
  let userId: string;

  const rowFor = (user: string) => ({ userId: user, kind: 'watch.update' as const, title: mark, body: mark, engagementId: '', companyName: '', href: '/x' });
  const sent = () => db.select({ id: notifications.id }).from(notifications).where(like(notifications.title, `${mark}%`));
  const stamped = async () => (await db.select({ at: regUpdates.notifiedAt }).from(regUpdates).where(inArray(regUpdates.id, ids))).filter((row) => row.at).length;

  beforeAll(async () => {
    const [person] = await db.select({ id: profiles.id }).from(profiles).limit(1);
    userId = person!.id;
    const rows = await db
      .insert(regUpdates)
      .values([1, 2].map((n) => ({ title: `${mark} ${n}`, intake: 'manual', status: 'published', importance: 'normal', publishedAt: new Date() })))
      .returning({ id: regUpdates.id });
    ids = rows.map((row) => row.id);
  });

  afterAll(async () => {
    await db.delete(notifications).where(like(notifications.title, `${mark}%`));
    await db.delete(regUpdates).where(inArray(regUpdates.id, ids));
  });

  it('stamps nothing when the bell rows cannot be written, so the retry still sends', async () => {
    await expect(systemSendSummaryOnce(() => [rowFor(randomUUID())])).rejects.toThrow();
    expect(await stamped()).toBe(0);
    expect(await sent()).toHaveLength(0);
  });

  it('sends once though two runs start together, and a later run finds nothing', async () => {
    const runs = await Promise.all([systemSendSummaryOnce(() => [rowFor(userId)]), systemSendSummaryOnce(() => [rowFor(userId)])]);
    expect(await sent()).toHaveLength(1);
    expect(runs.map((run) => run.rows).sort()).toEqual([0, 1]);
    expect(await stamped()).toBe(2);
    expect(await systemSendSummaryOnce(() => [rowFor(userId)])).toEqual({ updates: 0, rows: 0 });
    expect(await sent()).toHaveLength(1);
  });
});
