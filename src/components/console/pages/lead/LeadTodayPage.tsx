'use client';

/**
 * LEAD · TODAY (prototype a59_lead.js renderLead today part, lead_body.txt
 * #lsec-today): date and week pill, greeting, a one-line summary, six counts,
 * Today's queue (Today / This week / Waiting) with an item card, Client health
 * with a client card, This week, plus what the live lead Today keeps: the
 * to-do card with pins from the queue, the managers with an email link, and
 * the doors into My work (`?focus=`, `?day=`, `?company=`).
 *
 * Numbers come from the shared Today model (seat 'lead'), so they agree with
 * the manager's. Team task statuses change through the app's `updateTask`;
 * "Email manager again" re-sends a lead's approval request exactly as live.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { useApp } from '@/context/AppContext';
import { fmtL } from '@/components/portal/dates';
import { internLeadManagerRequestPatch } from '@/lib/checklist/checklist-item-review';
import { createCustomInternFocus, isCustomInternFocus } from '@/lib/intern/intern-work';
import { useInternPortfolio } from '@/hooks/use-intern-portfolio';
import { useOwnFocusTodos } from '@/hooks/use-personal-todos';
import { SecLoading } from '@/components/portal/ui';
import { Btn, Empty, GoArrow, Icon, Panel, Seg, hueOf } from '../../ui';
import { Menu, PopHead } from '../../overlays';
import { useConsole, useCrumbs } from '../../runtime';
import {
  HEALTH_LABEL,
  HOLDER_LABEL,
  age,
  dShort,
  firstName,
  isoWeek,
  plural,
  weekday,
  type Health,
  type TClient,
  type TodayModel,
} from '../today/model';
import { greetingIst } from '../today/bits';
import { DESK_KIND_LABEL, dueText, type DeskItem } from './desk';
import { useLeadBadges, useLeadDesk, useLeadManagers, useLeadReviews } from './useLead';
import '../../css/96-today.css';
import '../../css/96-lead.css';

type Tab = 'today' | 'week' | 'wait';
const HEALTH_PILL: Record<Health, string> = { stuck: 'over', risk: 'due', new: 'mut', ok: 'ok' };
const STATE_DOT: Record<DeskItem['state'], string> = {
  over: 'var(--over)',
  due: 'var(--due)',
  you: 'var(--mx-run)',
  wait: 'var(--mx-wait)',
  up: 'var(--mx-none2)',
  done: 'var(--mx-ok)',
};

function Cc({ c }: { c: Pick<TClient, 'id' | 'short' | 'name'> }) {
  return (
    <span className="cc" style={{ ['--cc' as string]: hueOf(c.id) } as CSSProperties} title={c.name}>
      <i />
      {c.short}
    </span>
  );
}

export function LeadTodayPage() {
  useCrumbs(['Today']);
  useLeadBadges();
  const { desk, model: m, loading } = useLeadDesk();
  const { items: reviews } = useLeadReviews(m);
  const { go, base, me } = useConsole();
  const [tab, setTab] = useState<Tab>('today');
  const [day, setDay] = useState('');

  const atRisk = m.clients.filter((c) => c.health === 'stuck' || c.health === 'risk');
  const dueToday = desk.today;
  const sub = loading
    ? 'Counting your clients…'
    : `${dueToday.length} need${dueToday.length === 1 ? 's' : ''} you today (${desk.kpi.overdue} overdue, ${desk.kpi.dueToday} due today) across ${plural(new Set(dueToday.map((i) => i.clientId)).size, 'client')}.${
        atRisk.length ? ` ${atRisk.map((c) => c.short).join(' and ')} need${atRisk.length === 1 ? 's' : ''} your attention first.` : ' Nothing is at risk.'
      }`;
  const filingsWeek = m.filings.filter((f) => f.st !== 'f' && f.st !== 'l' && f.days >= 0 && f.days <= 6).length;

  const kpis: Array<{ cls: string; n: number; label: string; tip: string; run: () => void }> = [
    { cls: '', n: desk.kpi.clients, label: plural(desk.kpi.clients, 'client').replace(/^\d+ /, ''), tip: 'Open your clients', run: () => go(`${base}/clients`) },
    { cls: 'a', n: desk.today.length, label: 'due today or late', tip: 'Due today or past their date · show them in the queue', run: () => setTab('today') },
    { cls: 'r', n: desk.kpi.overdue, label: 'overdue', tip: 'Late steps, filings and tasks · open My work on Overdue', run: () => go(`${base}/tasks?focus=overdue`) },
    { cls: '', n: filingsWeek, label: plural(filingsWeek, 'filing').replace(/^\d+ /, '') + ' this week', tip: 'Unfiled, due in the next 7 days · open My work on This week', run: () => go(`${base}/tasks?focus=due`) },
    { cls: 'a', n: desk.kpi.waitingClients, label: 'waiting on clients', tip: 'Show the waiting items in the queue', run: () => setTab('wait') },
    { cls: 'g', n: reviews.length, label: 'to review', tip: 'Open Reviews', run: () => go(`${base}/reviews`) },
  ];

  const list = day ? desk.items.filter((i) => !i.done && (i.due === day || (!i.due && day === m.today && i.holder === 'you'))) : tab === 'today' ? desk.today : tab === 'week' ? desk.week : desk.waiting;

  return (
    <>
      <div className="glass co-strip lead-strip">
        <div className="co-row">
          <span className="eyebrow">{fmtL(m.today).toUpperCase()}</span>
          <span className="sp" />
          <span className="pill due" title="Unfiled filings due in the next 7 days">
            Week {isoWeek(m.today)} · {plural(filingsWeek, 'filing')} due in 7 days
          </span>
        </div>
        <h1>
          {greetingIst(Date.now())}, {firstName(me?.name ?? '')}
        </h1>
        <div className="sub2">{sub}</div>
      </div>
      <div className="lkpis">
        {kpis.map((k) => (
          <button key={k.label} type="button" className={'glass lkpi ' + k.cls} title={k.tip} disabled={loading} onClick={k.run}>
            <b>{loading ? '…' : k.n}</b>
            <span>{k.label}</span>
          </button>
        ))}
      </div>
      <div className="ltoday">
        <div className="lcol">
          <Queue m={m} list={list} loading={loading} tab={tab} setTab={setTab} day={day} clearDay={() => setDay('')} counts={[desk.today.length, desk.week.length, desk.waiting.length]} />
          <Todos />
        </div>
        <div className="lcol">
          <ClientHealth m={m} desk={desk.items} loading={loading} />
          <WeekStrip m={m} day={day} setDay={setDay} />
          <Managers m={m} />
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Today's queue */

function useItemActions() {
  const { updateTask, updateItem, getStateForEngagement, tasks } = useApp();
  const { go, toast } = useConsole();
  return (m: TodayModel) => ({
    run: (i: DeskItem) => {
      if (i.cta.to === 'task' && i.taskId) {
        const t = tasks.find((x) => x.id === i.taskId);
        if (!t) return;
        const prev = t.status;
        const next = i.done ? 'in-progress' : 'completed';
        updateTask(t.id, { status: next });
        toast(i.done ? `${i.title} reopened` : `Done: ${i.title}`, () => updateTask(t.id, { status: prev }));
        return;
      }
      if (i.cta.to === 'nudge' && i.stepId) {
        const c = m.byId[i.clientId];
        if (!c) return;
        const slice = getStateForEngagement(c.e)[i.stepId];
        void updateItem(c.id, i.stepId, { ...internLeadManagerRequestPatch(slice), resendManagerEmail: true })
          .then(() => toast('Emailed manager again'))
          .catch(() => toast('Could not email the manager. Try again.'));
        return;
      }
      go(i.cta.href);
    },
    start: (i: DeskItem) => {
      if (!i.taskId) return;
      const t = tasks.find((x) => x.id === i.taskId);
      if (!t) return;
      const prev = t.status;
      updateTask(t.id, { status: 'in-progress' });
      toast(`Started: ${i.title}`, () => updateTask(t.id, { status: prev }));
    },
    status: (i: DeskItem) => tasks.find((x) => x.id === i.taskId)?.status,
  });
}

function ItemCard({ i, m }: { i: DeskItem; m: TodayModel }) {
  const { closePop, go } = useConsole();
  const acts = useItemActions()(m);
  const c = m.byId[i.clientId]!;
  const taskStatus = acts.status(i);
  return (
    <div>
      <PopHead title={i.title} sub={`${c.name} · ${DESK_KIND_LABEL[i.kind]}`} lead={<Cc c={c} />} />
      <div className="fc-grid">
        <div>
          <span>DUE</span>
          <b>{i.due ? fmtL(i.due) : 'No date'}</b>
        </div>
        <div>
          <span>WITH</span>
          <b>
            {HOLDER_LABEL[i.holder]}
            {i.holder !== 'you' && i.days !== undefined ? ` · ${age(i.days)}` : ''}
          </b>
        </div>
        <div>
          <span>STATUS</span>
          <b>{i.done ? 'Done' : i.status}</b>
        </div>
        <div>
          <span>WHY</span>
          <b>{i.why}</b>
        </div>
      </div>
      <div className="fc-acts">
        <Btn
          cls="pri"
          ico={i.cta.to === 'task' ? (i.done ? 'back' : 'check') : i.cta.to === 'mail' || i.cta.to === 'nudge' ? 'mail' : 'step'}
          onClick={() => {
            closePop();
            acts.run(i);
          }}
        >
          {i.cta.label}
        </Btn>
        {i.kind === 'task' && taskStatus === 'not-started' ? (
          <Btn
            ico="step"
            onClick={() => {
              closePop();
              acts.start(i);
            }}
          >
            Start
          </Btn>
        ) : null}
        <span className="sp" />
        <GoArrow
          label="Open client"
          onClick={() => {
            closePop();
            go(c.href);
          }}
        />
      </div>
    </div>
  );
}

function Queue({
  m,
  list,
  loading,
  tab,
  setTab,
  day,
  clearDay,
  counts,
}: {
  m: TodayModel;
  list: DeskItem[];
  loading: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  day: string;
  clearDay: () => void;
  counts: [number, number, number];
}) {
  const { openPop, go, base } = useConsole();
  const acts = useItemActions()(m);
  return (
    <section className="glass panel" id="lq-queue">
      <div className="ph">
        <h3>{day ? `Queue · ${weekday(day)} ${dShort(day, m.today)}` : "Today's queue"}</h3>
        <span className="sp" />
        {day ? (
          <button type="button" className="link" onClick={clearDay}>
            Show the whole queue
          </button>
        ) : (
          <Seg<Tab>
            className="sm"
            ariaLabel="Queue"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'today', label: 'Today', n: counts[0] },
              { value: 'week', label: 'This week', n: counts[1] },
              { value: 'wait', label: 'Waiting', n: counts[2] },
            ]}
          />
        )}
      </div>
      {loading ? (
        <SecLoading label="Loading your queue…" />
      ) : list.length === 0 ? (
        <Empty
          title={tab === 'wait' && !day ? 'Nobody is blocking you' : 'Nothing due here'}
          sub={tab === 'wait' && !day ? 'Items a client, MCA or your manager holds show here.' : 'Steps, filings and tasks with a date in this view show here.'}
        />
      ) : (
        list.map((i) => {
          const c = m.byId[i.clientId]!;
          const d = i.due ? (i.due < m.today ? 'over' : i.due === m.today ? 'today' : '') : '';
          return (
            <div key={i.id} className={'lq' + (i.done ? ' done' : '')}>
              {i.kind === 'task' ? (
                <button type="button" className="bx" aria-label={i.done ? `Reopen ${i.title}` : `Mark ${i.title} done`} onClick={() => acts.run(i)}>
                  <Icon name="check" />
                </button>
              ) : (
                <span className="tdy-lqi" style={{ background: STATE_DOT[i.state] }} title={i.status} />
              )}
              <button type="button" className="tdy-lqb" onClick={(e) => openPop(e.currentTarget, <ItemCard i={i} m={m} />)}>
                <div className="t">{i.title}</div>
                <div className="m">
                  <Cc c={c} />
                  <span className="kind">{i.code ? `${DESK_KIND_LABEL[i.kind]} · ${i.code}` : DESK_KIND_LABEL[i.kind]}</span>
                  <span className="tdy-ell">{i.why}</span>
                  {i.holder !== 'you' ? <span className="pill mut tdy-pillsm">{i.status}</span> : null}
                </div>
              </button>
              <span className={'r' + (d && !i.done ? ' ' + d : '')}>{i.done ? 'Done' : dueText(i.due, m.today)}</span>
            </div>
          );
        })
      )}
      <div className="tdy-qfoot">
        <button type="button" className="link" onClick={() => go(`${base}/tasks`)}>
          View all work
          <Icon name="chev" size={16} />
        </button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- to-dos (the live card, same hook) */

const NO_ITEMS: never[] = [];

function Todos() {
  const { user } = useApp();
  const { openPop } = useConsole();
  const { workItems } = useInternPortfolio();
  const items = workItems ?? NO_ITEMS;
  const { focus, persist, byId } = useOwnFocusTodos(user?.id ?? '', items);
  const [draft, setDraft] = useState('');
  const pickable = useMemo(() => items.filter((i) => i.kind !== 'done' && !focus.some((f) => f.id === i.id)), [items, focus]);
  const shown = focus.filter((f) => byId.has(f.id) || isCustomInternFocus(f) || f.title?.trim());
  return (
    <section className="glass panel">
      <div className="ph">
        <h3>My to-dos</h3>
        <span className="small">{shown.filter((f) => !f.done).length} open</span>
        <span className="sp" />
        {items.length ? (
          <button
            type="button"
            className="btn sm"
            disabled={!pickable.length}
            title={pickable.length ? 'Pin an item from your queue' : 'Nothing left to pin'}
            onClick={(e) =>
              openPop(
                e.currentTarget,
                <Menu
                  title="Pin from queue"
                  items={pickable.slice(0, 10).map((it) => ({ label: it.title, sub: it.companyName, onSelect: () => persist([...focus, { id: it.id, done: false, title: it.title }]) }))}
                />,
                { cls: 'mx-narrow' },
              )
            }
          >
            <Icon name="up" />
            From queue
          </button>
        ) : null}
      </div>
      <form
        className="mx-addrow"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          persist([...focus, createCustomInternFocus(t)]);
          setDraft('');
        }}
      >
        <input className="mx-in" value={draft} maxLength={200} placeholder="Type a to-do" aria-label="New to-do" onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="btn sm pri" disabled={!draft.trim()}>
          Add
        </button>
      </form>
      {shown.length === 0 ? (
        <Empty title="No to-dos yet" sub="Type one above, or pin work from your queue." />
      ) : (
        shown.map((f) => {
          const item = byId.get(f.id);
          return (
            <div key={f.id} className={'mx-todo' + (f.done ? ' done' : '')}>
              <button type="button" className={'mx-cb2' + (f.done ? ' on' : '')} aria-label={f.done ? 'Mark open' : 'Mark done'} onClick={() => persist(focus.map((r) => (r.id === f.id ? { ...r, done: !r.done } : r)))}>
                {f.done ? <Icon name="check" /> : null}
              </button>
              <span className="mx-dt">
                {item ? (
                  <a className="tdy-ell" href={item.href} title={item.title}>
                    <b>{item.title}</b>
                  </a>
                ) : (
                  <b className="tdy-ell" title={f.title}>
                    {f.title?.trim() || 'Untitled'}
                  </b>
                )}
                {item ? <span className="tdy-ell">{item.companyName}</span> : null}
              </span>
              <button type="button" className="ib x sm" aria-label="Remove from to-dos" onClick={() => persist(focus.filter((r) => r.id !== f.id))}>
                <Icon name="x" />
              </button>
            </div>
          );
        })
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- client health */

function ClientCard({ c, m, open, managerName }: { c: TClient; m: TodayModel; open: number; managerName?: string }) {
  const { go, base, closePop } = useConsole();
  const phase = c.current ? c.model.phases[c.phaseIdx] : undefined;
  const in14 = c.filings.filter((f) => f.st !== 'f' && f.st !== 'l' && f.days >= 0 && f.days <= 14).length;
  const overdue = (c.late ? 1 : 0) + c.overdue;
  const goto = (href: string) => {
    closePop();
    go(href);
  };
  return (
    <div>
      <PopHead
        title={c.name}
        sub={c.stage === 'inc' ? 'Incorporating' : 'Compliance'}
        lead={
          <span className="mono-ic" style={{ background: hueOf(c.id), color: '#fff', width: 40, height: 40, borderRadius: 12 }} aria-hidden="true">
            {c.initials}
          </span>
        }
      />
      <div className="fc-chips" style={{ marginTop: 10 }}>
        <span className={'pill ' + HEALTH_PILL[c.health]} title={c.healthWhy}>
          {HEALTH_LABEL[c.health]}
        </span>
        <span className="pill mut">{phase ? `${phase.name} · ${c.current!.title}` : `All ${c.total} steps done`}</span>
      </div>
      <div className="fc-grid">
        <div>
          <span>SET-UP</span>
          <b>
            {c.done} of {c.total} steps
          </b>
        </div>
        <div>
          <span>PROJECT MANAGER</span>
          <b>{managerName ?? 'Not set'}</b>
        </div>
        <div>
          <span>OVERDUE</span>
          <b style={overdue ? { color: 'var(--over-ink)' } : undefined}>{overdue}</b>
        </div>
        <div>
          <span>WAITING ON CLIENT</span>
          <b style={c.holder === 'client' ? { color: 'var(--due-ink)' } : undefined}>{c.holder === 'client' ? `Yes · ${age(c.heldDays ?? 0)}` : 'No'}</b>
        </div>
      </div>
      <div className="fc-now">
        <b>
          {plural(open, 'open item')} · {plural(in14, 'filing')} in 14 days
        </b>
      </div>
      <div className="fc-acts">
        <Btn cls="pri" ico="step" onClick={() => goto(`${base}/tasks?company=${encodeURIComponent(c.id)}`)}>
          Tasks
        </Btn>
        <Btn ico="calc" onClick={() => goto(`${base}/compliances/filings`)}>
          Filings
        </Btn>
        <span className="sp" />
        <GoArrow label="Open client" onClick={() => goto(c.href)} />
      </div>
    </div>
  );
}

function ClientHealth({ m, desk, loading }: { m: TodayModel; desk: DeskItem[]; loading: boolean }) {
  const { openPop, go, base } = useConsole();
  const { managers } = useLeadManagers(m);
  const rank: Record<Health, number> = { stuck: 0, risk: 1, new: 2, ok: 3 };
  const rows = [...m.clients].sort((a, b) => rank[a.health] - rank[b.health] || a.short.localeCompare(b.short));
  return (
    <section className="glass panel">
      <div className="ph">
        <h3>Client health</h3>
        <span className="sp" />
        <button type="button" className="link" onClick={() => go(`${base}/clients`)}>
          All clients
          <Icon name="chev" size={16} />
        </button>
      </div>
      {loading ? (
        <SecLoading label="Loading your clients…" />
      ) : rows.length === 0 ? (
        <Empty title="No clients in this view" sub="Clients you lead show up here." />
      ) : (
        rows.map((c) => {
          const open = desk.filter((i) => i.clientId === c.id && !i.done).length;
          const overdue = (c.late ? 1 : 0) + c.overdue;
          const s = [`${c.done}/${c.total} built`, overdue ? `${overdue} overdue` : '', c.holder === 'client' ? 'waiting on client' : ''].filter(Boolean).join(' · ');
          return (
            <button
              key={c.id}
              type="button"
              className="lh"
              title={`${c.name} · ${c.healthWhy}`}
              onClick={(e) => openPop(e.currentTarget, <ClientCard c={c} m={m} open={open} managerName={managers.find((x) => x.id === c.e.managerId)?.name} />)}
            >
              <i style={{ background: hueOf(c.id) }} />
              <div style={{ minWidth: 0 }}>
                <b className="tdy-ell">{c.short}</b>
                <span className="s tdy-ell">{s}</span>
              </div>
              <span className={'pill ' + HEALTH_PILL[c.health]}>{HEALTH_LABEL[c.health]}</span>
            </button>
          );
        })
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- this week */

function WeekStrip({ m, day, setDay }: { m: TodayModel; day: string; setDay: (d: string) => void }) {
  const { go, base } = useConsole();
  const total = m.week7.filter((w) => w.open).length;
  return (
    <section className="glass panel">
      <div className="ph">
        <h3>This week</h3>
        <span className="sp" />
        <span className="small">{plural(total, 'open item')}</span>
      </div>
      <div className="lweek">
        {m.week.map((d) => {
          const items = m.week7.filter((w) => w.day === d);
          return (
            <button
              key={d}
              type="button"
              className={'lwd' + (d === m.today ? ' td' : '') + (d === day ? ' tdy-sel' : '')}
              aria-pressed={d === day}
              title={items.length ? items.map((w) => w.title).join('\n') : `${fmtL(d)} · nothing due`}
              onClick={() => setDay(d === day ? '' : d)}
            >
              <span className="w">{weekday(d).toUpperCase()}</span>
              <span className="d">{Number(d.slice(8, 10))}</span>
              <span className="ds">
                {items.slice(0, 9).map((w) => (
                  <i key={w.id} style={{ background: hueOf(w.clientId) }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="tdy-qfoot">
        <span className="small">A dot per filing, deadline, task or closed item, in the client&apos;s colour</span>
        <span className="sp" />
        {day ? (
          <button type="button" className="link" onClick={() => go(`${base}/tasks?day=${day}`)}>
            Open in My work
            <Icon name="chev" size={16} />
          </button>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- managers (the live "My managers" card) */

function Managers({ m }: { m: TodayModel }) {
  const { go, base } = useConsole();
  const { managers, loading, error } = useLeadManagers(m);
  return (
    <section className="glass panel">
      <div className="ph">
        <h3>Your managers</h3>
      </div>
      {loading ? (
        <span className="small">Loading…</span>
      ) : error ? (
        <span className="small">Your managers could not load.</span>
      ) : managers.length === 0 ? (
        <span className="small">No manager is set on your clients yet.</span>
      ) : (
        managers.map((p) => (
          <div key={p.id} className="mx-wt">
            <span className="mx-dt">
              <b className="tdy-ell">{p.name}</b>
              <span className="tdy-ell">{p.email}</span>
            </span>
            <button type="button" className="ib sm" aria-label={`Email ${p.name}`} title={`Email ${p.name}`} onClick={() => go(`${base}/mail?to=${encodeURIComponent(p.email)}`)}>
              <Icon name="mail" />
            </button>
          </div>
        ))
      )}
    </section>
  );
}
