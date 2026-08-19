import { describe, expect, it } from 'vitest';
import type { AppNotification } from '@/lib/checklist-notifications';
import {
  isPersistedNotificationId,
  mergeNotificationsByCreatedAt,
  parseNotificationIds,
  parseRestoreNotifications,
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
    ...patch,
  };
}

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
