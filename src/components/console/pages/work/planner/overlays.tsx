'use client';

/**
 * Planner overlays (prototype mxTaskDrawer, mxLockPop, mxEditSpan, mxNewTodo,
 * mxPlanWeek). Each reads live data itself, so an open card refreshes.
 *
 * Real operations only: open the step / filing / client, draft a client
 * reminder, email the manager again (lead), mark a team task done or reopen
 * it, set a step's or filing's dates (manager — the schedule window APIs),
 * add a to-do (personal, or a team task on a client), lay blocks on the
 * calendar.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { getItem } from '@/data/checklist';
import type { FilingRow } from '@/lib/filings';
import { canSetScheduleWindows, formatWindow, isValidWindowRange, windowForStep } from '@/lib/schedule-windows';
import { setFilingWindowInDb } from '@/lib/engagements-db';
import { stepNeeds } from '@/components/portal/sections/incorporation/model';
import { useConsole } from '../../../runtime';
import { DrawerHead, PopHead } from '../../../overlays';
import { Btn, Empty, GoArrow, Icon, hueOf } from '../../../ui';
import { stamp, WindowEditor } from '../../clients/shared';
import { dDay, dShort } from '../../today/model';
import { mailDraft, StPill, shortName, useItemActions } from './bits';
import { useBlocks, usePlan, type PlannerWho } from './data';
import { fmtRange, type PlanItem } from './model';

export const firstOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** The item behind an id, from the planner's live lists. */
function useItem(who: PlannerWho, id: string) {
  const plan = usePlan(who);
  const item = plan.items.find((i) => i.id === id) ?? plan.boardItems.find((i) => i.id === id) ?? plan.waiting.find((i) => i.id === id);
  return { plan, item };
}

function setByText(i: PlanItem, meId: string | undefined, seat: string): string {
  if (!i.locked) return '';
  if (i.lockSetBy && i.lockSetBy === meId) return 'set by you';
  return seat === 'lead' ? 'set by your manager' : 'set by a manager';
}

/* ================================================================ filing window (manager) */

function FilingWindowEditor({ row, label }: { row: FilingRow; label: string }) {
  const { closePop, toast } = useConsole();
  const qc = useQueryClient();
  const [from, setFrom] = useState(row.windowFrom ?? '');
  const [to, setTo] = useState(row.windowTo ?? row.dueDate.slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const has = Boolean(row.windowFrom && row.windowTo);
  const commit = async (next: { from: string; to: string } | null) => {
    setBusy(true);
    setErr('');
    try {
      await setFilingWindowInDb(row.id, next);
      await qc.invalidateQueries({ queryKey: ['filings'] });
      closePop();
      toast(next ? `${label} · window ${formatWindow(next)}` : `${label} · window cleared`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the window. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cx-win">
      <PopHead title={`${label} window`} sub={has ? `Now ${formatWindow({ from: row.windowFrom!, to: row.windowTo! })}` : `Due ${dShort(row.dueDate.slice(0, 10), row.dueDate)} · no window set yet`} />
      <div className="mx-form2">
        <label className="mx-f">
          <span className="mx-fl">From</span>
          <input className="mx-in" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">To</span>
          <input className="mx-in" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {err ? <p className="wk-err">{err}</p> : null}
      <div className="pop-foot">
        {has ? (
          <Btn cls="sm" ico="x" disabled={busy} onClick={() => void commit(null)}>
            Clear
          </Btn>
        ) : null}
        <span className="sp" />
        <Btn cls="sm" onClick={closePop} disabled={busy}>
          Cancel
        </Btn>
        <Btn cls="sm pri" ico="check" disabled={busy || !isValidWindowRange(from, to)} onClick={() => void commit({ from, to })}>
          {busy ? 'Saving…' : 'Save'}
        </Btn>
      </div>
    </div>
  );
}

/** Opens the right date editor for an item (manager seat only). */
export function useDateEditor(who: PlannerWho) {
  const { openPop } = useConsole();
  const plan = usePlan(who);
  const { user } = useApp();
  const can = canSetScheduleWindows(user?.role);
  const open = (i: PlanItem, anchor: Element) => {
    const e = plan.byClient[i.clientId];
    if (!e) return;
    if (i.kind === 'step' && i.stepId) {
      const win = windowForStep(e.schedule, i.stepId);
      openPop(anchor, <WindowEditor eng={e} target={{ kind: 'step', itemId: i.stepId }} label={i.title} value={win ? { from: win.from, to: win.to } : null} />);
    } else if (i.kind === 'filing' && i.filingId) {
      const row = plan.rowByKey[i.filingId];
      if (row) openPop(anchor, <FilingWindowEditor row={row} label={i.title} />);
    }
  };
  const editable = (i: PlanItem) => can && ((i.kind === 'step' && !!i.stepId) || (i.kind === 'filing' && !!i.filingId && !!plan.rowByKey[i.filingId]));
  return { open, editable };
}

/* ================================================================ lock pop-over */

export function LockPop({ who, id }: { who: PlannerWho; id: string }) {
  const { item } = useItem(who, id);
  const { me, seat, closePop, openDrawer } = useConsole();
  const dates = useDateEditor(who);
  if (!item) return <PopHead title="Item closed" sub="It was finished or moved out of the filter." />;
  const by = setByText(item, me?.id, seat);
  return (
    <div>
      <PopHead title={item.title} sub={`${shortName(item.clientName)}${item.code ? ` · ${item.code}` : ''}`} lead={<span className="mx-av" style={{ ['--cc' as string]: hueOf(item.clientId) }}>{shortName(item.clientName).slice(0, 2).toUpperCase()}</span>} />
      <div className="mx-lockc">
        <Icon name="lock" />
        <div>
          <b>{`${item.start && item.start !== item.due ? `${dShort(item.start, item.start)} to ` : 'Due '}${item.due ? dShort(item.due, item.due) : '—'}${by ? ` · ${by}` : ''}`}</b>
          <span>
            {seat === 'lead'
              ? 'You can plan work inside these dates; moving them needs your manager.'
              : 'Leads plan work inside these dates and cannot move them. You can change them here.'}
          </span>
        </div>
      </div>
      <div className="pop-foot">
        {dates.editable(item) ? (
          <Btn cls="sm" ico="cal" onClick={(e) => dates.open(item, e.currentTarget)}>
            Change the dates
          </Btn>
        ) : null}
        <span className="sp" />
        <GoArrow
          label="Open task"
          onClick={() => {
            closePop();
            openDrawer(<TaskDrawer who={who} id={item.id} />);
          }}
        />
      </div>
    </div>
  );
}

/* ================================================================ task drawer */

function activityOf(item: PlanItem, state: Record<string, unknown> | undefined): Array<{ what: string; when: string }> {
  const s = (item.stepId ? state?.[item.stepId] : undefined) as
    | { clientSubmittedAt?: string; reviewedAt?: string; reviewStatus?: string; lastEditedAt?: string; lastEditedByName?: string; completedOn?: string; deliveredToClientAt?: string; clientFillRequest?: { requestedAt?: string; requestedByName?: string } }
    | undefined;
  if (!s) return [];
  const out: Array<{ what: string; when: string; at: string }> = [];
  const add = (what: string, at?: string) => at && out.push({ what, when: stamp(at), at });
  add('The client submitted it', s.clientSubmittedAt);
  add(s.reviewStatus === 'rejected' ? 'Sent back to the client' : s.reviewStatus === 'accepted' ? 'Accepted' : 'Reviewed', s.reviewedAt);
  add(`Edited${s.lastEditedByName ? ` by ${s.lastEditedByName}` : ''}`, s.lastEditedAt);
  add(`${s.clientFillRequest?.requestedByName ?? 'The lead'} asked to send it to the client`, s.clientFillRequest?.requestedAt);
  add('Delivered to the client', s.deliveredToClientAt);
  add('Marked done', s.completedOn);
  return out.sort((a, b) => b.at.localeCompare(a.at)).map(({ what, when }) => ({ what, when }));
}

export function TaskDrawer({ who, id }: { who: PlannerWho; id: string }) {
  const { item, plan } = useItem(who, id);
  const { me, seat, go, closeDrawer, base } = useConsole();
  const { getStateForEngagement } = useApp();
  const acts = useItemActions();
  const dates = useDateEditor(who);
  const owner = who.mode === 'mgr-lead' ? who.profileId : me?.id;
  const cal = useBlocks(owner, plan.today.slice(0, 8) + '01', `${Number(plan.today.slice(0, 4)) + 1}${plan.today.slice(4, 10)}`);
  if (!item) {
    return (
      <>
        <DrawerHead title="Item closed" />
        <Empty title="This item is no longer open" sub="It was finished or moved out of the Stage filter." />
      </>
    );
  }
  const e = plan.byClient[item.clientId];
  const def = item.stepId ? getItem(item.stepId) : undefined;
  const needs = def ? stepNeeds(def) : [];
  const activity = e ? activityOf(item, getStateForEngagement(e) as Record<string, unknown>) : [];
  const sessions = cal.blocks.filter((b) => b.itemRef === item.id);
  const by = setByText(item, me?.id, seat);
  const kind = item.kind === 'step' ? `Step · ${item.code}` : item.kind === 'filing' ? `${item.code} filing` : item.kind === 'request' ? 'Document request' : 'Team task';
  const open = () => {
    closeDrawer();
    go(acts.hrefOf(item));
  };
  return (
    <div className="mx-td2">
      <DrawerHead
        eyebrow={`${item.clientName} · ${kind}`}
        title={item.title}
        chips={
          <>
            <StPill i={item} />
            <span className="pill mut" title="Who acts next">
              {item.holder === 'client' ? 'With the client' : item.holder === 'manager' ? (seat === 'lead' ? 'With your manager' : 'With you') : who.mode === 'mgr-lead' ? `With ${firstOf(who.name)}` : 'With you'}
              {item.work?.ageLabel ? ` · ${item.work.ageLabel}` : ''}
            </span>
            {item.locked ? (
              <span className="pill up" title="Dates a manager set; leads plan inside them">
                <Icon name="lock" />
                {by ? `Dates ${by}` : 'Manager dates'}
              </span>
            ) : null}
          </>
        }
      />
      <section className="mx-ds2">
        <div className="mx-dsh">
          <span className="eyebrow">Span</span>
          <span className="sp" />
          {dates.editable(item) ? (
            <Btn cls="sm" ico={item.locked ? 'cal' : 'lock'} onClick={(ev) => dates.open(item, ev.currentTarget)}>
              {item.locked ? 'Change the dates' : 'Set the dates'}
            </Btn>
          ) : null}
        </div>
        {item.due ? (
          <div className="mx-span">
            <b>{item.start ? dShort(item.start, plan.today) : 'Open'}</b>
            <i />
            <b>{dShort(item.due, plan.today)}</b>
            <span className="small">{item.locked ? 'manager dates' : item.kind === 'filing' ? 'filing due date' : item.kind === 'task' ? 'task due date' : 'due date'}</span>
          </div>
        ) : (
          <span className="small">No dates yet.{dates.editable(item) ? ' Set the dates to give the lead a window.' : ''}</span>
        )}
      </section>
      <section className="mx-ds2">
        <div className="mx-dsh">
          <span className="eyebrow">Work sessions on the calendar</span>
          <span className="sp" />
          <span className="small">{sessions.length === 1 ? '1 block' : `${sessions.length} blocks`}</span>
        </div>
        {sessions.length ? (
          sessions.map((b) => (
            <div key={b.id} className="mx-sess">
              <span className="mx-dot" style={{ background: hueOf(item.clientId) }} />
              <span className="mx-dt">
                <b>{`${dDay(b.day, plan.today)} · ${fmtRange(b.startMin, b.endMin)}`}</b>
                <span>{b.title}</span>
              </span>
              {item.due && b.day > item.due ? (
                <span className="pill due" title="This block is after the item's due date">
                  After span
                </span>
              ) : null}
            </div>
          ))
        ) : (
          <span className="small">No blocks planned yet. Double-click the calendar or use Add block to plan one.</span>
        )}
      </section>
      {needs.length ? (
        <section className="mx-ds2">
          <span className="eyebrow">What it needs</span>
          <ul className="wk-ul">
            {needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {item.task?.notes ? (
        <section className="mx-ds2">
          <span className="eyebrow">Notes</span>
          <p className="small wk-pre">{item.task.notes}</p>
        </section>
      ) : null}
      {activity.length ? (
        <section className="mx-ds2">
          <span className="eyebrow">Activity</span>
          {activity.map((a) => (
            <div key={a.what + a.when} className="mx-act">
              <i />
              <span className="mx-dt">
                <b>{a.what}</b>
                <span>{a.when}</span>
              </span>
            </div>
          ))}
        </section>
      ) : null}
      <div className="mx-dfoot">
        <Btn ico={item.kind === 'step' ? 'step' : item.kind === 'filing' ? 'calc' : 'grid'} onClick={open}>
          {item.kind === 'step' ? 'Open step' : item.kind === 'filing' ? 'Open filing' : 'Open client'}
        </Btn>
        {item.holder === 'client' && item.st !== 'done' ? (
          <Btn
            ico="mail"
            onClick={() => {
              closeDrawer();
              go(mailDraft(base, e, item.title));
            }}
          >
            Send reminder
          </Btn>
        ) : null}
        <span className="sp" />
        {item.kind === 'task' ? (
          <Btn cls={item.st === 'done' ? '' : 'pri'} ico={item.st === 'done' ? 'back' : 'check'} onClick={() => acts.setTaskDone(item, item.st !== 'done')}>
            {item.st === 'done' ? 'Reopen' : 'Mark done'}
          </Btn>
        ) : item.cta.action === 'nudge-manager' ? (
          <Btn cls="pri" ico="mail" onClick={() => void acts.run(item)}>
            {item.cta.label}
          </Btn>
        ) : null}
      </div>
    </div>
  );
}
