'use client';

/**
 * NOTIFICATIONS (prototype mxRenderers.notes: a list and a reading pane), with
 * every function of the live history page (src/views/notifications):
 *   - every notification of this account, including ones cleared from the bell
 *     (marked Cleared), grouped Today / Earlier this week / Earlier;
 *   - live filters: Received / Sent and Today / This week / Earlier; plus the
 *     prototype's Unread and type filters;
 *   - opening one marks it read; its page opens inside this seat (old staff
 *     links are moved onto it, see model.consoleHref); full IST time stamp.
 * Added on real data: Mark all read (with Undo) and Mark unread, Make a to-do
 * (your own to-dos), this month by type (donut → breakdown), and how you get
 * these (bell, email, your WhatsApp nudge state from your profile).
 */
import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useNotificationHistory } from '@/hooks/use-notification-history';
import { groupNotificationsForHistory, mergeNotificationsByCreatedAt } from '@/lib/notifications/notification-dismiss';
import { NOTIFICATION_KIND_LABEL } from '@/lib/notifications/notification-popup';
import { createCustomInternFocus } from '@/lib/intern/intern-work';
import { useOwnFocusTodos } from '@/hooks/use-personal-todos';
import { maskPhone } from '@/lib/notify/phone';
import type { AppNotification } from '@/lib/checklist/checklist-notifications';
import { useConsole, useCrumbs } from '../../runtime';
import { Drill, type DrillTab } from '../../overlays';
import { Btn, Donut, Empty, Icon, Legend, Seg, Select } from '../../ui';
import { useMarkAllRead } from './pops';
import { useMarkUnread, useOwnChannels } from './data';
import {
  NOTE_TYPES,
  NOTE_TYPE_COLOR,
  NOTE_TYPE_LABEL,
  consoleHref,
  isExternalHref,
  isSent,
  matchesNoteFilters,
  noteMeta,
  openLabel,
  stampLabel,
  typeCountsThisMonth,
  whenLabel,
  type NoteRange,
  type NoteTab,
  type NoteType,
} from './model';

const NO_ITEMS: never[] = [];
const GROUP_LABEL = { today: 'Today', week: 'Earlier this week', earlier: 'Earlier' } as const;

export function NotificationsPage() {
  useCrumbs(['Notifications']);
  const { base, go, toast, openPop } = useConsole();
  const { user, notifications, unreadNotificationCount, markNotificationRead } = useApp();
  const history = useNotificationHistory();
  const markUnread = useMarkUnread();
  const markAll = useMarkAllRead();
  const channels = useOwnChannels();
  const { focus, persist } = useOwnFocusTodos(user?.id ?? '', NO_ITEMS);
  const [tab, setTab] = useState<NoteTab>('all');
  const [type, setType] = useState<NoteType | 'any'>('any');
  const [range, setRange] = useState<NoteRange>('any');
  const [sel, setSel] = useState<string | null>(null);
  const now = Date.now();

  // History (with cleared rows), overlaid with the live inbox so read marks and new arrivals match the bell.
  const items = useMemo(() => mergeNotificationsByCreatedAt(history.data ?? [], notifications), [history.data, notifications]);
  const at = useMemo(() => new Date(now), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => items.filter((n) => matchesNoteFilters(n, { tab, type, range }, at)), [items, tab, type, range, at]);
  const groups = useMemo(() => {
    const g = groupNotificationsForHistory(filtered, at);
    return (['today', 'week', 'earlier'] as const).map((k) => ({ k, label: GROUP_LABEL[k], rows: g[k] })).filter((x) => x.rows.length);
  }, [filtered, at]);
  const selected = filtered.find((n) => n.id === sel) ?? filtered[0];
  const month = useMemo(() => typeCountsThisMonth(items, now), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const parts = NOTE_TYPES.map((t) => ({ n: month[t].length, color: NOTE_TYPE_COLOR[t], label: NOTE_TYPE_LABEL[t] }));
  const monthTotal = parts.reduce((s, p) => s + p.n, 0);

  const pick = (n: AppNotification) => {
    setSel(n.id);
    if (!n.read) markNotificationRead(n.id);
  };
  const drill = (i: number, el: Element | null) => {
    const row = (n: AppNotification) => ({
      id: n.id,
      title: n.title,
      meta: [n.companyName, whenLabel(n.createdAt, now)].filter(Boolean).join(' · '),
      state: NOTIFICATION_KIND_LABEL[n.kind],
      color: NOTE_TYPE_COLOR[noteMeta(n.kind).type],
      onOpen: () => pick(n),
    });
    const tabs: DrillTab[] = [
      { label: 'All', rows: NOTE_TYPES.flatMap((t) => month[t]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(row) },
      ...NOTE_TYPES.map((t) => ({ label: NOTE_TYPE_LABEL[t], color: NOTE_TYPE_COLOR[t], rows: month[t].map(row) })),
    ];
    const t = i >= 0 ? NOTE_TYPES[i] : undefined;
    openPop(
      el,
      <Drill
        title="Notifications · this month"
        sub={`${monthTotal} notification${monthTotal === 1 ? '' : 's'}`}
        tabs={tabs}
        active={i + 1}
        link={{ text: t ? `Show only ${NOTE_TYPE_LABEL[t]}` : 'Show every type', onClick: () => setType(t ?? 'any') }}
      />,
      { cls: 'mx-wide' },
    );
  };

  const counts = {
    all: items.length,
    unread: items.filter((n) => !n.read).length,
    received: items.filter((n) => !isSent(n)).length,
    sent: items.filter(isSent).length,
  };

  const reader = () => {
    if (!selected) return <Empty title={items.length ? 'Nothing in this view' : 'Pick a notification'} sub={items.length ? 'Try another tab, type or time.' : 'Its message and where it leads show here.'} />;
    const m = noteMeta(selected.kind);
    const href = consoleHref(selected.href, base);
    const cleared = Boolean(selected.dismissedAt);
    return (
      <>
        <div className="mx-rdh">
          <span className="mx-ni big" title={m.what}>
            <Icon name={m.icon} />
          </span>
          <div className="mx-dt">
            <span className="mx-chips">
              <span className={'pill ' + m.tone} title={m.what}>
                {NOTIFICATION_KIND_LABEL[selected.kind] ?? 'Update'}
              </span>
              <span className="small">{NOTE_TYPE_LABEL[m.type]}</span>
              {cleared ? (
                <span className="pill mut" title="Cleared from the bell; it stays here in your history">
                  Cleared
                </span>
              ) : null}
            </span>
            <h3>{selected.title}</h3>
            <span>{selected.companyName ? `About ${selected.companyName}` : 'For your account'}</span>
          </div>
          <Btn
            cls="sm"
            ico={selected.read ? 'eye' : 'check'}
            onClick={() => {
              if (!selected.read) markNotificationRead(selected.id);
              else
                void markUnread([selected.id])
                  .then(() => toast('Marked unread'))
                  .catch(() => toast('Could not mark it unread. Try again.'));
            }}
          >
            {selected.read ? 'Mark unread' : 'Mark read'}
          </Btn>
        </div>
        <div className="mx-rdb">
          <span className="eyebrow">{isSent(selected) ? 'What was sent' : 'Message'}</span>
          <p className="upd-pre">{selected.body?.trim() || 'No more detail on this one.'}</p>
          <span className="small">{stampLabel(selected.createdAt)}</span>
        </div>
        <div className="mx-rdf">
          {href ? (
            <Btn cls="pri" ico="ne" onClick={() => (isExternalHref(href) ? window.open(href, '_blank', 'noopener,noreferrer') : go(href))}>
              {openLabel(href)}
            </Btn>
          ) : null}
          <Btn
            ico="up"
            onClick={() => {
              persist([...focus, createCustomInternFocus(`${selected.title}${selected.companyName ? ` · ${selected.companyName}` : ''}`.slice(0, 200))]);
              toast('Added to your to-dos');
            }}
          >
            Make a to-do
          </Btn>
        </div>
      </>
    );
  };

  const wa = channels.data;
  return (
    <>
      <div className="sec-h">
        <h2>Notifications</h2>
        <span className="sec-count">{unreadNotificationCount} unread</span>
        <span className="sp" />
        <Btn cls="sm" ico="check" disabled={!unreadNotificationCount} onClick={markAll}>
          Mark all read
        </Btn>
      </div>
      <div className="mx-rd">
        <section className="glass mx-rdl" aria-label="Notification list">
          <div className="mx-rdtabs">
            <Seg<NoteTab>
              className="sm wrap"
              ariaLabel="Show notifications"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'all', label: 'All', n: counts.all },
                { value: 'unread', label: 'Unread', n: counts.unread },
                { value: 'received', label: 'Received', n: counts.received },
                { value: 'sent', label: 'Sent', n: counts.sent },
              ]}
            />
          </div>
          <div className="upd-filters">
            <Select<NoteType | 'any'> label="Type" value={type} onChange={setType} options={[['any', 'Every type'], ...NOTE_TYPES.map((t) => [t, NOTE_TYPE_LABEL[t]] as [NoteType, string])]} />
            <Select<NoteRange>
              label="When"
              value={range}
              onChange={setRange}
              options={[
                ['any', 'Any time'],
                ['today', 'Today'],
                ['week', 'This week'],
                ['earlier', 'Earlier'],
              ]}
            />
          </div>
          <div className="mx-rdls">
            {history.isError ? (
              <div className="upd-err" role="alert">
                Your notifications could not load.{' '}
                <button type="button" className="link" onClick={() => void history.refetch()}>
                  Try again
                </button>
              </div>
            ) : history.isLoading ? (
              <p className="small upd-pad">Loading notifications…</p>
            ) : groups.length ? (
              groups.map((g) => (
                <div key={g.k} className="upd-col">
                  <div className="mx-rdg">{g.label}</div>
                  {g.rows.map((n) => {
                    const m = noteMeta(n.kind);
                    return (
                      <button
                        key={n.id}
                        type="button"
                        className={'mx-rdi' + (n.read ? '' : ' un') + (selected?.id === n.id ? ' on' : '')}
                        aria-current={selected?.id === n.id ? 'true' : undefined}
                        onClick={() => pick(n)}
                      >
                        <span className="mx-ni" title={m.what}>
                          <Icon name={m.icon} />
                        </span>
                        <span className="mx-dt">
                          <b className="upd-ell" title={n.title}>
                            {n.title}
                          </b>
                          <span className="upd-ell">{[n.companyName, whenLabel(n.createdAt, now), n.dismissedAt ? 'Cleared' : null].filter(Boolean).join(' · ')}</span>
                        </span>
                        {!n.read ? <i className="mx-ud" title="Unread" /> : null}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              <Empty
                title={items.length ? 'Nothing in this view' : 'No notifications yet'}
                sub={items.length ? 'Try another tab, type or time.' : 'Client submissions, uploads, team changes and official updates land here.'}
              />
            )}
          </div>
        </section>
        <section className="glass mx-reader" aria-live="polite">
          {history.isLoading ? <p className="small">Loading…</p> : reader()}
          <div className="mx-rdx">
            <div>
              <div className="mx-sub-h">
                <span className="eyebrow">This month · by type</span>
              </div>
              {monthTotal ? (
                <div className="mx-ts">
                  <Donut parts={parts} size={104} onPick={(i, el) => drill(i, el)} center={[monthTotal, 'this month']} />
                  <Legend parts={parts} onPick={(i) => drill(i, null)} />
                </div>
              ) : (
                <span className="small">Nothing has arrived this month yet.</span>
              )}
            </div>
            <div>
              <div className="mx-sub-h">
                <span className="eyebrow">How you get these</span>
              </div>
              <div className="mx-qi">
                <span className="mx-ni">
                  <Icon name="bell" />
                </span>
                <span className="mx-dt">
                  <b>In the tool</b>
                  <span>Every notification, the same minute, in the bell</span>
                </span>
              </div>
              <div className="mx-qi">
                <span className="mx-ni">
                  <Icon name="mail" />
                </span>
                <span className="mx-dt">
                  <b>Email</b>
                  <span className="upd-ell" title={wa?.email}>
                    {wa?.email ? `${wa.email} · process updates on your clients; email stays the record` : 'Process updates on your clients; email stays the record'}
                  </span>
                </span>
              </div>
              <div className="mx-qi">
                <span className="mx-ni">
                  <Icon name="chat" />
                </span>
                <span className="mx-dt">
                  <b>WhatsApp</b>
                  <span>
                    {channels.isLoading
                      ? 'Loading…'
                      : channels.isError
                        ? 'Could not read your settings'
                        : wa?.whatsappOptIn && wa.phoneE164
                          ? `On · ${maskPhone(wa.phoneE164)} · a short nudge that mirrors the email`
                          : 'Off · add your number and agree in Settings to get a nudge'}
                  </span>
                </span>
              </div>
              <button type="button" className="link" onClick={() => go(`${base}/settings`)}>
                Change in Settings
                <Icon name="chev" size={14} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
