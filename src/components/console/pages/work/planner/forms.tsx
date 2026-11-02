'use client';

/**
 * New to-do (prototype mxNewTodo) and Plan my week (mxPlanWeek).
 *
 * A to-do with a client is saved as a team task on that client
 * (POST /api/tasks), assigned to you or — managers only — to a project lead,
 * with the due date you give it. A plain to-do stays in your own list (the
 * live to-do card's store). Plan my week lays open work into free calendar
 * time and adds the blocks you accept (POST /api/planner/blocks).
 */
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { useConsole } from '../../../runtime';
import { DrawerHead, ModalBody } from '../../../overlays';
import { Btn, Empty, Icon, Seg, hueOf } from '../../../ui';
import { dDay, dShort } from '../../today/model';
import { readSession, shortName, writeSession } from './bits';
import { useBlocks, usePlan, type LeadRow, type PlannerWho } from './data';
import { fmtRange, hoursText, planDays, planWeek, type PlanRules } from './model';
import { firstOf } from './overlays';

export interface TodoApi {
  /** Add a personal to-do for the signed-in person (no client, no date). */
  add: (title: string) => void;
  remove: (id: string) => void;
}

export function NewTodoModal({
  who,
  leads,
  todos,
  preset,
}: {
  who: PlannerWho;
  leads: LeadRow[];
  todos?: TodoApi;
  preset?: { title?: string; lead?: string; fromTodo?: string };
}) {
  const { me, seat, closeModal, toast } = useConsole();
  const { user } = useApp();
  const qc = useQueryClient();
  const plan = usePlan(who);
  const isMgr = seat === 'mgr';
  const fixedLead = who.mode === 'mgr-lead' ? who.key : '';
  const [title, setTitle] = useState(preset?.title ?? '');
  const [client, setClient] = useState('');
  const [due, setDue] = useState('');
  const [to, setTo] = useState(preset?.lead ?? fixedLead);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lead = leads.find((l) => l.key === to);
  const clients = useMemo(() => [...plan.engagements].sort((a, b) => a.companyName.localeCompare(b.companyName)), [plan.engagements]);
  const needsClient = Boolean(to) || Boolean(due) || !todos;
  const save = async () => {
    const t = title.trim();
    if (!t) return setErr('Give the to-do a name.');
    if (needsClient && !client) return setErr(to ? 'Pick a client to hand it to a lead.' : due ? 'Pick a client to give it a date.' : 'Pick a client.');
    if (!client) {
      todos?.add(t);
      closeModal();
      return toast('Added to your to-dos');
    }
    const assignee = to ? lead?.profileId : user?.id;
    if (to && !assignee) return setErr(`${lead?.name ?? 'This lead'} has no sign-in yet, so a task cannot be handed to them.`);
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId: client, title: t, status: 'not-started', assigneeId: assignee, dueAt: due ? `${due}T12:00:00+05:30` : null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not add the to-do.');
      await qc.invalidateQueries({ queryKey: ['tasks', user?.id] });
      if (preset?.fromTodo && todos) todos.remove(preset.fromTodo);
      closeModal();
      toast(to ? `${t} assigned to ${lead?.name ?? 'the lead'}` : `${t} added to your tasks`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add the to-do. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const heading = who.mode === 'mgr-lead' ? `Assign a to-do to ${firstOf(who.name)}` : preset?.fromTodo ? 'Hand a to-do to a lead' : 'New to-do';
  return (
    <ModalBody
      title={heading}
      sub={isMgr ? 'A to-do is yours until you hand it to a lead. With a client it becomes a task on that client, with its due date.' : 'With a client it becomes a task on that client, with its due date.'}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <span className="sp" />
          <Btn cls="pri" ico="check" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : to ? 'Assign' : 'Add'}
          </Btn>
        </>
      }
    >
      <div className="mx-form2 one">
        <label className="mx-f">
          <span className="mx-fl">What</span>
          <input
            className="mx-in"
            value={title}
            maxLength={200}
            placeholder="Call the client about the office NOC"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
          />
        </label>
        <label className="mx-f">
          <span className="mx-fl">Client</span>
          <select className="lsel full" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">{needsClient ? 'Pick a client' : 'No client'}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </label>
        <label className="mx-f">
          <span className="mx-fl">Due</span>
          <input className="mx-in" type="date" value={due} min={plan.today} onChange={(e) => setDue(e.target.value)} />
          <span className="mx-fh">Optional. A due date needs a client.</span>
        </label>
        {isMgr ? (
          <label className="mx-f">
            <span className="mx-fl">Assign to</span>
            <select className="lsel full" value={to} onChange={(e) => setTo(e.target.value)}>
              {who.mode === 'mgr-lead' ? null : <option value="">{`Keep it with me${me ? ` (${firstOf(me.name)})` : ''}`}</option>}
              {leads.map((l) => (
                <option key={l.key} value={l.key} disabled={!l.profileId}>
                  {`${l.name}${l.profileId ? '' : ' · no sign-in'}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {err ? <p className="wk-err">{err}</p> : null}
    </ModalBody>
  );
}

/* ================================================================ plan my week */

const RULES_KEY = 'vcfo-console-plan-rules';
const isRules = (v: unknown): v is PlanRules => !!v && typeof v === 'object' && 'deep' in v && 'first' in v && 'group' in v;
const H0 = 9;
const ROWS = 10;
const PX = 40;
const RULE_TEXT: Array<[keyof PlanRules, string]> = [
  ['deep', 'Keep 9 to 11 am for deep work'],
  ['first', 'Overdue and filing-related first'],
  ['group', 'Group work by client'],
];

export function PlanWeekDrawer({ who, owner }: { who: PlannerWho; owner: string }) {
  const { closeDrawer, toast } = useConsole();
  const plan = usePlan(who);
  const days5 = useMemo(() => planDays(plan.today), [plan.today]);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [rules, setRulesState] = useState<PlanRules>(() => readSession(RULES_KEY, { deep: true, first: true, group: false }, isRules));
  const [seed, setSeed] = useState(0);
  const cal = useBlocks(owner, days5[0]!, days5[4]!);
  const days = view === 'day' ? [days5[0]!] : days5;
  const sg = useMemo(() => planWeek(plan.items, cal.blocks, days5, rules, seed), [plan.items, cal.blocks, days5, rules, seed]);
  const on = sg.filter((s) => !s.refused);
  const off = sg.filter((s) => s.refused);
  const loadOf = (d: string) =>
    (on.filter((s) => s.day === d).reduce((n, s) => n + s.z - s.a, 0) + cal.blocks.filter((b) => b.day === d).reduce((n, b) => n + b.endMin - b.startMin, 0)) / 60;
  const tot = on.reduce((n, s) => n + s.z - s.a, 0) / 60;
  const heavy = days5.filter((d) => loadOf(d) > 6);
  const nb = (n: number) => (n === 1 ? '1 block' : `${n} blocks`);
  const setRule = (k: keyof PlanRules, v: boolean) => {
    const next = { ...rules, [k]: v };
    setRulesState(next);
    writeSession(RULES_KEY, next);
  };
  const add = () =>
    cal.create.mutate(
      on.map((s) => ({ ownerId: owner, engagementId: s.item.clientId, itemRef: s.item.id, title: s.item.title, day: s.day, startMin: s.a, endMin: s.z })),
      {
        onSuccess: () => {
          closeDrawer();
          toast(`${nb(on.length)} added · ${dDay(days5[0]!, plan.today)} to ${dDay(days5[4]!, plan.today)}`);
        },
        onError: (e) => toast(e instanceof Error ? e.message : 'The blocks could not be added. Try again.'),
      },
    );
  const whose = who.mode === 'mgr-lead' ? `${firstOf(who.name)}'s` : 'my';
  const top = (min: number) => ((min - H0 * 60) / 60) * PX + 1;
  return (
    <div className="mx-pw">
      <DrawerHead
        eyebrow={`${dDay(days5[0]!, plan.today)} to ${dDay(days5[4]!, plan.today)} · ${hoursText(Math.round(tot * 10) / 10)} planned`}
        title={`Plan ${whose} week`}
        chips={<span className="mx-new">New</span>}
      />
      <div className="mx-pwt">
        <Seg<'week' | 'day'> className="sm" ariaLabel="Plan by" value={view} onChange={setView} options={[{ value: 'week', label: 'Week' }, { value: 'day', label: 'Day' }]} />
        <span className="sp" />
        <span className="small">{`${nb(on.length)} · ${off.length} not planned`}</span>
      </div>
      {cal.loading || plan.loading ? (
        <div className="sec-load">Loading the calendar…</div>
      ) : !sg.length ? (
        <Empty title="Nothing to plan" sub="Open work due in the next two weeks shows up here. Work waiting on a client is left out." />
      ) : (
        <div className="mx-pwg" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
          <span />
          {days.map((d) => (
            <div key={d} className={'mx-pwd' + (loadOf(d) > 6 ? ' over' : '')} title={loadOf(d) > 6 ? 'Over 6 hours planned' : 'Hours planned that day'}>
              <b>{dDay(d, plan.today).toUpperCase()}</b>
              <span>{hoursText(Math.round(loadOf(d) * 10) / 10)}</span>
            </div>
          ))}
          <div className="mx-pwh" style={{ height: ROWS * PX }}>
            {Array.from({ length: ROWS }, (_, i) => (
              <span key={i} style={{ top: i * PX - 7 }}>
                {`${((H0 + i - 1) % 12) + 1} ${H0 + i >= 12 ? 'PM' : 'AM'}`}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className="mx-pwc" style={{ height: ROWS * PX }}>
              {Array.from({ length: ROWS }, (_, i) => (
                <i key={i} style={{ top: i * PX }} />
              ))}
              {cal.blocks
                .filter((b) => b.day === d)
                .map((b) => (
                  <div
                    key={b.id}
                    className="mx-pwb off"
                    title={`Already on the calendar · ${b.title} · ${fmtRange(b.startMin, b.endMin)}`}
                    style={{ ['--cc' as string]: hueOf(b.engagementId ?? b.title), top: top(b.startMin), height: ((b.endMin - b.startMin) / 60) * PX - 3 }}
                  >
                    <b>{b.title}</b>
                  </div>
                ))}
              {on
                .filter((s) => s.day === d)
                .map((s) => (
                  <div
                    key={s.item.id}
                    className="mx-pwb"
                    title={`${s.item.title} · ${fmtRange(s.a, s.z)}${s.item.due ? ` · due ${dShort(s.item.due, plan.today)}` : ''}`}
                    style={{ ['--cc' as string]: hueOf(s.item.clientId), top: top(s.a), height: ((s.z - s.a) / 60) * PX - 3 }}
                  >
                    <b>{s.item.title}</b>
                    <span>{`${shortName(s.item.clientName)} · ${fmtRange(s.a, s.z)}`}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
      <div className="mx-pwr">
        <span className="eyebrow">Rules</span>
        {RULE_TEXT.map(([k, l]) => (
          <label key={k} className="mx-sw">
            <input type="checkbox" checked={rules[k]} onChange={(e) => setRule(k, e.target.checked)} />
            <i />
            <span>{l}</span>
          </label>
        ))}
      </div>
      {sg.length ? (
        <div className="mx-digest small">
          <Icon name="bolt" />
          <span>
            <b>{heavy.length ? `${heavy.map((d) => dDay(d, plan.today)).join(', ')} ${heavy.length === 1 ? 'is' : 'are'} over 6 hours. ` : 'Every day is under 6 hours. '}</b>
            {rules.deep ? '9 to 11 am stays free for step work; filings and overdue items may use it. ' : ''}
            {rules.first ? 'Overdue and filing work comes first. ' : ''}
            {off.length ? `Not planned: ${off.map((s) => `${s.item.title} (${s.refused})`).join('; ')}. ` : ''}
            {on.every((s) => !s.item.due || s.day <= s.item.due) ? 'Every block lands on or before its due date. ' : ''}
            Steps get about 1 h 30 min, filings and tasks about 1 h; drag a block on the calendar to change it.
          </span>
        </div>
      ) : null}
      <div className="mx-dfoot">
        <Btn onClick={closeDrawer}>Cancel</Btn>
        <Btn ico="bolt" disabled={on.length < 2} onClick={() => setSeed((n) => n + 1)}>
          Reshuffle
        </Btn>
        <span className="sp" />
        <Btn cls="pri" ico="check" disabled={!on.length || cal.create.isPending} onClick={add}>
          {cal.create.isPending ? 'Adding…' : `Add ${nb(on.length)} to calendar`}
        </Btn>
      </div>
    </div>
  );
}
