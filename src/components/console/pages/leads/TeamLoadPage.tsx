'use client';

/**
 * TEAM LOAD — /app/manager/team-load (prototype mxRenderers.load): your
 * project leads side by side — open work (overdue / due this week / other),
 * waiting on client, done this week, hours on the calendar this week, open
 * team tasks and the on-time rate — and a table to move a team task from one
 * lead to another (PATCH /api/tasks/:id, with Undo). Every count opens its
 * list. Below, the live People page's lists: clients and their leads, client
 * accounts and removed clients.
 */
import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { internAssignedToEngagement } from '@/lib/intern/intern-work';
import { useConsole, useCrumbs } from '../../runtime';
import { Drill } from '../../overlays';
import { Btn, Empty, Icon, LeadAv, Panel, hueOf } from '../../ui';
import { personInitials, weekOf } from '../today/model';
import { stageOf } from '../clients/model';
import { TaskDrawer, firstOf } from '../work/planner/overlays';
import { shortName, StPill } from '../work/planner/bits';
import { useBlocks, useLeadRows, usePlan, type LeadRow, type PlannerWho } from '../work/planner/data';
import { fromTask, hoursText, sortPlan, T_COLOR, T_LABEL, type PlanItem } from '../work/planner/model';
import { AddLeadModal, ClientAccounts, ClientsAndLeads } from './people';
import { onTimeFor } from './LeadsPage';
import { useLeadsBadge } from './badges';
import '../../css/96-work.css';
import '../../css/96-leads.css';

const BOOKWHO: PlannerWho = { mode: 'mgr-me' };

interface Row {
  l: LeadRow;
  items: PlanItem[];
  open: PlanItem[];
  over: PlanItem[];
  due: PlanItem[];
  wait: PlanItem[];
  done: PlanItem[];
  tasks: PlanItem[];
  clients: string[];
  hours: number;
  onTime: number | null;
}

export function TeamLoadPage() {
  useCrumbs(['Team load']);
  useLeadsBadge();
  const { leads, loading } = useLeadRows();
  const plan = usePlan(BOOKWHO);
  const { engagements, getStateForEngagement, tasks, updateTask } = useApp();
  const { go, base, openPop, openDrawer, openModal, toast, scope } = useConsole();
  const week = weekOf(plan.today);
  const owners = leads.map((l) => l.profileId).filter(Boolean).join(',');
  const cal = useBlocks(owners || null, week[0]!, week[6]!);
  const [all, setAll] = useState(false);

  const taskItems = useMemo(
    () =>
      tasks
        .filter((t) => plan.byClient[t.engagementId])
        .map((t) => fromTask(t, plan.byClient[t.engagementId]!.companyName, plan.today))
        .filter((i) => scope === 'all' || stageOf(plan.byClient[i.clientId]!, getStateForEngagement(plan.byClient[i.clientId]!)) === scope),
    [tasks, plan.byClient, plan.today, scope, getStateForEngagement],
  );

  const rows: Row[] = leads.map((l) => {
    const mineIds = new Set(engagements.filter((e) => internAssignedToEngagement(e, l.key)).map((e) => e.id));
    const work = plan.all.filter((i) => mineIds.has(i.clientId));
    const tk = taskItems.filter((i) => l.profileId && i.task?.assigneeId === l.profileId);
    const items = [...work, ...tk];
    const open = items.filter((i) => i.st !== 'done');
    const mins = cal.blocks.filter((b) => b.ownerId === l.profileId).reduce((n, b) => n + b.endMin - b.startMin, 0);
    return {
      l,
      items,
      open,
      over: open.filter((i) => i.st === 'over'),
      due: open.filter((i) => i.st === 'due'),
      wait: open.filter((i) => i.st === 'wait'),
      done: items.filter((i) => i.st === 'done'),
      tasks: tk.filter((i) => i.st !== 'done'),
      clients: engagements.filter((e) => mineIds.has(e.id)).map((e) => shortName(e.companyName)),
      hours: Math.round((mins / 60) * 10) / 10,
      onTime: onTimeFor(engagements, getStateForEngagement, l.key).pct,
    };
  });
  const max = Math.max(1, ...rows.map((r) => r.open.length));
  const heavy = [...rows].sort((a, b) => b.open.length - a.open.length)[0];
  const light = [...rows].sort((a, b) => a.open.length - b.open.length)[0];
  const grid = { gridTemplateColumns: `180px repeat(${Math.max(rows.length, 1)}, minmax(150px, 1fr))` };

  const drill = (el: Element, r: Row, label: string, list: PlanItem[]) =>
    openPop(
      el,
      <Drill
        title={`${r.l.name} · ${label}`}
        sub={`${list.length} item${list.length === 1 ? '' : 's'}`}
        tabs={[
          {
            label,
            rows: [...list].sort(sortPlan).map((i) => ({
              id: i.id,
              title: `${i.title} · ${shortName(i.clientName)}`,
              meta: `${i.code} · ${i.dueLabel}`,
              state: T_LABEL[i.st],
              color: T_COLOR[i.st],
              onOpen: () => openDrawer(<TaskDrawer who={{ mode: 'mgr-lead', key: r.l.key, profileId: r.l.profileId, name: r.l.name }} id={i.id} />),
            })),
          },
        ]}
        link={{ text: `Open ${firstOf(r.l.name)}'s planner`, onClick: () => go(`${base}/leads?lead=${encodeURIComponent(r.l.key)}`) }}
      />,
      { cls: 'mx-wide' },
    );
  const count = (r: Row, label: string, list: PlanItem[], red?: boolean) => (
    <button type="button" className={'lp-num' + (red && list.length ? ' red' : '')} title={`${label} · open the list`} onClick={(e) => drill(e.currentTarget, r, label, list)}>
      {list.length}
    </button>
  );

  /* reassign: open team tasks held by one of your leads */
  const movable = taskItems
    .filter((i) => i.st !== 'done' && rows.some((r) => r.l.profileId && r.l.profileId === i.task?.assigneeId))
    .sort(sortPlan);
  const shown = all ? movable : movable.slice(0, 8);
  const holder = (i: PlanItem) => rows.find((r) => r.l.profileId === i.task?.assigneeId)?.l;
  const move = (i: PlanItem, to: LeadRow) => {
    const prev = i.task!.assigneeId;
    updateTask(i.taskId!, { assigneeId: to.profileId! });
    toast(`${i.title} moved to ${to.name}`, () => updateTask(i.taskId!, { assigneeId: prev }));
  };

  const leadName = (k?: string | null) => (k ? leads.find((l) => l.key === k)?.name ?? k : 'No lead');
  const loadingAll = (loading && !leads.length) || (plan.loading && !plan.all.length);

  return (
    <>
      <div className="sec-h">
        <h2>Team load</h2>
        <span className="sec-count">{loading && !leads.length ? 'Loading…' : `${leads.length} project lead${leads.length === 1 ? '' : 's'}`}</span>
        <span className="sp" />
        <span className="small">Who is carrying what, and where there is room</span>
        <Btn cls="sm" ico="up" onClick={() => openModal(<AddLeadModal />, { label: 'Add project lead' })}>
          Add project lead
        </Btn>
      </div>
      {loadingAll ? (
        <section className="glass panel mx-p">
          <div className="sec-load">Loading your team…</div>
        </section>
      ) : !rows.length ? (
        <section className="glass panel mx-p">
          <Empty title="No project leads yet" sub="Add a lead and assign them a project; their load shows here." />
        </section>
      ) : (
        <>
          {rows.length > 1 && heavy && light && heavy !== light ? (
            <div className="banner info">
              <Icon name="bolt" />
              <div>
                <b>{`${firstOf(heavy.l.name)} has the heaviest load (${heavy.open.length} open, ${heavy.over.length} overdue); ${firstOf(light.l.name)} has the most room (${light.open.length} open).`}</b>
                Move a team task in the table below, or hand a to-do to a lead from My work.
              </div>
            </div>
          ) : null}
          <section className="glass panel mx-load">
            <div className="wk-scrollx">
              <div className="lp-load">
                <div className="mx-tlm head" style={grid}>
                  <span />
                  {rows.map((r) => (
                    <button key={r.l.key} type="button" className="mx-tlhd" onClick={() => go(`${base}/leads?lead=${encodeURIComponent(r.l.key)}`)} title={`Open ${r.l.name}'s planner`}>
                      <LeadAv id={r.l.key} name={r.l.name} initials={personInitials(r.l.name)} />
                      <b className="wk-ell">{r.l.name}</b>
                      <span className="small wk-ell" title={r.clients.join(' · ')}>
                        {r.clients.length ? r.clients.join(' · ') : 'No clients yet'}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mx-tlm" style={grid}>
                  <span className="mx-tlml">Open</span>
                  {rows.map((r) => (
                    <span key={r.l.key} className="mx-tlmv">
                      <span className="mx-ldbar" title={`${r.over.length} overdue, ${r.due.length} due this week, ${r.open.length - r.over.length - r.due.length} other open`}>
                        <i className="r" style={{ width: `${(r.over.length / max) * 100}%` }} />
                        <i className="d" style={{ width: `${(r.due.length / max) * 100}%` }} />
                        <i style={{ width: `${((r.open.length - r.over.length - r.due.length) / max) * 100}%`, background: hueOf(r.l.key) }} />
                      </span>
                      {count(r, 'Open', r.open)}
                    </span>
                  ))}
                </div>
                {(
                  [
                    ['Overdue', (r: Row) => r.over, true],
                    ['Due this week', (r: Row) => r.due, false],
                    ['Waiting on client', (r: Row) => r.wait, false],
                    ['Done this week', (r: Row) => r.done, false],
                    ['Open team tasks', (r: Row) => r.tasks, false],
                  ] as Array<[string, (r: Row) => PlanItem[], boolean]>
                ).map(([label, f, red]) => (
                  <div key={label} className="mx-tlm" style={grid}>
                    <span className="mx-tlml">{label}</span>
                    {rows.map((r) => (
                      <span key={r.l.key} className="mx-tlmv">
                        {count(r, label, f(r), red)}
                      </span>
                    ))}
                  </div>
                ))}
                <div className="mx-tlm" style={grid}>
                  <span className="mx-tlml">Hours on the calendar this week</span>
                  {rows.map((r) => (
                    <span key={r.l.key} className={'mx-tlmv num' + (r.hours > 30 ? ' red' : '')} title={r.l.profileId ? 'Work blocks Mon to Sun' : 'No sign-in yet'}>
                      {r.l.profileId ? hoursText(r.hours) : '—'}
                    </span>
                  ))}
                </div>
                <div className="mx-tlm" style={grid}>
                  <span className="mx-tlml" title="Steps done on or before the window you set, of the steps done that had one">
                    On-time rate
                  </span>
                  {rows.map((r) => (
                    <span key={r.l.key} className="mx-tlmv">
                      {r.onTime === null ? (
                        <span className="small" title="No finished step had a window you set yet">
                          —
                        </span>
                      ) : (
                        <span className={'pill ' + (r.onTime >= 90 ? 'ok' : r.onTime >= 80 ? 'due' : 'over')}>{`${r.onTime}%`}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mx-phleg lp-pad">
              <span><i className="mx-phc" style={{ background: 'var(--over)' }} />Overdue</span>
              <span><i className="mx-phc" style={{ background: 'var(--due)' }} />Due this week</span>
              <span><i className="mx-phc" style={{ background: 'var(--ink-3)' }} />Other open (lead colour)</span>
              <span className="small">On-time: green 90% and up, amber 80 to 89%, red below</span>
            </div>
          </section>
          <Panel title="Reassign a task" sub="Pick a team task and choose who takes it; it keeps its client and due date">
            <div className="wk-scrollx">
              <div className="mx-table mx-rt">
                <div className="mx-th">
                  <span>Task</span>
                  <span>Now with</span>
                  <span>Status</span>
                  <span>Move to</span>
                </div>
                {shown.length ? (
                  shown.map((i) => {
                    const h = holder(i);
                    return (
                      <div key={i.id} className="mx-tr static">
                        <span className="mx-tc1">
                          <b className="wk-ell" title={i.title}>
                            {i.title}
                          </b>
                          <span className="small wk-ell">{`${shortName(i.clientName)} · Team task`}</span>
                        </span>
                        <span className="mx-tc3">
                          {h ? <LeadAv id={h.key} name={h.name} initials={personInitials(h.name)} sm /> : null}
                          <span className="wk-ell">{h ? firstOf(h.name) : '—'}</span>
                        </span>
                        <span>
                          <StPill i={i} sm />
                        </span>
                        <span className="mx-moves">
                          {rows
                            .filter((r) => r.l.key !== h?.key && r.l.profileId)
                            .map((r) => (
                              <button key={r.l.key} type="button" className="btn sm" onClick={() => move(i, r.l)} title={`Move to ${r.l.name}`}>
                                <LeadAv id={r.l.key} name={r.l.name} initials={personInitials(r.l.name)} sm />
                                {firstOf(r.l.name)}
                              </button>
                            ))}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <Empty title="No open team tasks" sub="Tasks handed to a lead show here so you can move them." />
                )}
              </div>
            </div>
            {movable.length > 8 ? (
              <button type="button" className="mx-showall" onClick={() => setAll((v) => !v)}>
                {all ? 'Show fewer' : `Show all ${movable.length}`}
              </button>
            ) : null}
          </Panel>
        </>
      )}
      <ClientsAndLeads leadName={leadName} />
      <ClientAccounts />
    </>
  );
}
