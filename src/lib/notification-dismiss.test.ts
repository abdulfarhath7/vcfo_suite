import { describe, expect, it } from 'vitest';
import type { AppNotification } from '@/lib/checklist-notifications';
import {
  formatNotificationWhen,
  groupNotificationsForHistory,
  isCreatedAtIstToday,
  isCreatedAtThisIstWeek,
  isInboxNotification,
  isPersistedNotificationId,
  mergeNotificationsByCreatedAt,
  notificationHistoryGroup,
  notificationInClearScope,
  notificationIstMondayYmd,
  notificationsMatchingClearScope,
  parseNotificationIds,
  parseRestoreNotifications,
  scopedDismissIds,
  ymdInNotificationTz,
} from '@/lib/notification-dismiss';
import { notificationsInDirection } from '@/lib/checklist-notifications';

function note(
  patch: Partial<AppNotification> & Pick<AppNotification, 'id' | 'kind'>,
): AppNotification {
  return {
    title: 'Title',
    body: 'Body',
    engagementId: 'eng-1',
    companyName: 'Acme',
    href: '/app',
    createdAt: '2026-08-19T10:00:00.000Z',
    read: false,
    dismissedAt: null,
    ...patch,
  };
}

/** Thursday 20 Aug 2026 09:00 IST — week is Mon 17 Aug–Sun 23 Aug IST. */
const nowIst = new Date('2026-08-20T09:00:00+05:30');

describe('notification dismiss helpers', () => {
  it('accepts persisted UUID ids and rejects optimistic local ids', () => {
    expect(isPersistedNotificationId('3f1c0a8e-2b4d-4c1a-9e7f-0123456789ab')).toBe(true);
    expect(isPersistedNotificationId('n1770000000-abc123')).toBe(false);
  });

  it('parses delete id batches', () => {
    expect(parseNotificationIds('a')).toEqual(['a']);
    expect(parseNotificationIds([' a ', 'b'])).toEqual(['a', 'b']);
    expect(parseNotificationIds([])).toBeNull();
    expect(parseNotificationIds(['ok', 1])).toBeNull();
  });

  it('parses restore payloads and rejects bad kinds', () => {
    const row = note({ id: 'n1', kind: 'email.sent', read: true });
    expect(parseRestoreNotifications([row])).toEqual([row]);
    expect(parseRestoreNotifications([{ ...row, kind: 'nope' }])).toBeNull();
    expect(parseRestoreNotifications([])).toEqual([]);
  });

  it('merges restored rows by recency without duplicating ids', () => {
    const older = note({
      id: 'a',
      kind: 'checklist.deliver',
      createdAt: '2026-08-19T09:00:00.000Z',
    });
    const newer = note({
      id: 'b',
      kind: 'email.sent',
      createdAt: '2026-08-19T11:00:00.000Z',
    });
    const updatedOlder = { ...older, title: 'Restored' };
    expect(mergeNotificationsByCreatedAt([older], [newer, updatedOlder]).map((n) => n.id)).toEqual([
      'b',
      'a',
    ]);
    expect(mergeNotificationsByCreatedAt([older], [updatedOlder])[0]?.title).toBe('Restored');
  });

  it('splits received vs sent for clear-all', () => {
    const received = note({ id: 'r', kind: 'checklist.submit' });
    const sent = note({ id: 's', kind: 'email.sent' });
    expect(notificationsInDirection([received, sent], 'received')).toEqual([received]);
    expect(notificationsInDirection([received, sent], 'sent')).toEqual([sent]);
  });
});

describe('IST today / this week dismiss scope', () => {
  it('keys the calendar day in Asia/Kolkata', () => {
    expect(ymdInNotificationTz(nowIst)).toBe('2026-08-20');
    expect(notificationIstMondayYmd(nowIst)).toBe('2026-08-17');
  });

  it('treats UTC instants on the IST date as today', () => {
    // 19 Aug 2026 22:30 UTC = 20 Aug 04:00 IST
    expect(isCreatedAtIstToday('2026-08-19T22:30:00.000Z', nowIst)).toBe(true);
    // 19 Aug 2026 18:00 UTC = 19 Aug 23:30 IST
    expect(isCreatedAtIstToday('2026-08-19T18:00:00.000Z', nowIst)).toBe(false);
  });

  it('counts Mon–Sun IST as this week, including today', () => {
    expect(isCreatedAtThisIstWeek('2026-08-20T03:30:00.000Z', nowIst)).toBe(true);
    expect(isCreatedAtThisIstWeek('2026-08-16T18:30:00.000Z', nowIst)).toBe(true); // Mon 17 00:00 IST
    expect(isCreatedAtThisIstWeek('2026-08-16T18:29:00.000Z', nowIst)).toBe(false); // Sun 16 23:59 IST
    expect(isCreatedAtThisIstWeek('2026-08-23T18:29:00.000Z', nowIst)).toBe(true); // Sun 23 23:59 IST
    expect(isCreatedAtThisIstWeek('2026-08-23T18:30:00.000Z', nowIst)).toBe(false); // Mon 24
  });

  it('filters clear-today vs clear-this-week vs clear-all', () => {
    const today = note({
      id: 'today',
      kind: 'checklist.submit',
      createdAt: '2026-08-19T22:30:00.000Z',
    });
    const thisWeek = note({
      id: 'week',
      kind: 'checklist.submit',
      createdAt: '2026-08-17T04:00:00.000Z',
    });
    const older = note({
      id: 'old',
      kind: 'checklist.submit',
      createdAt: '2026-08-10T04:00:00.000Z',
    });
    const items = [today, thisWeek, older];
    expect(notificationsMatchingClearScope(items, 'today', nowIst).map((n) => n.id)).toEqual([
      'today',
    ]);
    expect(notificationsMatchingClearScope(items, 'week', nowIst).map((n) => n.id)).toEqual([
      'today',
      'week',
    ]);
    expect(notificationsMatchingClearScope(items, 'all', nowIst).map((n) => n.id)).toEqual([
      'today',
      'week',
      'old',
    ]);
    expect(notificationInClearScope(older.createdAt, 'week', nowIst)).toBe(false);
  });

  it('groups history as today / rest of week / earlier without duplicating today', () => {
    const today = note({
      id: 'today',
      kind: 'email.sent',
      createdAt: '2026-08-19T22:30:00.000Z',
    });
    const restOfWeek = note({
      id: 'week',
      kind: 'email.sent',
      createdAt: '2026-08-17T04:00:00.000Z',
    });
    const earlier = note({
      id: 'old',
      kind: 'email.sent',
      createdAt: '2026-08-10T04:00:00.000Z',
    });
    expect(notificationHistoryGroup(today.createdAt, nowIst)).toBe('today');
    expect(notificationHistoryGroup(restOfWeek.createdAt, nowIst)).toBe('week');
    expect(notificationHistoryGroup(earlier.createdAt, nowIst)).toBe('earlier');
    const grouped = groupNotificationsForHistory([today, restOfWeek, earlier], nowIst);
    expect(grouped.today.map((n) => n.id)).toEqual(['today']);
    expect(grouped.week.map((n) => n.id)).toEqual(['week']);
    expect(grouped.earlier.map((n) => n.id)).toEqual(['old']);
  });
});

describe('dismiss scope vs history', () => {
  it('keeps dismissed rows in history but not the inbox', () => {
    const live = note({ id: 'live', kind: 'checklist.deliver' });
    const cleared = note({
      id: 'cleared',
      kind: 'checklist.deliver',
      dismissedAt: '2026-08-20T04:00:00.000Z',
    });
    expect(isInboxNotification(live)).toBe(true);
    expect(isInboxNotification(cleared)).toBe(false);
  });

  it('drops ids that belong to another user (cross-tenant dismiss)', () => {
    const requested = ['n1', 'n2', 'n3', 'n4'];
    const rows = [
      { id: 'n1', userId: 'user-a' },
      { id: 'n2', userId: 'user-b' },
      { id: 'n3', userId: 'user-a' },
      { id: 'n4', userId: 'user-c' },
    ];
    expect(scopedDismissIds(requested, 'user-a', rows)).toEqual(['n1', 'n3']);
    expect(scopedDismissIds(requested, 'user-b', rows)).toEqual(['n2']);
    expect(scopedDismissIds(['n2'], 'user-a', rows)).toEqual([]);
  });

  it('formats relative time then IST calendar date', () => {
    expect(formatNotificationWhen('2026-08-20T03:29:30.000Z', nowIst)).toBe('Just now');
    expect(formatNotificationWhen('2026-08-10T00:00:00.000Z', nowIst)).toMatch(/Aug/);
  });
});
