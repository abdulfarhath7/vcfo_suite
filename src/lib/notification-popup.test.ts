import { afterEach, describe, expect, it } from 'vitest';
import type { AppNotification } from '@/lib/checklist-notifications';
import {
  NOTIFICATION_LIVE_POLL_MS,
  NOTIFICATION_LIVE_POPUP_CAP,
  NOTIFICATION_SHOW_EVENT,
  addNotificationPopupIds,
  notificationPopupStorageKey,
  requestNotificationPopup,
  selectNotificationPopups,
} from '@/lib/notification-popup';

function note(
  patch: Partial<AppNotification> & Pick<AppNotification, 'id' | 'kind'>,
): AppNotification {
  return {
    title: 'Title',
    body: 'Body',
    engagementId: 'eng-1',
    companyName: 'Acme',
    href: '/app',
    createdAt: '2026-08-24T10:00:00.000Z',
    read: false,
    dismissedAt: null,
    ...patch,
  };
}

const uuid = (n: number) => `3f1c0a8e-2b4d-4c1a-9e7f-01234567890${n}`;

afterEach(() => {
  window.localStorage.clear();
});

describe('notification live popup', () => {
  it('keys popup storage per user', () => {
    expect(notificationPopupStorageKey('user-1')).toBe('vcfo.notifications.popup.user-1');
  });

  it('polls on the same cadence as announcements', () => {
    expect(NOTIFICATION_LIVE_POLL_MS).toBe(4_000);
  });

  it('does not rewrite popup storage when no new ids were added', () => {
    const userId = 'user-stable';
    addNotificationPopupIds(userId, [uuid(1)]);
    const writes: string[] = [];
    const original = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = ((key: string, value: string) => {
      writes.push(key);
      original(key, value);
    }) as typeof localStorage.setItem;
    addNotificationPopupIds(userId, [uuid(1)]);
    window.localStorage.setItem = original;
    expect(writes).toEqual([]);
  });

  it('on first visit seeds received inbox ids and does not replay history', () => {
    const items = [
      note({ id: uuid(1), kind: 'checklist.submit' }),
      note({ id: uuid(2), kind: 'request.created' }),
      note({ id: uuid(3), kind: 'email.sent' }),
      note({ id: 'n1770000000-abc123', kind: 'checklist.review' }),
    ];
    const { queue, seedIds } = selectNotificationPopups({ items, poppedIds: null });
    expect(queue).toEqual([]);
    expect(seedIds).toEqual([uuid(1), uuid(2)]);
  });

  it('after init, queues only new received persisted ids', () => {
    const items = [
      note({ id: uuid(1), kind: 'checklist.submit' }),
      note({ id: uuid(2), kind: 'docs.share' }),
      note({ id: uuid(3), kind: 'email.sent' }),
      note({ id: uuid(4), kind: 'request.uploaded', dismissedAt: '2026-08-24T11:00:00.000Z' }),
    ];
    const { queue, seedIds } = selectNotificationPopups({
      items,
      poppedIds: new Set([uuid(1)]),
    });
    expect(queue.map((row) => row.id)).toEqual([uuid(2)]);
    expect(seedIds).toEqual([uuid(2)]);
    expect(queue.length).toBeLessThanOrEqual(NOTIFICATION_LIVE_POPUP_CAP);
  });

  it('does not auto-popup outbound email rows', () => {
    const items = [
      note({ id: uuid(1), kind: 'email.sent' }),
      note({ id: uuid(2), kind: 'email.failed' }),
    ];
    const { queue } = selectNotificationPopups({
      items,
      poppedIds: new Set(),
    });
    expect(queue).toEqual([]);
  });

  it('requestNotificationPopup always fires a show event, even for already-popped ids', () => {
    const item = note({ id: uuid(9), kind: 'team.assigned' });
    let seen: string | null = null;
    const onShow = (event: Event) => {
      seen = (event as CustomEvent<{ notification: AppNotification }>).detail.notification.id;
    };
    window.addEventListener(NOTIFICATION_SHOW_EVENT, onShow);
    requestNotificationPopup(item);
    window.removeEventListener(NOTIFICATION_SHOW_EVENT, onShow);
    expect(seen).toBe(uuid(9));
  });
});
