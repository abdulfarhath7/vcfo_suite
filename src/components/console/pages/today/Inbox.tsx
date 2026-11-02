'use client';

/**
 * Inbox (prototype mxInbox — triage, my to-dos and waiting on, as tabs of one
 * panel), built on what the tool really has:
 *
 *   Unread       the prototype's "Triage" (client mails, MCA mails) has no
 *                source; its nearest real source is the manager's unread
 *                notifications (client submissions, uploads, official updates
 *                to review). Open, Make a to-do and Mark read are real; Snooze
 *                has no backing and is left out.
 *   My to-dos    the old dashboard's to-do card, through the same hook
 *                (`useOwnFocusTodos`): add, tick, remove, kept in the browser
 *                and on the server exactly as before. "From Focus" pins a
 *                Focus item as a to-do.
 *   Team to-dos  the old dashboard's team to-do list: your leads' open to-dos.
 *   Waiting on   the Focus items held by a client or MCA, with how long.
 */
import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { notificationDirection, type AppNotification } from '@/lib/checklist/checklist-notifications';
import { createCustomInternFocus, isCustomInternFocus } from '@/lib/intern/intern-work';
import { groupOpenPersonalTodosByOwner } from '@/lib/intern/personal-todos';
import { useOwnFocusTodos, usePersonalTodos } from '@/hooks/use-personal-todos';
import { ROLE_UI_LABEL } from '@/lib/auth';
import { Empty, Icon, LeadAv, Panel, Seg } from '../../ui';
import { Menu } from '../../overlays';
import { useConsole } from '../../runtime';
import { CDot } from './bits';
import { HOLDER_LABEL, age, dShort, istDay, personInitials, plural, type TodayModel } from './model';

type Tab = 'new' | 'todo' | 'team' | 'wait';
const NO_ITEMS: never[] = [];
const SHOW = 4;

const KIND: Partial<Record<AppNotification['kind'], { color: string; what: string }>> = {
  'checklist.submit': { color: 'var(--due)', what: 'A client submitted a step for review' },
  'regulatory.review': { color: 'var(--due)', what: 'An official update waits for your review' },
  'request.uploaded': { color: 'var(--mx-run)', what: 'A client uploaded a document' },
  'regulatory.approved': { color: 'var(--mx-ok)', what: 'An official update was approved' },
};
const OTHER = { color: 'var(--ink-3)', what: 'An update on a client' };

function when(iso: string, today: string): string {
  const day = istDay(iso);
  if (!day) return '';
  if (day !== today) return dShort(day, today);
  const d = new Date(Date.parse(iso) + 5.5 * 3600e3);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}

export function Inbox({ m }: { m: TodayModel }) {
  const { go, base, me, openPop, toast } = useConsole();
  const { notifications, markNotificationRead } = useApp();
  const [tab, setTab] = useState<Tab>('new');
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open');
  const [draft, setDraft] = useState('');

  const unread = useMemo(
    () =>
      notifications
        .filter((n) => !n.read && notificationDirection(n.kind) === 'received')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notifications],
  );
  const { focus, persist } = useOwnFocusTodos(me?.id ?? '', NO_ITEMS);
  const mine = focus.filter((f) => isCustomInternFocus(f) || f.title?.trim());
  const openTodos = mine.filter((f) => !f.done);
  const list = mine.filter((f) => filter === 'all' || (filter === 'done') === f.done);
  const teamQ = usePersonalTodos(Boolean(me?.id));
  const teamGroups = useMemo(() => groupOpenPersonalTodosByOwner(teamQ.data ?? [], { viewerUserId: me?.id, excludeUserId: me?.id }), [teamQ.data, me?.id]);
  const teamOpen = teamGroups.reduce((n, g) => n + g.todos.length, 0);
  const waiting = m.kpi.wait;

  const addTodo = (title: string, note?: string) => {
    const t = title.trim();
    if (!t) return;
    persist([...focus, createCustomInternFocus(t)]);
    if (note) toast(note);
  };

  return (
    <Panel
      id="mx-inbox"
      title="Inbox"
      sub="What arrived, what you noted, what you are waiting for"
      act={
        <Seg<Tab>
          className="sm wrap"
          ariaLabel="Inbox"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'new', label: 'Unread', n: unread.length },
            { value: 'todo', label: 'My to-dos', n: openTodos.length },
            { value: 'team', label: 'Team to-dos', n: teamOpen },
            { value: 'wait', label: 'Waiting on', n: waiting.length },
          ]}
        />
      }
    >
      <div className="mx-inboxb">
        {tab === 'new' ? (
          unread.length ? (
            <>
              {unread.slice(0, SHOW).map((n) => {
                const k = KIND[n.kind] ?? OTHER;
                return (
                  <div key={n.id} className="mx-tri">
                    <i className="mx-td" style={{ background: k.color }} title={k.what} />
                    <span className="mx-dt">
                      <b className="tdy-clamp" title={n.title}>
                        {n.title}
                      </b>
                      <span>{[n.companyName, when(n.createdAt, m.today)].filter(Boolean).join(' · ')}</span>
                    </span>
                    <div className="mx-tra">
                      {n.href && n.href !== '#' ? (
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => {
                            markNotificationRead(n.id);
                            go(n.href);
                          }}
                        >
                          Open
                        </button>
                      ) : null}
                      <button type="button" className="btn sm" onClick={() => addTodo(n.title.slice(0, 200), 'Added to your to-dos')}>
                        Make a to-do
                      </button>
                      <button type="button" className="btn sm" onClick={() => markNotificationRead(n.id)}>
                        Mark read
                      </button>
                    </div>
                  </div>
                );
              })}
              {unread.length > SHOW ? (
                <button type="button" className="mx-showall" onClick={() => go(`${base}/notifications`)}>
                  {`Show all ${unread.length} unread`}
                </button>
              ) : null}
            </>
          ) : (
            <Empty title="Nothing unread" sub="Client submissions, uploads and official updates land here." />
          )
        ) : tab === 'todo' ? (
          <>
            <div className="mx-addrow">
              <input
                className="mx-in"
                value={draft}
                maxLength={200}
                placeholder="Add a to-do and press Enter"
                aria-label="New to-do"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draft.trim()) {
                    addTodo(draft);
                    setDraft('');
                  }
                }}
              />
              <Seg<'open' | 'done' | 'all'>
                className="sm"
                ariaLabel="Show to-dos"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'done', label: 'Done' },
                  { value: 'all', label: 'All' },
                ]}
              />
              <button
                type="button"
                className="btn sm"
                disabled={m.queue.length === 0}
                title={m.queue.length ? 'Pin an item from Focus as a to-do' : 'Focus is empty'}
                onClick={(e) =>
                  openPop(
                    e.currentTarget,
                    <Menu
                      title="Pin from Focus"
                      items={m.queue.slice(0, 8).map((q) => {
                        const c = m.byId[q.clientId];
                        return {
                          label: q.title,
                          sub: `${c?.short ?? ''} · ${q.status}`,
                          lead: c ? <CDot c={c} /> : undefined,
                          onSelect: () => addTodo(`${q.title} · ${c?.short ?? ''}`, 'Pinned to your to-dos'),
                        };
                      })}
                    />,
                    { cls: 'mx-narrow' },
                  )
                }
              >
                <Icon name="up" />
                From Focus
              </button>
            </div>
            {list.length ? (
              list.map((f) => (
                <div key={f.id} className={'mx-todo' + (f.done ? ' done' : '')}>
                  <button
                    type="button"
                    className={'mx-cb2' + (f.done ? ' on' : '')}
                    aria-label={f.done ? 'Mark open' : 'Mark done'}
                    onClick={() => persist(focus.map((row) => (row.id === f.id ? { ...row, done: !row.done } : row)))}
                  >
                    {f.done ? <Icon name="check" /> : null}
                  </button>
                  <span className="mx-dt">
                    <b className="tdy-clamp" title={f.title}>
                      {f.title?.trim() || 'Untitled'}
                    </b>
                  </span>
                  <button
                    type="button"
                    className="ib x sm"
                    aria-label="Remove"
                    onClick={() => {
                      const before = focus;
                      persist(focus.filter((row) => row.id !== f.id));
                      // Undo puts it back in place; the server copy was deleted, so it is created again.
                      toast('To-do removed', () => persist(before.map((row) => (row.id === f.id ? { ...row, dbId: undefined } : row))));
                    }}
                  >
                    <Icon name="x" />
                  </button>
                </div>
              ))
            ) : (
              <Empty
                title={filter === 'done' ? 'Nothing done yet' : filter === 'open' ? 'All clear' : 'No to-dos yet'}
                sub={filter === 'done' ? 'Ticked to-dos show here.' : 'Type a to-do above, or pin one from Focus.'}
              />
            )}
          </>
        ) : tab === 'team' ? (
          teamQ.isError ? (
            <span className="small">Your team&apos;s to-dos could not load.</span>
          ) : teamGroups.length ? (
            teamGroups.map((g) => (
              <div key={g.ownerId} className="tdy-tg">
                <div className="co-row">
                  <LeadAv id={g.ownerId} name={g.ownerName} initials={personInitials(g.ownerName)} sm />
                  <b>{g.ownerName}</b>
                  <span className="small">{ROLE_UI_LABEL[g.ownerRole] ?? g.ownerRole}</span>
                  <span className="sp" />
                  <span className="mx-n">{g.todos.length}</span>
                </div>
                {g.todos.map((t) => (
                  <div key={t.id} className="mx-todo">
                    <span className="mx-cb2 ghost" aria-hidden="true" />
                    <span className="mx-dt">
                      <b className="tdy-clamp" title={t.title}>
                        {t.title}
                      </b>
                    </span>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <Empty title="No open to-dos from your team" sub="Your leads' open to-dos show here as they add them." />
          )
        ) : waiting.length ? (
          waiting.map((q) => {
            const c = m.byId[q.clientId]!;
            return (
              <div key={q.id} className="mx-wt">
                <CDot c={c} />
                <span className="mx-dt">
                  <b className="tdy-ell" title={q.title}>
                    {q.title}
                  </b>
                  <span>
                    {c.short}
                    {q.code ? ` · ${q.code}` : ''}
                  </span>
                </span>
                <span className="pill mut" title={`Waiting on ${HOLDER_LABEL[q.holder]}${q.since ? ` since ${dShort(q.since, m.today)}` : ''}`}>
                  {HOLDER_LABEL[q.holder]} · {age(q.days ?? 0)}
                </span>
                <button type="button" className="btn sm" onClick={() => go(q.cta.href)}>
                  {q.cta.label}
                </button>
              </div>
            );
          })
        ) : (
          <Empty title="Nobody owes you anything" sub={`Steps waiting on a client or MCA show here · ${plural(m.queue.length, 'item')} in Focus.`} />
        )}
      </div>
    </Panel>
  );
}
