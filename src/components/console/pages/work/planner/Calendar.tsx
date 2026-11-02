'use client';

/**
 * Calendar (prototype mxCalendar / mxWeekView / mxBlock / mxTimeBox /
 * mxNewBlock / mxMonthView): Day, Week and Month. The ALL DAY row shows
 * filing dates and manager-set dates — read-only (lock). Work blocks are
 * real rows (`/api/planner/blocks`): drag a block's top or bottom edge in
 * 15-minute steps, or open it (click / Enter) to type the times; double-click
 * an empty slot, or use Add block, to plan an item.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { MONL, MON } from '@/components/portal/dates';
import type { PlannerBlockDto } from '@/lib/planner-blocks';
import { PLANNER_DAY_END_MIN, PLANNER_DAY_START_MIN, PLANNER_MIN_BLOCK_MIN } from '@/lib/planner-blocks';
import { useConsole } from '../../../runtime';
import { Menu, PopHead } from '../../../overlays';
import { Btn, Icon, Seg, hueOf } from '../../../ui';
import { addDays, dDay, weekOf, weekday } from '../../today/model';
import { readSession, shortName, StPill, writeSession } from './bits';
import { useBlocks, type PlannerWho } from './data';
import { LockPop, TaskDrawer } from './overlays';
import { durText, fmtRange, fmtTime, monthGrid, parseTime, T_COLOR, type PlanItem } from './model';

const H0 = 9;
const NH = 10;
const PXH = 46;
type Mode = 'day' | 'week' | 'month';
const MODE_KEY = 'vcfo-console-cal-mode';
const isMode = (v: unknown): v is Mode => v === 'day' || v === 'week' || v === 'month';
const minToY = (m: number) => ((m - H0 * 60) / 60) * PXH;
const snap = (m: number) => Math.round(m / 15) * 15;

export interface CalTodo {
  id: string;
  title: string;
}

export function Calendar({ who, items, owner, clients, todos, today }: { who: PlannerWho; items: PlanItem[]; owner: string | null; clients: string[]; todos: CalTodo[]; today: string }) {
  const { openPop, openDrawer, go, base, seat, toast } = useConsole();
  const [mode, setModeState] = useState<Mode>('week');
  useEffect(() => setModeState(readSession(MODE_KEY, 'week', isMode)), []);
  const setMode = (m: Mode) => {
    setModeState(m);
    writeSession(MODE_KEY, m);
  };
  const [anchor, setAnchor] = useState(today);
  const days = mode === 'day' ? [anchor] : weekOf(anchor);
  const cells = useMemo(() => (mode === 'month' ? monthGrid(anchor, [], []) : []), [mode, anchor]);
  const from = mode === 'month' ? cells[0]!.day : days[0]!;
  const to = mode === 'month' ? cells[cells.length - 1]!.day : days[days.length - 1]!;
  const cal = useBlocks(owner, from, to);
  const blocks = cal.blocks.filter((b) => !clients.length || (b.engagementId && clients.includes(b.engagementId)));
  const month = useMemo(() => (mode === 'month' ? monthGrid(anchor, items, blocks) : []), [mode, anchor, items, blocks]);

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'The calendar could not be saved. Try again.');
  const step = (n: number) => setAnchor(mode === 'month' ? `${addMonths(anchor, n)}-01` : addDays(anchor, n * (mode === 'day' ? 1 : 7)));

  /* ---------- new blocks */
  const choices = [
    ...items.filter((i) => i.st !== 'done' && i.st !== 'wait').slice(0, 10).map((i) => ({ key: i.id, title: i.title, sub: `${shortName(i.clientName)} · ${i.dueLabel}`, client: i.clientId, ref: i.id })),
    ...todos.slice(0, 6).map((t) => ({ key: t.id, title: t.title, sub: 'To-do', client: '', ref: `todo:${t.id.replace(/[^A-Za-z0-9:._@-]/g, '')}` })),
  ];
  const newBlock = (anchorEl: Element | DOMRect, day: string, a: number) => {
    if (!owner) return;
    const start = Math.min(Math.max(PLANNER_DAY_START_MIN, a), PLANNER_DAY_END_MIN - 60);
    openPop(
      anchorEl,
      <Menu
        title={`New block · ${dDay(day, today)} at ${fmtTime(start)}`}
        items={
          choices.length
            ? choices.map((c) => ({
                label: c.title,
                sub: c.sub,
                lead: c.client ? <span className="mx-dot" style={{ background: hueOf(c.client) }} /> : <Icon name="check" />,
                onSelect: () =>
                  cal.create.mutate([{ ownerId: owner, engagementId: c.client || null, itemRef: c.ref, title: c.title, day, startMin: start, endMin: start + 60 }], {
                    onSuccess: () => toast(`${c.title} · ${fmtRange(start, start + 60)}`),
                    onError: fail,
                  }),
              }))
            : [{ label: 'Nothing open to plan', sub: 'Open work and to-dos show here', disabled: true, onSelect: () => undefined }]
        }
      />,
      { cls: 'mx-narrow' },
    );
  };
  const addBlockBtn = (el: Element) => {
    const day = days.includes(today) ? today : days[0]!;
    const taken = blocks.filter((b) => b.day === day).sort((p, q) => p.startMin - q.startMin);
    let a = PLANNER_DAY_START_MIN;
    for (const b of taken) if (b.startMin < a + 60 && b.endMin > a) a = b.endMin;
    newBlock(el, day, snap(a));
  };

  /* ---------- drag to resize */
  const [drag, setDrag] = useState<{ id: string; edge: 't' | 'b'; y0: number; a0: number; z0: number; a: number; z: number } | null>(null);
  const lastDrag = useRef(0);
  const grab = (e: RPointerEvent, b: PlannerBlockDto, edge: 't' | 'b') => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag({ id: b.id, edge, y0: e.clientY, a0: b.startMin, z0: b.endMin, a: b.startMin, z: b.endMin });
  };
  const move = (e: RPointerEvent) => {
    if (!drag) return;
    const d = snap(((e.clientY - drag.y0) / PXH) * 60);
    if (drag.edge === 't') setDrag({ ...drag, a: Math.min(Math.max(PLANNER_DAY_START_MIN, drag.a0 + d), drag.z0 - PLANNER_MIN_BLOCK_MIN) });
    else setDrag({ ...drag, z: Math.max(Math.min(PLANNER_DAY_END_MIN, drag.z0 + d), drag.a0 + PLANNER_MIN_BLOCK_MIN) });
  };
  const drop = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    lastDrag.current = Date.now();
    if (d.a !== d.a0 || d.z !== d.z0) {
      const b = blocks.find((x) => x.id === d.id);
      cal.patch.mutate({ id: d.id, p: { startMin: d.a, endMin: d.z } }, { onSuccess: () => toast(`${b?.title ?? 'Block'} · ${fmtRange(d.a, d.z)}`), onError: fail });
    }
  };

  const openBlock = (b: PlannerBlockDto, el: Element) =>
    openPop(
      el,
      <TimeBox
        block={b}
        onSave={(a, z) => cal.patch.mutate({ id: b.id, p: { startMin: a, endMin: z } }, { onSuccess: () => toast(`${b.title} · ${fmtRange(a, z)}`), onError: fail })}
        onRemove={() =>
          cal.remove.mutate(b.id, {
            onSuccess: () =>
              toast('Block removed', () =>
                cal.create.mutate([{ ownerId: b.ownerId, engagementId: b.engagementId, itemRef: b.itemRef, title: b.title, day: b.day, startMin: b.startMin, endMin: b.endMin }], { onError: fail }),
              ),
            onError: fail,
          })
        }
      />,
      { cls: 'mx-narrow' },
    );

  const allDay = (d: string) => items.filter((i) => i.st !== 'done' && i.due === d && (i.kind === 'filing' || i.locked));
  const openItem = (i: PlanItem, el: Element) => {
    if (i.locked) openPop(el, <LockPop who={who} id={i.id} />);
    else if (i.kind === 'filing') go(`${base}/compliances/${seat === 'lead' ? 'calendar' : 'filings'}`);
    else openDrawer(<TaskDrawer who={who} id={i.id} />);
  };

  const title = mode === 'month' ? `${MONL[Number(anchor.slice(5, 7)) - 1]} ${anchor.slice(0, 4)}` : `${dDay(days[0]!, today)}${days.length > 1 ? ` to ${dDay(days[days.length - 1]!, today)}` : ''}`;

  return (
    <section className="glass panel mx-cal">
      <div className="ph wk-calh">
        <h3>Calendar</h3>
        <Seg<Mode> className="sm" ariaLabel="Calendar view" value={mode} onChange={setMode} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
        <span className="sp" />
        <button type="button" className="ib sm" aria-label={`Previous ${mode}`} onClick={() => step(-1)}>
          <Icon name="back" />
        </button>
        <button type="button" className="btn sm" onClick={(e) => openPop(e.currentTarget, <MonthPick value={anchor} onPick={(m) => setAnchor(`${m}-01`)} />, { cls: 'mx-narrow' })}>
          {title}
          <Icon name="down" size={12} />
        </button>
        <button type="button" className="ib sm wk-next" aria-label={`Next ${mode}`} onClick={() => step(1)}>
          <Icon name="back" />
        </button>
        <Btn cls="sm" onClick={() => setAnchor(today)}>
          Today
        </Btn>
        {owner && mode !== 'month' ? (
          <Btn cls="sm" ico="up" onClick={(e) => addBlockBtn(e.currentTarget)}>
            Add block
          </Btn>
        ) : null}
      </div>
      {!owner ? <p className="small wk-note">This lead has no sign-in yet, so no blocks can be planned for them.</p> : null}
      {cal.error ? <p className="small wk-note red">The calendar blocks could not load. The dates below are still current.</p> : null}
      {mode === 'month' ? (
        <div className="mx-mv">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <span key={d} className="mx-mvh">
              {d}
            </span>
          ))}
          {month.map((c) => {
            const ev = [
              ...c.blocks.map((b) => ({ k: b.id, t: b.title, color: hueOf(b.engagementId ?? b.title) })),
              ...c.items.map((i) => ({ k: i.id, t: i.title, color: T_COLOR[i.st] })),
            ];
            return (
              <button
                key={c.day}
                type="button"
                className={'mx-mvc' + (c.out ? ' out' : '') + (c.day === today ? ' now' : '') + (weekday(c.day) === 'Sat' || weekday(c.day) === 'Sun' ? ' wk' : '')}
                title={`${dDay(c.day, today)} · ${c.items.length} due · ${c.blocks.length} block${c.blocks.length === 1 ? '' : 's'}`}
                onClick={(e) => openPop(e.currentTarget, <DayPop who={who} day={c.day} today={today} items={c.items} blocks={c.blocks} />, { cls: 'mx-wide' })}
              >
                <span className="mx-mvn">
                  <b className={c.worst}>{Number(c.day.slice(8))}</b>
                  {ev.length > 2 ? <em>{ev.length}</em> : null}
                </span>
                {ev.slice(0, 2).map((x) => (
                  <span key={x.k} className="mx-mve" style={{ ['--cc' as string]: x.color }}>
                    {x.t}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mx-wgw" onPointerMove={move} onPointerUp={drop} onPointerCancel={drop}>
          <div className="mx-wg" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(${days.length === 1 ? 360 : 96}px, 1fr))` }}>
            <div className="mx-wgc" />
            {days.map((d) => (
              <div key={d} className={'mx-wgd' + (d === today ? ' now' : '')}>
                <span>{weekday(d).toUpperCase()}</span>
                <b>{Number(d.slice(8))}</b>
              </div>
            ))}
            <div className="mx-wgc">
              <span className="mx-ad">ALL DAY</span>
            </div>
            {days.map((d) => (
              <div key={d} className="mx-wga">
                {allDay(d).map((i) => (
                  <button key={i.id} type="button" className={'mx-adi' + (i.kind === 'filing' ? ' f' : '')} title={`${i.title} · ${i.kind === 'filing' ? 'filing date' : 'manager date'} · read-only`} onClick={(e) => openItem(i, e.currentTarget)}>
                    <Icon name="lock" size={10} />
                    {i.title}
                  </button>
                ))}
              </div>
            ))}
            <div className="mx-wgc hrs" style={{ height: NH * PXH }}>
              {Array.from({ length: NH }, (_, i) => (
                <span key={i} style={{ top: i * PXH - 7 }}>
                  {`${((H0 + i - 1) % 12) + 1} ${H0 + i >= 12 ? 'PM' : 'AM'}`}
                </span>
              ))}
            </div>
            {days.map((d) => (
              <div
                key={d}
                className={'mx-wgb' + (d === today ? ' now' : '') + (weekday(d) === 'Sat' || weekday(d) === 'Sun' ? ' wk' : '')}
                style={{ height: NH * PXH }}
                onDoubleClick={(e) => {
                  if ((e.target as Element).closest('.mx-blk')) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  newBlock(new DOMRect(e.clientX, e.clientY, 0, 0), d, H0 * 60 + Math.floor(((e.clientY - r.top) / PXH) * 2) * 30);
                }}
              >
                {Array.from({ length: NH }, (_, i) => (
                  <i key={i} style={{ top: i * PXH }} />
                ))}
                {blocks
                  .filter((b) => b.day === d)
                  .map((b) => {
                    const a = drag?.id === b.id ? drag.a : b.startMin;
                    const z = drag?.id === b.id ? drag.z : b.endMin;
                    const item = b.itemRef ? items.find((i) => i.id === b.itemRef) : undefined;
                    const warn = !!item?.due && b.day > item.due;
                    return (
                      <div
                        key={b.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${b.title} · ${fmtRange(a, z)} · change the time`}
                        className={'mx-blk' + (b.createdBy === b.ownerId ? ' mine' : '') + (warn ? ' warn' : '') + (drag?.id === b.id ? ' rz' : '')}
                        style={{ ['--cc' as string]: hueOf(b.engagementId ?? b.title), top: minToY(a) + 1, height: ((z - a) / 60) * PXH - 2 }}
                        title={`${b.title}${warn ? ' · after the task’s due date' : ''}`}
                        onClick={(e) => {
                          if (Date.now() - lastDrag.current < 350) return;
                          openBlock(b, e.currentTarget);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openBlock(b, e.currentTarget);
                          }
                        }}
                      >
                        <span className="rh t" onPointerDown={(e) => grab(e, b, 't')} aria-hidden="true" />
                        <b>{b.title}</b>
                        <span>{fmtRange(a, z)}</span>
                        {warn ? <em>After task end</em> : null}
                        <span className="rh b" onPointerDown={(e) => grab(e, b, 'b')} aria-hidden="true" />
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function addMonths(day: string, n: number): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, '0')}`;
}

function MonthPick({ value, onPick }: { value: string; onPick: (ym: string) => void }) {
  const { closePop } = useConsole();
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  return (
    <div>
      <PopHead title="Pick a month" sub={String(year)} />
      <div className="wk-yr">
        <button type="button" className="ib sm" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}>
          <Icon name="back" />
        </button>
        <b>{year}</b>
        <button type="button" className="ib sm wk-next" aria-label="Next year" onClick={() => setYear((y) => y + 1)}>
          <Icon name="back" />
        </button>
      </div>
      <div className="mx-mpick">
        {MON.map((m, i) => {
          const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={ym === value.slice(0, 7)}
              onClick={() => {
                closePop();
                onPick(ym);
              }}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayPop({ who, day, today, items, blocks }: { who: PlannerWho; day: string; today: string; items: PlanItem[]; blocks: PlannerBlockDto[] }) {
  const { openDrawer, closePop } = useConsole();
  return (
    <div>
      <PopHead title={dDay(day, today)} sub={`${items.length} due · ${blocks.length === 1 ? '1 block' : `${blocks.length} blocks`}`} />
      <div className="mx-drows">
        {items.map((i) => (
          <button
            key={i.id}
            type="button"
            className="mx-drow"
            onClick={() => {
              closePop();
              openDrawer(<TaskDrawer who={who} id={i.id} />);
            }}
          >
            <i style={{ background: T_COLOR[i.st] }} />
            <span className="mx-dt">
              <b>{i.title}</b>
              <span>{`${shortName(i.clientName)} · ${i.code}`}</span>
            </span>
            <StPill i={i} sm />
          </button>
        ))}
        {blocks.map((b) => (
          <div key={b.id} className="mx-drow wk-static">
            <i style={{ background: hueOf(b.engagementId ?? b.title) }} />
            <span className="mx-dt">
              <b>{b.title}</b>
              <span>{fmtRange(b.startMin, b.endMin)}</span>
            </span>
          </div>
        ))}
        {!items.length && !blocks.length ? <span className="small">Nothing due and no blocks this day.</span> : null}
      </div>
    </div>
  );
}

/** Change time (prototype mxTimeBox): typed times or −/+ in 15-minute steps, 9:00 am to 7:00 pm. */
function TimeBox({ block, onSave, onRemove }: { block: PlannerBlockDto; onSave: (a: number, z: number) => void; onRemove: () => void }) {
  const { closePop } = useConsole();
  const [a, setA] = useState(block.startMin);
  const [z, setZ] = useState(block.endMin);
  const [aT, setAT] = useState<string | null>(null);
  const [zT, setZT] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const save = () => {
    const na = aT !== null ? parseTime(aT) : a;
    const nz = zT !== null ? parseTime(zT) : z;
    if (Number.isNaN(na) || Number.isNaN(nz)) return setMsg('Use a time like 2:30 pm or 14:30.');
    if (na < PLANNER_DAY_START_MIN || nz > PLANNER_DAY_END_MIN) return setMsg('Pick a time between 9:00 am and 7:00 pm.');
    if (nz - na < PLANNER_MIN_BLOCK_MIN) return setMsg('End must be at least 15 minutes after start.');
    closePop();
    onSave(na, nz);
  };
  const field = (label: string, val: number, txt: string | null, setTxt: (v: string | null) => void, set: (v: number) => void, isStart: boolean) => (
    <div className="mx-tf">
      <span className="mx-fl">{label}</span>
      <div className="mx-tfr">
        <button
          type="button"
          className="ib sm"
          aria-label={`${label} 15 minutes earlier`}
          onClick={() => {
            setTxt(null);
            setMsg('');
            set(isStart ? Math.max(PLANNER_DAY_START_MIN, val - 15) : Math.max(a + 15, val - 15));
          }}
        >
          −
        </button>
        <input
          className={'mx-tin' + (txt !== null && Number.isNaN(parseTime(txt)) ? ' bad' : '')}
          aria-label={label}
          value={txt ?? fmtTime(val)}
          onChange={(e) => {
            setTxt(e.target.value);
            setMsg('');
          }}
          onBlur={() => {
            if (txt === null) return;
            const v = parseTime(txt);
            if (!Number.isNaN(v)) {
              set(v);
              setTxt(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
        />
        <button
          type="button"
          className="ib sm"
          aria-label={`${label} 15 minutes later`}
          onClick={() => {
            setTxt(null);
            setMsg('');
            set(isStart ? Math.min(z - 15, val + 15) : Math.min(PLANNER_DAY_END_MIN, val + 15));
          }}
        >
          +
        </button>
      </div>
    </div>
  );
  return (
    <div className="mx-tbox">
      <PopHead title="Change time" sub={`${block.title} · ${dDay(block.day, block.day)}`} />
      <div className="mx-tfs">
        {field('Start', a, aT, setAT, setA, true)}
        {field('End', z, zT, setZT, setZ, false)}
      </div>
      <div className="co-row">
        <span className="small">{durText(z - a)}</span>
        <span className="sp" />
        {msg ? <span className="small red">{msg}</span> : <span className="small">9:00 am to 7:00 pm · 15-minute steps</span>}
      </div>
      <div className="pop-foot">
        <button
          type="button"
          className="btn sm danger"
          onClick={() => {
            closePop();
            onRemove();
          }}
        >
          Remove block
        </button>
        <span className="sp" />
        <Btn cls="sm" onClick={closePop}>
          Cancel
        </Btn>
        <Btn cls="sm pri" onClick={save}>
          Save
        </Btn>
      </div>
    </div>
  );
}
