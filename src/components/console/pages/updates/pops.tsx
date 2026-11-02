'use client';

/**
 * The two top-bar pop-overs (prototype #mx-bell, #mx-annb), with every
 * function of the live NotificationsBell / AnnouncementsBell:
 *
 * Notifications — Received / Sent tabs with "count · new", the latest 16 by
 * day (Today / Yesterday / Earlier), a received row marks read and reopens
 * its card, a sent row opens its detail in place, clear one row, Mark all read
 * (now with Undo), Clear today / this week / all (Undo puts them back),
 * Notification history, Get these on WhatsApp (Settings).
 *
 * Announcements — All / Important / General, the latest 16, a row marks read
 * and reopens its card, New announcement (managers and admins), All
 * announcements.
 */
import { Fragment, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { notificationsInDirection, type AppNotification, type NotificationDirection } from '@/lib/checklist-notifications';
import { notificationsMatchingClearScope, type NotificationClearScope } from '@/lib/notification-dismiss';
import { requestNotificationPopup } from '@/lib/notification-popup';
import { announcementMatchesFilter, canWriteAnnouncements, requestAnnouncementPopup, type AnnouncementListFilter } from '@/lib/announcements';
import { useAnnouncements } from '@/lib/use-announcements';
import { useConsole } from '../../runtime';
import { PopHead } from '../../overlays';
import { Empty, GoArrow, Icon } from '../../ui';
import { AnnRow, ComposeModal } from './bits';
import { useAnnouncementReads, useMarkUnread } from './data';
import { bellDay, clearCopy, isSent, noteMeta, whenLabel } from './model';

const byNewest = (a: AppNotification, b: AppNotification) => b.createdAt.localeCompare(a.createdAt);

/** Mark all read with an Undo that puts exactly those rows back to unread. */
export function useMarkAllRead() {
  const { notifications, markAllNotificationsRead } = useApp();
  const { toast } = useConsole();
  const markUnread = useMarkUnread();
  return () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    markAllNotificationsRead();
    toast(ids.length === 1 ? '1 notification marked read' : `${ids.length} notifications marked read`, () =>
      void markUnread(ids).catch(() => toast('Could not undo. Mark them unread one by one on Notifications.')),
    );
  };
}

export function NotesPop() {
  const { notifications, unreadNotificationCount, markNotificationRead, dismissNotifications, restoreNotifications } = useApp();
  const { closePop, toast, go, base } = useConsole();
  const markAll = useMarkAllRead();
  const [tab, setTab] = useState<NotificationDirection>('received');
  const [openId, setOpenId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string[]>([]);
  const now = Date.now();

  const counts = useMemo(() => {
    const c = { received: 0, sent: 0, receivedNew: 0, sentNew: 0 };
    for (const n of notifications) {
      if (isSent(n)) {
        c.sent += 1;
        if (!n.read) c.sentNew += 1;
      } else {
        c.received += 1;
        if (!n.read) c.receivedNew += 1;
      }
    }
    return c;
  }, [notifications]);
  const tabItems = useMemo(() => [...notificationsInDirection(notifications, tab)].sort(byNewest), [notifications, tab]);
  const shown = tabItems.slice(0, 16);
  const at = new Date(now);
  const todayN = notificationsMatchingClearScope(tabItems, 'today', at).length;
  const weekN = notificationsMatchingClearScope(tabItems, 'week', at).length;

  const clear = (items: AppNotification[], msg: string) => {
    if (!items.length) return;
    dismissNotifications(items);
    toast(msg, () => restoreNotifications(items));
  };
  const clearScope = (scope: NotificationClearScope) => {
    const batch = notificationsMatchingClearScope(tabItems, scope, new Date());
    closePop();
    clear(batch, clearCopy(scope, batch.length, tab));
  };
  const clearOne = (n: AppNotification) => {
    setLeaving((l) => [...l, n.id]);
    window.setTimeout(() => {
      setLeaving((l) => l.filter((x) => x !== n.id));
      clear([n], 'Notification cleared');
    }, 220);
  };
  const open = (n: AppNotification) => {
    if (!n.read) markNotificationRead(n.id);
    if (isSent(n)) {
      setOpenId((c) => (c === n.id ? null : n.id));
      return;
    }
    closePop();
    requestNotificationPopup(n);
  };

  const tabs: Array<{ k: NotificationDirection; label: string; n: number; fresh: number }> = [
    { k: 'received', label: 'Received', n: counts.received, fresh: counts.receivedNew },
    { k: 'sent', label: 'Sent', n: counts.sent, fresh: counts.sentNew },
  ];

  return (
    <div className="upd-pop">
      <PopHead title="Notifications" sub={unreadNotificationCount ? `${unreadNotificationCount} unread` : 'All read'} />
      <div className="mx-dtabs" role="tablist" aria-label="Show notifications">
        {tabs.map((t) => (
          <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} aria-pressed={tab === t.k} title={`${t.n} ${t.k} · ${t.fresh} unread`} onClick={() => setTab(t.k)}>
            {t.label}
            <b>{t.fresh ? `${t.n} · ${t.fresh} new` : t.n}</b>
          </button>
        ))}
      </div>
      <div className="mx-drows upd-nrows">
        {shown.length ? (
          shown.map((n, i) => {
            const meta = noteMeta(n.kind);
            const day = bellDay(n.createdAt, now);
            const sent = isSent(n);
            const expanded = openId === n.id;
            const line = [sent ? n.body : null, n.companyName || null, whenLabel(n.createdAt, now)].filter(Boolean).join(' · ');
            return (
              <Fragment key={n.id}>
                {i === 0 || bellDay(shown[i - 1]!.createdAt, now) !== day ? <div className="mx-rdg">{day}</div> : null}
                <div className={'mx-nrow upd-nrow' + (n.read ? '' : ' un') + (leaving.includes(n.id) ? ' upd-out' : '')}>
                  <button type="button" className="upd-nmain" aria-expanded={sent ? expanded : undefined} onClick={() => open(n)}>
                    <span className="mx-ni" title={meta.what}>
                      <Icon name={meta.icon} />
                    </span>
                    <span className="mx-dt">
                      <b className="upd-ell" title={n.title}>
                        {n.title}
                      </b>
                      <span className={expanded ? 'upd-pre' : 'upd-ell'} title={expanded ? undefined : line}>
                        {expanded ? n.body || line : line}
                      </span>
                    </span>
                    {!n.read ? <i className="mx-ud" title="Unread" /> : null}
                  </button>
                  <button type="button" className="ib x sm" aria-label={`Clear from the bell: ${n.title}`} title="Clear from the bell (it stays in your history)" onClick={() => clearOne(n)}>
                    <Icon name="x" />
                  </button>
                </div>
              </Fragment>
            );
          })
        ) : tab === 'sent' ? (
          <Empty title="No email sent yet" sub="Emails the tool sends for you are confirmed here." />
        ) : (
          <Empty title="Nothing here yet" sub="Client submissions, uploads, team changes and official updates land here." />
        )}
      </div>
      {unreadNotificationCount || tabItems.length ? (
        <div className="mx-bacts">
          {unreadNotificationCount ? (
            <button type="button" className="btn sm" onClick={() => { closePop(); markAll(); }}>
              Mark all read
            </button>
          ) : null}
          {todayN ? (
            <button type="button" className="btn sm" onClick={() => clearScope('today')}>
              Clear today
            </button>
          ) : null}
          {weekN ? (
            <button type="button" className="btn sm" onClick={() => clearScope('week')}>
              Clear this week
            </button>
          ) : null}
          {tabItems.length ? (
            <button type="button" className="btn sm" aria-label={`Clear all ${tab} notifications`} onClick={() => clearScope('all')}>
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="pop-foot">
        <button type="button" className="link" onClick={() => { closePop(); go(`${base}/settings`); }}>
          <Icon name="chat" size={15} />
          Get these on WhatsApp
        </button>
        <span className="sp" />
        <GoArrow label="Notification history" onClick={() => { closePop(); go(`${base}/notifications`); }} />
      </div>
    </div>
  );
}

export function AnnsPop() {
  const { user } = useApp();
  const { closePop, go, base, openModal } = useConsole();
  const list = useAnnouncements();
  const { readIds, markRead } = useAnnouncementReads(user?.id);
  const [tab, setTab] = useState<AnnouncementListFilter>('all');
  const items = list.data?.announcements ?? [];
  const unread = items.filter((a) => !readIds.has(a.id)).length;
  const visible = items.filter((a) => announcementMatchesFilter(a.kind, tab)).slice(0, 16);
  const canWrite = canWriteAnnouncements(user?.role);
  const tabs: Array<[AnnouncementListFilter, string]> = [
    ['all', 'All'],
    ['important', 'Important'],
    ['general', 'General'],
  ];
  return (
    <div className="upd-pop">
      <PopHead title="Announcements" sub={list.isLoading ? 'Loading…' : unread ? `${unread} unread` : 'All read'} />
      <div className="mx-dtabs" role="tablist" aria-label="Show announcements">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} aria-pressed={tab === k} title={k === 'important' ? 'Deadline and Compliance' : undefined} onClick={() => setTab(k)}>
            {l}
            <b>{items.filter((a) => announcementMatchesFilter(a.kind, k)).length}</b>
          </button>
        ))}
      </div>
      <div className="mx-drows">
        {list.isError ? (
          <p className="upd-err" role="alert">
            Announcements could not load.{' '}
            <button type="button" className="link" onClick={() => void list.refetch()}>
              Try again
            </button>
          </p>
        ) : list.isLoading ? (
          <p className="small upd-pad">Loading announcements…</p>
        ) : visible.length ? (
          visible.map((a) => (
            <AnnRow
              key={a.id}
              a={a}
              compact
              unread={!readIds.has(a.id)}
              onOpen={() => {
                markRead([a.id]);
                closePop();
                requestAnnouncementPopup(a);
              }}
            />
          ))
        ) : (
          <Empty
            title={tab === 'important' ? 'No important announcements' : tab === 'general' ? 'No general announcements' : 'No announcements yet'}
            sub="Firm news and approved official updates show here."
          />
        )}
      </div>
      <div className="pop-foot">
        {canWrite ? (
          <button type="button" className="btn sm" onClick={() => openModal(<ComposeModal />, { label: 'New announcement' })}>
            <Icon name="mega" />
            New announcement
          </button>
        ) : null}
        <span className="sp" />
        <GoArrow label="All announcements" onClick={() => { closePop(); go(`${base}/announcements`); }} />
      </div>
    </div>
  );
}
