'use client';

/**
 * Planner views (prototype mxTimeline, mxBoard, mxList, mxTodoCol) on the
 * planner rows. The board's columns and every card's action are the live
 * lead board's (Needs action / In progress / Waiting / Done this week; Review,
 * Deliver, Continue, Send reminder, Email manager again, Open filing, Open).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useConsole } from '../../../runtime';
import { Menu, type MenuItem } from '../../../overlays';
import { Empty, Icon, LeadAv, hueOf } from '../../../ui';
import { dShort, personInitials, weekday } from '../../today/model';
import { CDot, shortName, StPill, useItemActions } from './bits';
import type { LeadRow, PlannerWho } from './data';
import { LockPop, TaskDrawer, firstOf } from './overlays';
import { BOARD, boardCols, sortPlan, timeline, T_PILL, T_LABEL, type PlanItem } from './model';

export function useOpen(who: PlannerWho) {
  const { openDrawer, openPop } = useConsole();
  return {
    drawer: (i: PlanItem) => openDrawer(<TaskDrawer who={who} id={i.id} />),
    lock: (i: PlanItem, el: Element) => openPop(el, <LockPop who={who} id={i.id} />),
  };
}

function CtaBtn({ i, cls = 'link' }: { i: PlanItem; cls?: string }) {
  const acts = useItemActions();
  if (i.st === 'done' && i.kind !== 'task') return null;
  return (
    <button
      type="button"
      className={cls}
      onClick={(e) => {
        e.stopPropagation();
        void acts.run(i);
      }}
    >
      {i.cta.label}
    </button>
  );
}

/* ================================================================ timeline */

const TL_LEGEND: Array<[string, string, string]> = [
  ['m', 'Manager dates', 'Dates a manager set (locked)'],
  ['late', 'Overdue', 'Past its due date'],
  ['o', 'Own dates', 'Work with no manager window'],
  ['w', 'Waiting on client', 'The client acts next'],
  ['f', 'Filing', 'A filing and its due date'],
];

export function Timeline({ who, items, today }: { who: PlannerWho; items: PlanItem[]; today: string }) {
  const open = useOpen(who);
  const t = timeline(items, today);
  return (
    <>
      <section className="glass panel mx-tl">
        <div className="ph">
          <h3>Timeline</h3>
          <span className="small">{`${dShort(t.days[0]!, today)} to ${dShort(t.days[13]!, today)}`}</span>
          <span className="sp" />
          <div className="mx-tlleg">
            {TL_LEGEND.map(([c, l, tip]) => (
              <span key={c} title={tip}>
                <i className={'mx-tlb ' + c} />
                {l}
              </span>
            ))}
            <span title="The due date">
              <i className="mx-dia wk-dia" />
              Due
            </span>
          </div>
        </div>
        <div className="wk-scrollx">
          <div className="mx-tlg">
            <div className="mx-tlh">
              <span />
              {t.days.map((d) => (
                <span key={d} className={(d === today ? 'now' : '') + (weekday(d) === 'Sat' || weekday(d) === 'Sun' ? ' wk' : '')}>
                  {`${weekday(d).slice(0, 1)} ${Number(d.slice(8))}`}
                </span>
              ))}
            </div>
            {t.rows.length ? (
              t.rows.map(({ item, a, z, dueCol, bar }) => (
                <div key={item.id} className="mx-tlr">
                  <button type="button" className="mx-tll" onClick={() => open.drawer(item)}>
                    <CDot id={item.clientId} name={item.clientName} />
                    <span className="mx-dt">
                      <b title={item.title}>{item.title}</b>
                      <span>{`${shortName(item.clientName)} · ${item.code}`}</span>
                    </span>
                  </button>
                  <div className="mx-tlt">
                    {t.days.map((d) => (
                      <i key={d} className={'mx-tlc' + (d === today ? ' now' : '')} />
                    ))}
                    <button
                      type="button"
                      className={'mx-tlb ' + bar}
                      style={{ left: `${(a / 14) * 100}%`, width: `calc(${((z - a + 1) / 14) * 100}% - 3px)` }}
                      title={`${item.title} · ${item.start ? dShort(item.start, today) : ''}${item.due ? ` to ${dShort(item.due, today)}` : ''} · ${item.locked ? 'manager dates' : 'own dates'} · ${T_LABEL[item.st]}`}
                      onClick={(e) => (item.locked ? open.lock(item, e.currentTarget) : open.drawer(item))}
                    >
                      {item.locked ? <Icon name="lock" size={11} /> : null}
                      <span>{item.title}</span>
                    </button>
                    {dueCol >= 0 ? <span className={'mx-dia' + (item.kind === 'filing' ? ' f' : '')} style={{ left: `calc(${((dueCol + 0.5) / 14) * 100}% - 6px)` }} title={`Due ${dShort(item.due!, today)}`} /> : null}
                  </div>
                </div>
              ))
            ) : (
              <Empty title="Nothing in these two weeks" sub="Work with a date in this fortnight shows here." />
            )}
          </div>
        </div>
      </section>
      {t.later.length ? (
        <section className="glass panel mx-p">
          <div className="ph">
            <div className="mx-pt">
              <h3>Later, outside this fortnight</h3>
              <span className="small">{`${t.later.length} open`}</span>
            </div>
          </div>
          {t.later.map((i) => (
            <TaskLine key={i.id} i={i} who={who} />
          ))}
        </section>
      ) : null}
    </>
  );
}

/* ================================================================ board */

export function Board({ who, items }: { who: PlannerWho; items: PlanItem[] }) {
  const open = useOpen(who);
  const cols = boardCols(items);
  return (
    <div className="mx-board">
      {BOARD.map((c) => (
        <section key={c.key} className="glass panel mx-bcol">
          <div className="ph">
            <i className="mx-bdot" style={{ background: c.color }} />
            <h3>{c.label}</h3>
            <span className="mx-n">{cols[c.key].length}</span>
          </div>
          {cols[c.key].map((i) => (
            <div
              key={i.id}
              className="mx-card2"
              role="button"
              tabIndex={0}
              aria-label={`${i.title} · ${i.clientName}`}
              onClick={() => open.drawer(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target === e.currentTarget) open.drawer(i);
              }}
            >
              <div className="co-row">
                <span className="mx-av" style={{ ['--cc' as string]: hueOf(i.clientId) }}>
                  {shortName(i.clientName).slice(0, 2).toUpperCase()}
                </span>
                <span className="small wk-ell" title={i.clientName}>
                  {shortName(i.clientName)}
                </span>
                <span className="sp" />
                <span className="mx-code">{i.code}</span>
              </div>
              <b>{i.title}</b>
              <div className="co-row">
                <StPill i={i} sm />
                <span className="sp" />
                <CtaBtn i={i} />
              </div>
            </div>
          ))}
          {!cols[c.key].length ? <span className="small">Nothing here</span> : null}
        </section>
      ))}
    </div>
  );
}

/* ================================================================ list */

export function List({ who, items, leads, showLead }: { who: PlannerWho; items: PlanItem[]; leads: LeadRow[]; showLead: boolean }) {
  const open = useOpen(who);
  const acts = useItemActions();
  const { go } = useConsole();
  const rows = [...items].sort(sortPlan);
  const [sel, setSel] = useState(-1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (document.querySelector('.modal-wrap, .mx-drawer.show')) return;
      if (e.key === 'j' || e.key === 'J') setSel((i) => Math.min(i + 1, rows.length - 1));
      else if (e.key === 'k' || e.key === 'K') setSel((i) => Math.max(i - 1, 0));
      else if (e.key === 'Enter' && sel >= 0 && rows[sel] && !(e.target instanceof HTMLButtonElement)) go(acts.hrefOf(rows[sel]!));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, sel, go, acts]);
  const leadName = (k?: string) => leads.find((l) => l.key === k)?.name;
  return (
    <section className="glass panel">
      <div className="ph">
        <h3>List</h3>
        <span className="small">{`${rows.length === 1 ? '1 item' : `${rows.length} items`} · J / K move, Enter opens`}</span>
      </div>
      <div className="wk-scrollx">
        <div className={'mx-table mx-lt' + (showLead ? '' : ' wk-nolead')}>
          <div className="mx-th">
            <span>Step or filing</span>
            <span>Company</span>
            {showLead ? <span>Lead</span> : null}
            <span>State</span>
            <span>Due</span>
            <span />
          </div>
          {rows.length ? (
            rows.map((i, n) => {
              const ln = leadName(i.leadKey);
              return (
                <div
                  key={i.id}
                  className={'mx-tr mx-lrow' + (n === sel ? ' sel' : '') + (i.st === 'done' ? ' wk-done' : '')}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSel(n);
                    open.drawer(i);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target === e.currentTarget) open.drawer(i);
                  }}
                >
                  <span className="mx-tc1">
                    <span className="mx-code">{i.code}</span>
                    <b className="wk-ell" title={i.title}>
                      {i.title}
                    </b>
                  </span>
                  <span className="mx-tc3">
                    <CDot id={i.clientId} name={i.clientName} />
                    <span className="wk-ell" title={i.clientName}>
                      {shortName(i.clientName)}
                    </span>
                  </span>
                  {showLead ? (
                    <span className="mx-tc3">
                      {ln ? <LeadAv id={i.leadKey!} name={ln} initials={personInitials(ln)} sm /> : null}
                      <span className="wk-ell">{ln ? firstOf(ln) : 'No lead'}</span>
                    </span>
                  ) : null}
                  <span>
                    <span className={'pill ' + T_PILL[i.st]} title={i.why}>
                      {T_LABEL[i.st]}
                    </span>
                  </span>
                  <span className={'small num' + (i.st === 'over' ? ' red' : '')}>{i.due ? dShort(i.due, i.due) : '—'}</span>
                  <span>
                    <CtaBtn i={i} />
                  </span>
                </div>
              );
            })
          ) : (
            <Empty title="Nothing in this view" sub="Clear a filter or pick another client." />
          )}
        </div>
      </div>
    </section>
  );
}

/* ================================================================ to-do column pieces */

export function TaskLine({ i, who }: { i: PlanItem; who: PlannerWho }) {
  const open = useOpen(who);
  return (
    <button type="button" className="mx-todo tsk" onClick={() => open.drawer(i)}>
      <span className={'mx-cb2 ' + (i.st === 'done' ? 'on' : 'ghost')} aria-hidden="true">
        {i.st === 'done' ? <Icon name="check" /> : null}
      </span>
      <CDot id={i.clientId} name={i.clientName} />
      <span className="mx-dt">
        <b title={i.title}>{i.title}</b>
        <span>{`${shortName(i.clientName)} · ${i.code}${i.locked ? ' · manager dates' : ''}`}</span>
      </span>
      {i.locked ? (
        <span className="mx-lock" title="Dates set by a manager">
          <Icon name="lock" />
        </span>
      ) : null}
      <StPill i={i} sm />
    </button>
  );
}

export function TodoGroup({ title, n, isNew, children }: { title: string; n: number; isNew?: boolean; children: ReactNode }) {
  return (
    <div className="mx-tg">
      <div className="mx-tgh">
        <b>{title}</b>
        <span className="mx-n">{n}</span>
        {isNew ? <span className="mx-new">New</span> : null}
      </div>
      {children}
    </div>
  );
}

/** The assign button on a to-do (prototype mxAsgBtn): a dashed circle, or the lead's initials once assigned. */
export function AssignBtn({ leads, current, onPick, onUnassign, label }: { leads: LeadRow[]; current?: LeadRow; onPick: (l: LeadRow) => void; onUnassign?: () => void; label: string }) {
  const { openPop } = useConsole();
  return (
    <button
      type="button"
      className={'mx-asg' + (current ? ' has' : '')}
      style={current ? { ['--lc' as string]: hueOf(current.key) } : undefined}
      title={current ? `Assigned to ${current.name} · change` : 'Assign to a project lead'}
      aria-label={current ? `Assigned to ${current.name}` : `Assign ${label} to a project lead`}
      onClick={(e) => {
        e.stopPropagation();
        openPop(
          e.currentTarget,
          <Menu
            title="Assign to"
            items={[
              ...leads.map((l) => ({
                label: l.name,
                sub: l.profileId ? 'Project lead' : 'No sign-in yet',
                lead: <LeadAv id={l.key} name={l.name} initials={personInitials(l.name)} sm />,
                on: current?.key === l.key,
                disabled: !l.profileId,
                onSelect: () => onPick(l),
              })),
              ...(current && onUnassign ? unassign(onUnassign) : []),
            ]}
          />,
          { cls: 'mx-narrow' },
        );
      }}
    >
      {current ? personInitials(current.name) : <Icon name="up" size={13} />}
    </button>
  );
}

function unassign(onSelect: () => void): Array<MenuItem | '-'> {
  return ['-', { label: 'Unassign', danger: true, onSelect }];
}
