'use client';

/**
 * THE PLANNER (prototype a59p: mxSumStrip, mxToolbar, mxPlannerBody, MX_RULES)
 * — one component for three pages:
 *
 *   My work        (manager, mgr-me)    your to-dos, the dates you set, what waits on you
 *   Project leads  (manager, mgr-lead)  the picked lead's work queue and calendar
 *   Tasks          (lead, lead-me)      the live My work page: list / board / timeline,
 *                                       company + kind + day filters, focus / tag links,
 *                                       J / K / Enter — plus the calendar and to-dos
 *
 * On the lead seat the filters live in the URL exactly as the live page kept
 * them (`view`, `company`, `kind`, `day`, `focus`, `tag`) and the view is
 * remembered under the live key. Manager-only controls (assigning to leads,
 * setting dates) are hidden on the lead seat, as the live views gate them.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
  INTERN_WORK_VIEW_KEY,
  createCustomInternFocus,
  internWorkMatches,
  isCustomInternFocus,
  parseInternWorkDay,
  parseInternWorkFocus,
  parseInternWorkKindFilter,
  parseInternWorkTag,
} from '@/lib/intern/intern-work';
import { useOwnFocusTodos, usePersonalTodos } from '@/hooks/use-personal-todos';
import { useConsole } from '../../../runtime';
import { Drill, Menu } from '../../../overlays';
import { Btn, Empty, Icon, hueOf as hueOfId, type IconName } from '../../../ui';
import { dShort, weekOf } from '../../today/model';
import { readSession, saveFile, shortName, writeSession, mailDraft } from './bits';
import { useBlocks, usePlan, type LeadRow, type PlanData, type PlannerWho } from './data';
import { applyFilter, csv, hoursText, summarize, T_COLOR, T_LABEL, type PlanItem, type Show } from './model';
import { Calendar } from './Calendar';
import { Board, List, Timeline, AssignBtn, TaskLine, TodoGroup } from './Views';
import { NewTodoModal, PlanWeekDrawer, type TodoApi } from './forms';
import { TaskDrawer, firstOf } from './overlays';
import '../../../css/96-work.css';

type View = 'todos' | 'tl' | 'calendar' | 'board' | 'list';
const VIEWS: Array<{ k: View; label: string; ico: IconName }> = [
  { k: 'todos', label: 'To-dos', ico: 'check' },
  { k: 'tl', label: 'Timeline', ico: 'gantt' },
  { k: 'calendar', label: 'Calendar', ico: 'cal' },
  { k: 'board', label: 'Board', ico: 'grid' },
  { k: 'list', label: 'List', ico: 'notes' },
];
const isView = (v: unknown): v is View => v === 'todos' || v === 'tl' || v === 'calendar' || v === 'board' || v === 'list';
const parseView = (v: string | null | undefined): View => (v === 'list' || v === 'board' || v === 'calendar' ? v : 'tl');
const SHOW_LABEL: Record<Show, string> = { all: 'Steps + filings', steps: 'Steps only', filings: 'Filings only' };
const NO_ITEMS: never[] = [];

export function Planner({ who, leads, empty }: { who: PlannerWho; leads: LeadRow[]; empty?: ReactNode }) {
  const { seat, me } = useConsole();
  const plan = usePlan(who);
  const lead = seat === 'lead';
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? '';

  /* ---------- view + filters (lead seat: the URL, as live; manager: this session) */
  const sessKey = who.mode === 'mgr-lead' ? 'vcfo-console-leads-view' : 'vcfo-console-work-view';
  const [mView, setMView] = useState<View>('tl');
  const [lView, setLView] = useState<View>(() => parseView(params?.get('view')));
  // Remembered views are read after the first paint (no server / browser mismatch), as the live page did.
  useEffect(() => {
    setMView(readSession(sessKey, 'tl', isView));
  }, [sessKey]);
  const urlView = params?.get('view');
  useEffect(() => {
    if (urlView) return setLView(parseView(urlView));
    try {
      const stored = window.localStorage.getItem(INTERN_WORK_VIEW_KEY);
      if (stored) setLView(parseView(stored));
    } catch {
      /* storage unavailable */
    }
  }, [urlView]);
  const [mClients, setMClients] = useState<string[]>([]);
  const [mShow, setMShow] = useState<Show>('all');
  const lClients = (params?.get('company') ?? '').split(',').filter(Boolean);
  const view: View = lead ? lView : mView === 'todos' && who.mode !== 'mgr-lead' ? 'tl' : mView;
  const clients = lead ? lClients : mClients;
  const show: Show = lead ? parseInternWorkKindFilter(params?.get('kind')) : mShow;
  const day = lead ? parseInternWorkDay(params?.get('day')) : null;
  const focus = lead ? parseInternWorkFocus(params?.get('focus')) : 'all';
  const tag = lead ? parseInternWorkTag(params?.get('tag')) : null;

  const setUrl = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(params?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || (k === 'view' && v === 'tl') || (k === 'kind' && v === 'all')) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };
  const setView = (v: View) => {
    if (lead) {
      setLView(v);
      try {
        window.localStorage.setItem(INTERN_WORK_VIEW_KEY, v);
      } catch {
        /* storage unavailable */
      }
      setUrl({ view: v });
    } else {
      setMView(v);
      writeSession(sessKey, v);
    }
  };
  const setClients = (c: string[]) => (lead ? setUrl({ company: c.join(',') || null }) : setMClients(c));
  const setShow = (s: Show) => (lead ? setUrl({ kind: s }) : setMShow(s));

  const now = useMemo(() => new Date(), []);
  const filt = (list: PlanItem[]) =>
    applyFilter(list, { clients, show, day }, plan.today).filter((i) => (focus === 'all' && !tag) || (i.work ? internWorkMatches(i.work, { focus, tag }, now) : false));
  const items = filt(plan.items);
  const boardItems = filt(plan.boardItems);

  /* ---------- to-dos */
  const own = useOwnFocusTodos(who.mode === 'mgr-lead' ? '' : me?.id ?? '', NO_ITEMS);
  const others = usePersonalTodos(who.mode === 'mgr-lead');
  const titleOf = (id: string, t?: string) => t?.trim() || plan.items.find((i) => i.id === id)?.title || 'Untitled';
  const myTodos = own.focus.filter((f) => isCustomInternFocus(f) || f.title?.trim() || plan.items.some((i) => i.id === f.id));
  const leadTodos = who.mode === 'mgr-lead' ? (others.data ?? []).filter((t) => t.ownerId === who.profileId) : [];
  const todoApi: TodoApi | undefined =
    who.mode === 'mgr-lead'
      ? undefined
      : {
          add: (t) => own.persist([...own.focus, createCustomInternFocus(t)]),
          remove: (id) => own.persist(own.focus.filter((f) => f.id !== id)),
        };

  const owner = who.mode === 'mgr-lead' ? who.profileId ?? null : me?.id ?? null;
  const sum = summarize(items, [], plan.today);

  return (
    <>
      <SumStrip who={who} owner={owner} todosOpen={who.mode === 'mgr-lead' ? leadTodos.filter((t) => !t.done).length : myTodos.filter((t) => !t.done).length} today={plan.today} sum={sum} />
      <Toolbar
        who={who}
        plan={plan}
        leads={leads}
        view={view}
        setView={setView}
        clients={clients}
        setClients={setClients}
        show={show}
        setShow={setShow}
        items={items}
        owner={owner}
        todoApi={todoApi}
      />
      {lead && (day || focus !== 'all' || tag) ? (
        <div className="mx-filters wk-chips">
          {day ? <Chip label={`Due ${dShort(day, plan.today)}`} onClear={() => setUrl({ day: null })} /> : null}
          {focus !== 'all' ? <Chip label={`Showing ${focus}`} onClear={() => setUrl({ focus: null })} /> : null}
          {tag ? <Chip label={`Tag ${tag}`} onClear={() => setUrl({ tag: null })} /> : null}
        </div>
      ) : null}
      {plan.loading && !plan.items.length ? (
        <section className="glass panel mx-p">
          <div className="sec-load">Loading the planner…</div>
        </section>
      ) : !plan.engagements.length && empty ? (
        empty
      ) : (
        <Body
          who={who}
          view={view}
          items={items}
          boardItems={boardItems}
          plan={plan}
          leads={leads}
          owner={owner}
          clients={clients}
          rail={
            <TodoCol
              who={who}
              plan={plan}
              items={items}
              leads={leads}
              clients={clients}
              mine={myTodos.map((f) => ({ id: f.id, title: titleOf(f.id, f.title), done: f.done }))}
              leadTodos={leadTodos.map((t) => ({ id: t.id, title: t.title, done: t.done }))}
              todos={todoApi}
              toggle={(id) => own.persist(own.focus.map((f) => (f.id === id ? { ...f, done: !f.done } : f)))}
              restore={(before) => own.persist(before.map((f) => ({ ...f, dbId: own.focus.some((x) => x.id === f.id) ? f.dbId : undefined })))}
              before={own.focus}
            />
          }
          calTodos={myTodos.filter((t) => !t.done).map((t) => ({ id: t.id, title: titleOf(t.id, t.title) }))}
        />
      )}
      {view === 'calendar' || view === 'tl' || who.mode !== 'mgr-lead' ? (
        <div className="mx-rules">
          <span>
            <Icon name="gantt" />
            Drag a block&apos;s edge to change its time
          </span>
          <span>
            <Icon name="grid" />
            Block colour = client
          </span>
          <span>
            <Icon name="lock" />
            Filing and manager dates are read-only
          </span>
          <span>
            <Icon name="check" />
            Done anywhere = done everywhere
          </span>
        </div>
      ) : null}
    </>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="mx-fchip">
      <b>{label}</b>
      <button type="button" className="ib x" aria-label={`Clear ${label}`} onClick={onClear}>
        <Icon name="x" />
      </button>
    </span>
  );
}

/* ================================================================ summary strip */

function SumStrip({ who, owner, todosOpen, today, sum }: { who: PlannerWho; owner: string | null; todosOpen: number; today: string; sum: ReturnType<typeof summarize> }) {
  const { openPop, openDrawer } = useConsole();
  // hours planned this week, from the calendar blocks
  const week = useWeekHours(owner, today);
  const rows = (list: PlanItem[]) =>
    list.map((i) => ({ id: i.id, title: `${i.title} · ${shortName(i.clientName)}`, meta: `${i.code} · ${i.dueLabel}`, state: T_LABEL[i.st], color: T_COLOR[i.st], onOpen: () => openDrawer(<TaskDrawer who={who} id={i.id} />) }));
  const drill = (el: Element, active: number) =>
    openPop(
      el,
      <Drill
        title="This planner"
        sub={`${sum.open.length} open${todosOpen ? ` · ${todosOpen} to-do${todosOpen === 1 ? '' : 's'}` : ''}`}
        active={active}
        tabs={[
          { label: 'Open', rows: rows(sum.open) },
          { label: 'Overdue', color: T_COLOR.over, rows: rows(sum.over) },
          { label: 'Due this week', color: T_COLOR.due, rows: rows(sum.due) },
          { label: 'Waiting on client', color: T_COLOR.wait, rows: rows(sum.wait) },
        ]}
      />,
      { cls: 'mx-wide' },
    );
  const cells: Array<{ n: string | number; l: string; tone: string; tab?: number; tip: string }> = [
    { n: sum.open.length + todosOpen, l: 'Open', tone: 'ink', tab: 0, tip: `${sum.open.length} open items${todosOpen ? ` and ${todosOpen} to-dos` : ''}` },
    { n: sum.over.length, l: 'Overdue', tone: 'over', tab: 1, tip: 'Past their due date' },
    { n: sum.due.length, l: 'Due this week', tone: 'due', tab: 2, tip: 'Due in the next 7 days' },
    { n: sum.wait.length, l: 'Waiting on client', tone: 'ice', tab: 3, tip: 'The client acts next' },
    { n: owner ? hoursText(week) : '—', l: 'On the calendar', tone: 'ok', tip: 'Hours of work blocks this week (Mon to Sun)' },
  ];
  return (
    <div className="mx-ribbon mx-sum">
      {cells.map((c) =>
        c.tab !== undefined ? (
          <button key={c.l} type="button" className={'mx-rb wk-rb ' + c.tone} title={`${c.tip} · open the list`} onClick={(e) => drill(e.currentTarget, c.tab!)}>
            <b>{c.n}</b>
            <span>{c.l}</span>
          </button>
        ) : (
          <div key={c.l} className={'mx-rb ' + c.tone} title={c.tip}>
            <b>{c.n}</b>
            <span>{c.l}</span>
          </div>
        ),
      )}
    </div>
  );
}

function useWeekHours(owner: string | null, today: string): number {
  const w = weekOf(today);
  const cal = useBlocks(owner, w[0]!, w[6]!);
  return Math.round((cal.blocks.reduce((n, b) => n + b.endMin - b.startMin, 0) / 60) * 10) / 10;
}

/* ================================================================ toolbar */

function Toolbar({
  who,
  plan,
  leads,
  view,
  setView,
  clients,
  setClients,
  show,
  setShow,
  items,
  owner,
  todoApi,
}: {
  who: PlannerWho;
  plan: PlanData;
  leads: LeadRow[];
  view: View;
  setView: (v: View) => void;
  clients: string[];
  setClients: (c: string[]) => void;
  show: Show;
  setShow: (s: Show) => void;
  items: PlanItem[];
  owner: string | null;
  todoApi?: TodoApi;
}) {
  const { openPop, openModal, openDrawer, me, toast } = useConsole();
  const views = VIEWS.filter((v) => v.k !== 'todos' || who.mode === 'mgr-lead');
  const names = useMemo(() => [...plan.engagements].sort((a, b) => a.companyName.localeCompare(b.companyName)), [plan.engagements]);
  const coLabel = clients.length === 1 ? shortName(plan.byClient[clients[0]!]?.companyName ?? 'Client') : clients.length ? `${clients.length} clients` : 'All clients';
  const leadName = (k?: string) => leads.find((l) => l.key === k)?.name ?? '';
  const exportCsv = () => {
    const rows = [['Task', 'Client', 'Lead', 'Status', 'Start', 'Due', 'Area', 'Dates set by'], ...items.map((i) => [i.title, i.clientName, leadName(i.leadKey) || (who.mode === 'mgr-lead' ? who.name : ''), T_LABEL[i.st], i.start ?? '', i.due ?? '', i.area, i.locked ? (i.lockSetBy === me?.id ? me?.name ?? 'Manager' : 'Manager') : 'Own dates'])];
    const who2 = who.mode === 'mgr-lead' ? who.name.toLowerCase().replace(/\s+/g, '-') : 'my-work';
    saveFile(`${who2}-planner.csv`, csv(rows));
    toast(`${who2}-planner.csv downloaded`);
  };
  const coMenu = (el: Element) =>
    openPop(
      el,
      <ClientMenu
        list={names.map((e) => ({ id: e.id, name: e.companyName }))}
        value={clients}
        onChange={setClients}
      />,
      { cls: 'mx-narrow' },
    );
  return (
    <div className="mx-tb mx-tbv">
      <div className="mx-vtabs" role="tablist" aria-label="Planner view">
        {views.map((v) => (
          <button key={v.k} type="button" role="tab" aria-selected={view === v.k} onClick={() => setView(v.k)}>
            <Icon name={v.ico} />
            {v.label}
          </button>
        ))}
      </div>
      <span className="mx-tbsep" />
      <button type="button" className={'btn sm' + (clients.length ? ' on' : '')} onClick={(e) => coMenu(e.currentTarget)} aria-haspopup="menu">
        <Icon name="grid" />
        {coLabel}
        <Icon name="down" size={12} />
      </button>
      <button
        type="button"
        className={'btn sm' + (show !== 'all' ? ' on' : '')}
        aria-haspopup="menu"
        onClick={(e) =>
          openPop(
            e.currentTarget,
            <Menu title="Show" items={(['all', 'steps', 'filings'] as Show[]).map((k) => ({ label: SHOW_LABEL[k], on: show === k, onSelect: () => setShow(k) }))} />,
            { cls: 'mx-narrow' },
          )
        }
      >
        <Icon name="eye" />
        {SHOW_LABEL[show]}
        <Icon name="down" size={12} />
      </button>
      <span className="sp" />
      <Btn cls="sm" ico="cal" disabled={!owner} title={owner ? undefined : 'This lead has no sign-in yet'} onClick={() => owner && openDrawer(<PlanWeekDrawer who={who} owner={owner} />)}>
        {who.mode === 'mgr-lead' ? 'Plan the week' : 'Plan my week'}
      </Btn>
      <Btn cls="sm pri" ico="up" onClick={() => openModal(<NewTodoModal who={who} leads={leads} todos={todoApi} />, { label: 'New to-do' })}>
        {who.mode === 'mgr-lead' ? 'Assign to-do' : 'New to-do'}
      </Btn>
      <button
        type="button"
        className="btn sm ic"
        aria-label="More"
        onClick={(e) => openPop(e.currentTarget, <Menu title="More" items={[{ label: 'Export', sub: 'This planner as CSV', ico: 'dl', onSelect: exportCsv }]} />, { cls: 'mx-narrow' })}
      >
        <Icon name="down" />
      </button>
    </div>
  );
}

function ClientMenu({ list, value, onChange }: { list: Array<{ id: string; name: string }>; value: string[]; onChange: (v: string[]) => void }) {
  const { closePop } = useConsole();
  const [sel, setSel] = useState(value);
  const flip = (id: string) => {
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    setSel(next);
    onChange(next);
  };
  return (
    <div className="mx-menu" role="menu">
      <div className="eyebrow">Clients</div>
      {list.length ? null : <span className="small">No clients in this planner.</span>}
      {list.map((c) => (
        <button key={c.id} type="button" role="menuitemcheckbox" aria-checked={sel.includes(c.id)} className={'mx-mi' + (sel.includes(c.id) ? ' on' : '')} onClick={() => flip(c.id)}>
          <span className="mx-dot" style={{ background: hueOfId(c.id) }} />
          <span className="mx-mt">
            <b>{shortName(c.name)}</b>
          </span>
          {sel.includes(c.id) ? <Icon name="check" /> : null}
        </button>
      ))}
      <hr />
      <button
        type="button"
        className="mx-mi"
        onClick={() => {
          onChange([]);
          closePop();
        }}
      >
        <span className="mx-mt">
          <b>Clear</b>
        </span>
      </button>
    </div>
  );
}

/* ================================================================ body */

function Body({
  who,
  view,
  items,
  boardItems,
  plan,
  leads,
  owner,
  clients,
  rail,
  calTodos,
}: {
  who: PlannerWho;
  view: View;
  items: PlanItem[];
  boardItems: PlanItem[];
  plan: PlanData;
  leads: LeadRow[];
  owner: string | null;
  clients: string[];
  rail: ReactNode;
  calTodos: Array<{ id: string; title: string }>;
}) {
  const main =
    view === 'board' ? (
      <Board who={who} items={boardItems} />
    ) : view === 'list' ? (
      <List who={who} items={items} leads={leads} showLead={who.mode === 'mgr-me'} />
    ) : view === 'calendar' ? (
      <Calendar who={who} items={items} owner={owner} clients={clients} todos={calTodos} today={plan.today} />
    ) : view === 'todos' ? (
      rail
    ) : (
      <Timeline who={who} items={items} today={plan.today} />
    );
  if (who.mode === 'mgr-lead' || view === 'board' || view === 'todos') return <>{main}</>;
  return (
    <div className="mx-wk">
      <div className="mx-wk-rail">{rail}</div>
      <div className="mx-wk-main">{main}</div>
    </div>
  );
}

/* ================================================================ to-do column */

interface TodoRow {
  id: string;
  title: string;
  done: boolean;
}

function TodoCol({
  who,
  plan,
  items,
  leads,
  clients,
  mine,
  leadTodos,
  todos,
  toggle,
  restore,
  before,
}: {
  who: PlannerWho;
  plan: PlanData;
  items: PlanItem[];
  leads: LeadRow[];
  clients: string[];
  mine: TodoRow[];
  leadTodos: TodoRow[];
  todos?: TodoApi;
  toggle: (id: string) => void;
  restore: (before: ReturnType<typeof useOwnFocusTodos>['focus']) => void;
  before: ReturnType<typeof useOwnFocusTodos>['focus'];
}) {
  const { seat, toast, openModal, go, base } = useConsole();
  const { updateTask, engagements } = useApp();
  const [draft, setDraft] = useState('');
  const isMe = who.mode !== 'mgr-lead';
  const locked = items.filter((i) => i.locked && i.st !== 'done');
  const tasks = items.filter((i) => i.kind === 'task' && i.st !== 'done');
  const waiting = plan.waiting.filter((i) => !clients.length || clients.includes(i.clientId));
  const rows = isMe ? mine : leadTodos;
  const openN = rows.filter((r) => !r.done).length + tasks.length;
  const lockTitle = who.mode === 'mgr-me' ? 'Dates you set' : who.mode === 'lead-me' ? 'Dates set by your manager' : 'Assigned by manager';
  return (
    <section className="glass panel mx-todos">
      <div className="ph">
        <h3>To-dos</h3>
        <span className="sp" />
        <span className="small">{`${openN} open`}</span>
      </div>
      {isMe && todos ? (
        <input
          className="mx-in"
          value={draft}
          maxLength={200}
          placeholder="Quick add · type a to-do and press Enter"
          aria-label="Quick add a to-do"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              todos.add(draft.trim());
              setDraft('');
              toast('Added to your to-dos');
            }
          }}
        />
      ) : (
        <p className="small wk-note">{`${who.mode === 'mgr-lead' ? firstOf(who.name) : 'The lead'} keeps these to-dos; use Assign to-do to hand them work.`}</p>
      )}
      <TodoGroup title={lockTitle} n={locked.length}>
        {locked.length ? locked.map((i) => <TaskLine key={i.id} i={i} who={who} />) : <span className="small">None in this filter</span>}
      </TodoGroup>
      <TodoGroup title={isMe ? 'My to-dos' : `${firstOf(who.mode === 'mgr-lead' ? who.name : '')}'s own to-dos`} n={rows.filter((r) => !r.done).length + tasks.length}>
        {tasks.map((i) => (
          <div key={i.id} className="wk-trow">
            <TaskLine i={i} who={who} />
            {seat === 'mgr' && who.mode === 'mgr-me' ? (
              <AssignBtn
                leads={leads}
                label={i.title}
                onPick={(l) => {
                  const prev = i.task?.assigneeId;
                  updateTask(i.taskId!, { assigneeId: l.profileId! });
                  toast(`${i.title} assigned to ${l.name}`, () => updateTask(i.taskId!, { assigneeId: prev }));
                }}
              />
            ) : null}
          </div>
        ))}
        {rows.map((r) => (
          <div key={r.id} className={'mx-todo' + (r.done ? ' done' : '')}>
            {isMe ? (
              <button type="button" className={'mx-cb2' + (r.done ? ' on' : '')} aria-label={r.done ? `Mark ${r.title} open` : `Mark ${r.title} done`} onClick={() => toggle(r.id)}>
                {r.done ? <Icon name="check" /> : null}
              </button>
            ) : (
              <span className={'mx-cb2' + (r.done ? ' on' : ' ghost')} aria-hidden="true">
                {r.done ? <Icon name="check" /> : null}
              </span>
            )}
            <span className="mx-dt">
              <b title={r.title}>{r.title}</b>
              <span>{isMe ? 'Your to-do' : 'Their own to-do'}</span>
            </span>
            {isMe && seat === 'mgr' && todos && !r.done ? (
              <AssignBtn
                leads={leads}
                label={r.title}
                onPick={(l) => openModal(<NewTodoModal who={who} leads={leads} todos={todos} preset={{ title: r.title, lead: l.key, fromTodo: r.id }} />, { label: 'Hand a to-do to a lead' })}
              />
            ) : null}
            {isMe && todos ? (
              <button
                type="button"
                className="ib x sm"
                aria-label={`Remove ${r.title}`}
                onClick={() => {
                  const snapshot = before;
                  todos.remove(r.id);
                  toast('To-do removed', () => restore(snapshot));
                }}
              >
                <Icon name="x" />
              </button>
            ) : null}
          </div>
        ))}
        {!rows.length && !tasks.length ? <span className="small">{isMe ? 'Nothing yet. Type one above.' : 'None'}</span> : null}
      </TodoGroup>
      <TodoGroup title="Waiting on client" n={waiting.length} isNew>
        {waiting.length ? (
          waiting.map((i) => (
            <div key={i.id} className="mx-todo">
              <span className="mx-cb2 ghost" aria-hidden="true" />
              <span className="mx-dot" style={{ background: hueOfId(i.clientId) }} title={i.clientName} />
              <span className="mx-dt">
                <b title={i.title}>{i.title}</b>
                <span>{`${shortName(i.clientName)} · ${i.work?.ageLabel ? `Client · ${i.work.ageLabel}` : i.why}`}</span>
              </span>
              <button type="button" className="btn sm" title="Draft a reminder to the client in Email" onClick={() => go(mailDraft(base, engagements.find((e) => e.id === i.clientId), i.title))}>
                Send reminder
              </button>
            </div>
          ))
        ) : (
          <span className="small">Nobody owes this planner anything right now.</span>
        )}
      </TodoGroup>
      {!plan.engagements.length ? <Empty title="No clients yet" sub="Work appears here once a client is assigned." /> : null}
    </section>
  );
}
