import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext } from '@/auth/guards';

/**
 * "Remind me" uses the firm's default reminder days (G-02): the earliest day still ahead,
 * else due − 3 days when the firm saved none, else today.
 */

const INSTANCE = '33333333-3333-3333-3333-333333333303';
let due = '2026-12-31';
let inserted: Record<string, unknown> | null = null;
const systemGetReminderDays = vi.fn();

vi.mock('@/db/client', () => ({
  db: {
    select: () => {
      const chain: Record<string, unknown> = {};
      for (const k of ['from', 'where']) chain[k] = () => chain;
      chain.limit = async () => [{ id: INSTANCE, engagementId: 'e1', dueDate: due, filedOn: null, evidenceUrl: null }];
      return chain;
    },
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserted = v;
        return { onConflictDoUpdate: async () => undefined };
      },
    }),
  },
}));
vi.mock('@/db/repositories/engagements', () => ({ listScopedEngagementIds: async () => ['e1'] }));
vi.mock('@/db/repositories/firm-settings', () => ({ systemGetReminderDays: () => systemGetReminderDays() }));
vi.mock('@/db/repositories/audit-events', () => ({ recordAuditEvent: vi.fn() }));
vi.mock('@/db/repositories/notifications', () => ({ createNotificationsForUsers: vi.fn() }));
vi.mock('@/storage/s3', () => ({ bucketKey: vi.fn(), putObject: vi.fn(), signedDownloadUrl: vi.fn(), deleteObject: vi.fn() }));

const { setFilingReminder } = await import('@/db/repositories/client-compliances');
const client: AuthContext = { userId: 'u1', email: 'c@x', name: 'C', role: 'client', clientId: 'c1' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-12-01T06:00:00Z'));
  inserted = null;
  due = '2026-12-31';
});

describe('setFilingReminder', () => {
  it('takes the earliest firm reminder day still ahead', async () => {
    systemGetReminderDays.mockResolvedValue([7, 3, 1]);
    expect((await setFilingReminder(client, INSTANCE)).remindOn).toBe('2026-12-24');
    expect(inserted).toMatchObject({ remindOn: '2026-12-24' });
  });

  it('keeps due − 3 days when the firm saved no days', async () => {
    systemGetReminderDays.mockResolvedValue(null);
    expect((await setFilingReminder(client, INSTANCE)).remindOn).toBe('2026-12-28');
  });

  it('falls back to today when every day has passed', async () => {
    systemGetReminderDays.mockResolvedValue([7, 3]);
    due = '2026-12-02';
    expect((await setFilingReminder(client, INSTANCE)).remindOn).toBe('2026-12-01');
  });
});
